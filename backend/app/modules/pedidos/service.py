
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status

from app.modules.pedidos.pedido import Pedido
from app.modules.pedidos.detalle_pedido import DetallePedido
from app.modules.pedidos.historial_estado_pedido import HistorialEstadoPedido
from app.modules.productos.producto import Producto
from app.schemas.pago_schema import PedidoCreate, AvanzarEstadoRequest
from app.schemas.pagination import paginate
from app.unit_of_work import UnitOfWork


FSM: dict[str, list[str]] = {
    "PENDIENTE":  ["CONFIRMADO", "CANCELADO"],
    "CONFIRMADO": ["EN_PREP",    "CANCELADO"],
    "EN_PREP":    ["ENTREGADO",  "CANCELADO"],
    "ENTREGADO":  [],
    "CANCELADO":  [],
}

ESTADOS_CANCELABLE_POR_CLIENT = {"PENDIENTE", "CONFIRMADO"}
ROLES_ADMIN_PEDIDOS = {"ADMIN", "PEDIDOS"}


def _validar_transicion(estado_actual: str, estado_hacia: str, roles: list[str]) -> None:
    # 1. La transición debe existir en la máquina de estados.
    permitidos = FSM.get(estado_actual, [])
    if estado_hacia not in permitidos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Transición inválida: {estado_actual} → {estado_hacia}. Permitidas: {permitidos}",
        )

    es_admin_o_pedidos = any(r in ROLES_ADMIN_PEDIDOS for r in roles)
    es_cliente_puro = "CLIENT" in roles and not es_admin_o_pedidos

    # 2. El CLIENT solo puede CANCELAR, y únicamente mientras el pedido NO entró
    #    a cocina: estado en {PENDIENTE, CONFIRMADO}. Una vez EN_PREP, la
    #    cancelación la realiza ADMIN/PEDIDOS.
    if es_cliente_puro:
        if estado_hacia != "CANCELADO":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Los clientes solo pueden cancelar pedidos.",
            )
        if estado_actual not in ESTADOS_CANCELABLE_POR_CLIENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"El cliente solo puede cancelar pedidos en {sorted(ESTADOS_CANCELABLE_POR_CLIENT)}; "
                    f"desde {estado_actual} la cancelación la realiza ADMIN/PEDIDOS."
                ),
            )

    # 3. Cancelar un pedido ya EN_PREP queda reservado a ADMIN/PEDIDOS
    #    (cubre cualquier rol que no sea ADMIN/PEDIDOS).
    if estado_actual == "EN_PREP" and estado_hacia == "CANCELADO" and not es_admin_o_pedidos:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo ADMIN o PEDIDOS pueden cancelar desde EN_PREP.",
        )


