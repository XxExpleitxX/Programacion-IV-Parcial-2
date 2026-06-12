"""
Router de Pedidos.

Roles:
  - CLIENT: crear pedido, ver sus pedidos, cancelar desde PENDIENTE/CONFIRMADO
  - PEDIDOS: ver todos, avanzar estados
  - ADMIN: todo

CAMBIO (devolución del profe): ya NO se llama uow.commit() en los endpoints.
El commit es automático (lo hace el Unit of Work al terminar bien el request).
"""

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query, status, WebSocket, WebSocketDisconnect

from app.core.security import decode_token, require_authenticated
from app.core.config import settings
from app.core.websocket import manager
from app.models.usuarios.usuario import Usuario
from app.schemas.pago_schema import (
    PedidoCreate, PedidoRead, AvanzarEstadoRequest, HistorialRead
)
from app.services.pedido_service import PedidoService
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/pedidos", tags=["Pedidos"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]


def _roles(usuario: Usuario) -> list[str]:
    return usuario.roles


# Mapea TU estado (en mayúsculas) → nombre del evento que escucha el front
EVENTOS_WS = {
    "CONFIRMADO": "PEDIDO_CONFIRMADO",
    "EN_PREP":    "PEDIDO_EN_PREPARACION",
    "ENTREGADO":  "PEDIDO_ENTREGADO",
    "CANCELADO":  "PEDIDO_CANCELADO",
}


# ── Crear pedido (cliente, admin) ──────────────────────────────────────────────

@router.post("/", response_model=PedidoRead, status_code=status.HTTP_201_CREATED)
def crear_pedido(
    data: PedidoCreate,
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    # Sin uow.commit(): el UoW comitea solo si el endpoint termina bien.
    return PedidoService.crear_pedido(uow, usuario.id, data)


# ── Listar pedidos ────────────────────────────────────────────────────────────
# cliente ve solo sus pedidos, admin/pedidos ven todos

@router.get("/", response_model=List[PedidoRead])
def listar_pedidos(
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
    estado: Annotated[Optional[str], Query()] = None,
):
    roles = _roles(usuario)
    if "ADMIN" in roles or "PEDIDOS" in roles:
        return PedidoService.get_todos_pedidos(uow, estado=estado)
    return PedidoService.get_pedidos_usuario(uow, usuario.id)


# ── Detalle ───────────────────────────────────────────────────────────────────

@router.get("/{pedido_id}", response_model=PedidoRead)
def get_pedido(
    pedido_id: int,
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    return PedidoService.get_pedido(uow, pedido_id, usuario.id, _roles(usuario))


# ── Avanzar estado (+ broadcast en tiempo real) ────────────────────────────────

@router.post("/{pedido_id}/estado", response_model=PedidoRead)
async def avanzar_estado(
    pedido_id: int,
    data: AvanzarEstadoRequest,
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    # El broadcast WS lo dispara get_uow DESPUÉS del commit (RN-06),
    # con el evento que encola el Service.
    pedido = PedidoService.avanzar_estado(
        uow, pedido_id, usuario.id, _roles(usuario), data
    )
    return pedido


# ── Historial de estados ──────────────────────────────────────────────────────

@router.get("/{pedido_id}/historial", response_model=List[HistorialRead])
def get_historial(
    pedido_id: int,
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    # Valida acceso al pedido y luego trae el historial DESDE el repo
    # (antes se creaba HistorialRepository(uow.session) a mano).
    PedidoService.get_pedido(uow, pedido_id, usuario.id, _roles(usuario))
    return uow.historial.get_by_pedido(pedido_id)


# ── WebSocket para seguimiento de pedido en tiempo real ────────────────────────

@router.websocket("/ws")
async def websocket_pedidos(
    websocket: WebSocket,
    token: str = Query(...),
    pedido_id: Optional[int] = Query(None),
):
    """
    WebSocket de seguimiento en tiempo real. Auth por query param ?token=<jwt>.
      - Con ?pedido_id=N  → suscribe al canal de ESE pedido (cliente que lo sigue).
      - Sin pedido_id     → feed "admin" de TODOS los pedidos (solo ADMIN/PEDIDOS).
    Ej: ws://localhost:8000/api/v1/pedidos/ws?token=...&pedido_id=12
    """
    # 1. Validar el JWT que viene en el query param
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        await websocket.accept()
        await websocket.close(code=1008, reason="Token invalido")
        return

    # 2. Validar que el usuario exista y esté activo
    with UnitOfWork() as uow:
        user = uow.usuarios.get_by_username(payload["sub"])
        if not user or user.disabled:
            await websocket.accept()
            await websocket.close(code=1008, reason="Usuario invalido o inactivo")
            return
        roles = user.roles

    # 3. Elegir canal: un pedido puntual, o el feed admin
    if pedido_id is not None:
        channel = str(pedido_id)
    else:
        if not any(r in ("ADMIN", "PEDIDOS") for r in roles):
            await websocket.accept()
            await websocket.close(code=1008, reason="Requiere rol ADMIN/PEDIDOS")
            return
        channel = "admin"

    # 4. Registrar y mantener viva la conexión en ese canal
    await manager.connect(websocket, channel)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)