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
from fastapi import APIRouter, Depends, Query, status

from app.core.security import require_authenticated
from app.core.config import settings
from app.models.usuarios.usuario import Usuario
from app.schemas.pago_schema import (
    PedidoCreate, PedidoRead, AvanzarEstadoRequest, HistorialRead
)
from app.schemas.pagination import Paginated
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

@router.get("/", response_model=Paginated[PedidoRead])
def listar_pedidos(
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
    estado: Annotated[Optional[str], Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    roles = _roles(usuario)
    if "ADMIN" in roles or "PEDIDOS" in roles:
        return PedidoService.get_todos_pedidos(uow, estado=estado, page=page, size=size)
    return PedidoService.get_pedidos_usuario(uow, usuario.id, page=page, size=size)


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


# Los endpoints WebSocket viven en app/routers/ws_router.py
# (/api/v1/ws/pedidos/{id} y /api/v1/ws/admin/pedidos).