class PedidoService:

    @staticmethod
    def _verificar_stock(uow: UnitOfWork, producto: Producto, cantidad_pedida: int) -> None:
        if producto.es_manufacturado:
            faltantes = []
            for pi in producto.producto_ingredientes:
                ingrediente = uow.ingredientes.get_by_id(pi.ingrediente_id)
                disponible = (ingrediente.stock_disponible or 0) if ingrediente else 0
                requerido = pi.cantidad * cantidad_pedida
                if disponible < requerido:
                    faltantes.append(ingrediente.nombre if ingrediente else f"ingrediente #{pi.ingrediente_id}")
            if faltantes:
                raise HTTPException(
                    status_code=422,
                    detail=f"Stock de insumos insuficiente para '{producto.nombre}': falta {', '.join(faltantes)}.",
                )
        else:
            disponible = producto.stock_cantidad or 0
            if disponible < cantidad_pedida:
                raise HTTPException(
                    status_code=422,
                    detail=f"Stock insuficiente de '{producto.nombre}': quedan {disponible} y se pidieron {cantidad_pedida}.",
                )

    @staticmethod
    def _ajustar_stock(uow: UnitOfWork, producto: Producto, cantidad_pedida: int, signo: int) -> None:
        if producto.es_manufacturado:
            for pi in producto.producto_ingredientes:
                ingrediente = uow.ingredientes.get_by_id(pi.ingrediente_id)
                if ingrediente:
                    consumo = pi.cantidad * cantidad_pedida
                    ingrediente.stock_disponible = (ingrediente.stock_disponible or 0) + signo * consumo
                    uow.ingredientes.add(ingrediente)
        else:
            producto.stock_cantidad = (producto.stock_cantidad or 0) + signo * cantidad_pedida
            # Auto-agotar: si una venta dejó el stock en 0, lo sacamos del menú.
            if signo < 0 and (producto.stock_cantidad or 0) <= 0:
                producto.disponible = False
            uow.productos.add(producto)

    @staticmethod
    def _auto_agotar_manufacturados(uow: UnitOfWork, ingrediente_ids: set[int]) -> None:
        for prod in uow.productos.get_manufacturados_que_usan(list(ingrediente_ids)):
            if not prod.disponible:
                continue
            producible = True
            for pi in prod.producto_ingredientes:
                ingrediente = uow.ingredientes.get_by_id(pi.ingrediente_id)
                if (ingrediente.stock_disponible if ingrediente else 0) < pi.cantidad:
                    producible = False
                    break
            if not producible:
                prod.disponible = False
                uow.productos.add(prod)

    @staticmethod
    def crear_pedido(uow: UnitOfWork, usuario_id: int, data: PedidoCreate) -> Pedido:
        # ── Forma de pago: vía repo (antes: uow.session.get) ──────────────
        forma = uow.formas_pago.get_by_id(data.forma_pago_codigo)
        if not forma or not forma.habilitado:
            raise HTTPException(status_code=422, detail="Forma de pago no válida.")

        detalles: list[DetallePedido] = []
        subtotal = Decimal("0.00")
        ingredientes_afectados: set[int] = set()

        for item in data.items:
            # ── Producto: vía repo (antes: uow.session.get) ───────────────
            producto = uow.productos.get_by_id(item.producto_id)
            if not producto or producto.deleted_at is not None:
                raise HTTPException(status_code=422, detail=f"Producto {item.producto_id} no encontrado.")
            if not producto.disponible:
                raise HTTPException(status_code=422, detail=f"Producto '{producto.nombre}' no disponible.")

            precio = Decimal(str(producto.precio_base))
            sub = precio * item.cantidad
            subtotal += sub

            # Snapshot: precio y nombre quedan congelados en el detalle
            detalles.append(DetallePedido(
                producto_id     = item.producto_id,
                cantidad        = item.cantidad,
                nombre_snapshot = producto.nombre,
                precio_snapshot = precio,
                subtotal_snap   = sub,
                personalizacion = item.personalizacion,
            ))

            # Valida stock suficiente y luego descuenta lo que consume este ítem
            # (insumos si es manufacturado, stock_cantidad si es terminado).
            # Se restaura si el pedido se cancela.
            PedidoService._verificar_stock(uow, producto, item.cantidad)
            PedidoService._ajustar_stock(uow, producto, item.cantidad, signo=-1)
            if producto.es_manufacturado:
                ingredientes_afectados.update(pi.ingrediente_id for pi in producto.producto_ingredientes)

        # Tras descontar todos los insumos del pedido, saca del menú los
        # manufacturados que quedaron sin poder producirse.
        PedidoService._auto_agotar_manufacturados(uow, ingredientes_afectados)

        costo_envio = Decimal("50.00") if data.direccion_id else Decimal("0.00")
        total = subtotal + costo_envio

        pedido = Pedido(
            usuario_id        = usuario_id,
            direccion_id      = data.direccion_id,
            estado_codigo     = "PENDIENTE",
            forma_pago_codigo = data.forma_pago_codigo,
            subtotal          = subtotal,
            descuento         = Decimal("0.00"),
            costo_envio       = costo_envio,
            total             = total,
            notas             = data.notas,
        )
        # ── Alta del pedido: vía repo + flush para obtener el id ──────────
        uow.pedidos.add(pedido)
        uow.flush()                         # genera pedido.id (NO comitea)

        # ── Detalles: vía repo (antes: uow.session.add por cada uno) ──────
        for d in detalles:
            d.pedido_id = pedido.id
        uow.detalles.bulk_create(detalles)

        # ── Audit trail: vía HistorialEstadoPedidoRepository ──────────────
        uow.historial.append(HistorialEstadoPedido(
            pedido_id    = pedido.id,
            estado_desde = None,
            estado_hacia = "PENDIENTE",
            usuario_id   = usuario_id,
            motivo       = "Pedido creado",
        ))

        uow.flush()
        uow.refresh(pedido)
        return pedido                       # el commit lo hace el UoW al cerrar

    @staticmethod
    def avanzar_estado(
        uow: UnitOfWork,
        pedido_id: int,
        usuario_id: int,
        roles: list[str],
        data: AvanzarEstadoRequest,
    ) -> Pedido:
        # ── Buscar pedido: vía repo ───────────────────────────────────────
        pedido = uow.pedidos.get_by_id(pedido_id)
        if not pedido or pedido.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")

        estado_actual = pedido.estado_codigo
        estado_hacia  = data.estado_hacia.upper()

        if estado_hacia == "CANCELADO" and not data.motivo:
            raise HTTPException(status_code=422, detail="motivo es obligatorio al cancelar.")

        if "CLIENT" in roles and not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
            if pedido.usuario_id != usuario_id:
                raise HTTPException(status_code=403, detail="Acceso denegado.")
            if estado_actual not in ESTADOS_CANCELABLE_POR_CLIENT:
                raise HTTPException(
                    status_code=403,
                    detail="Solo podés cancelar desde PENDIENTE o CONFIRMADO.",
                )

        _validar_transicion(estado_actual, estado_hacia, roles)

        # Al cancelar, devolvemos al stock todo lo que el pedido había descontado
        # al crearse (insumos de manufacturados + stock_cantidad de terminados).
        if estado_hacia == "CANCELADO":
            for det in uow.detalles.get_by_pedido(pedido.id):
                producto = uow.productos.get_by_id(det.producto_id)
                if producto:
                    PedidoService._ajustar_stock(uow, producto, det.cantidad, signo=+1)

        pedido.estado_codigo = estado_hacia
        pedido.updated_at    = datetime.utcnow()
        uow.pedidos.add(pedido)             # marca el pedido como modificado

        # ── Audit trail: append-only vía repo ─────────────────────────────
        uow.historial.append(HistorialEstadoPedido(
            pedido_id    = pedido.id,
            estado_desde = estado_actual,
            estado_hacia = estado_hacia,
            usuario_id   = usuario_id,
            motivo       = data.motivo,
        ))

        # ── Encolar evento WS para emitirlo DESPUÉS del commit (RN-06) ─────
        uow.emit_pedido_event(pedido.id, {
            "event":           "pedido_cancelado" if estado_hacia == "CANCELADO" else "estado_cambiado",
            "pedido_id":       pedido.id,
            "estado_anterior": estado_actual,
            "estado_nuevo":    estado_hacia,
            "usuario_id":      usuario_id,
            "motivo":          data.motivo,
        })

        uow.flush()
        uow.refresh(pedido)
        return pedido

    @staticmethod
    def get_pedidos_usuario(uow: UnitOfWork, usuario_id: int, page: int = 1, size: int = 20) -> dict:
        items = uow.pedidos.get_by_usuario(usuario_id, offset=(page - 1) * size, limit=size)
        total = uow.pedidos.count_by_usuario(usuario_id)
        return paginate(items, total, page, size)

    @staticmethod
    def get_todos_pedidos(uow: UnitOfWork, estado: Optional[str] = None, page: int = 1, size: int = 20) -> dict:
        items = uow.pedidos.get_all_active(estado=estado, offset=(page - 1) * size, limit=size)
        total = uow.pedidos.count_all_active(estado=estado)
        return paginate(items, total, page, size)

    @staticmethod
    def get_pedido(uow: UnitOfWork, pedido_id: int, usuario_id: int, roles: list[str]) -> Pedido:
        pedido = uow.pedidos.get_by_id(pedido_id)
        if not pedido or pedido.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")
        if "CLIENT" in roles and not any(r in ROLES_ADMIN_PEDIDOS for r in roles):
            if pedido.usuario_id != usuario_id:
                raise HTTPException(status_code=403, detail="Acceso denegado.")
        return pedido