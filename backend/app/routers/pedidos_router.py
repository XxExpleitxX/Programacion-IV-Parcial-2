"""
Router de Pedidos.

Roles:
  - CLIENT: crear pedido, ver sus pedidos, cancelar desde PENDIENTE/CONFIRMADO
  - PEDIDOS: ver todos, avanzar estados
  - ADMIN: todo
"""

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query, status

from app.core.security import require_authenticated, require_roles
from app.models.usuarios.usuario import Usuario
from app.schemas.pago_schema import (
    PedidoCreate, PedidoRead, AvanzarEstadoRequest, HistorialRead
)
from app.services.pedido_service import PedidoService
from app.repositories.pedido_repository import HistorialRepository
from app.unit_of_work import UnitOfWork, get_uow

router = APIRouter(prefix="/pedidos", tags=["Pedidos"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]


def _roles(usuario: Usuario) -> list[str]:
    return usuario.roles


# ── Crear pedido (cliente, admin) ──────────────────────────────────────────────

@router.post("/", response_model=PedidoRead, status_code=status.HTTP_201_CREATED)
def crear_pedido(
    data: PedidoCreate,
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    pedido = PedidoService.crear_pedido(uow, usuario.id, data)
    uow.commit()
    return pedido


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


# ── Avanzar estado ────────────────────────────────────────────────────────────

@router.post("/{pedido_id}/estado", response_model=PedidoRead)
def avanzar_estado(
    pedido_id: int,
    data: AvanzarEstadoRequest,
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    pedido = PedidoService.avanzar_estado(
        uow, pedido_id, usuario.id, _roles(usuario), data
    )
    uow.commit()
    return pedido


# ── Historial de estados ──────────────────────────────────────────────────────

@router.get("/{pedido_id}/historial", response_model=List[HistorialRead])
def get_historial(
    pedido_id: int,
    uow: UoWDep,
    usuario: Usuario = Depends(require_authenticated),
):
    PedidoService.get_pedido(uow, pedido_id, usuario.id, _roles(usuario))
    repo = HistorialRepository(uow.session)
    return repo.get_by_pedido(pedido_id)