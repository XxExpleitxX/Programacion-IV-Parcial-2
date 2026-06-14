"""
Router WebSocket — seguimiento de pedidos en tiempo real (RN-06).

Dos canales (rutas nombradas):
  - WS /api/v1/ws/pedidos/{pedido_id}  → canal de ESE pedido (cliente que lo sigue).
  - WS /api/v1/ws/admin/pedidos        → feed de TODOS los pedidos (ADMIN/PEDIDOS).

Auth por query param ?token=<jwt>. El broadcast lo dispara el UoW POST-commit.
"""
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import decode_token
from app.core.websocket import manager
from app.unit_of_work import UnitOfWork

router = APIRouter(prefix="/ws", tags=["WebSocket"])


async def _autenticar(websocket: WebSocket, token: str) -> Optional[list[str]]:
    """Valida el JWT y el usuario. Devuelve los roles, o cierra la conexión y None."""
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        await websocket.accept()
        await websocket.close(code=1008, reason="Token invalido")
        return None
    with UnitOfWork() as uow:
        user = uow.usuarios.get_by_username(payload["sub"])
        if not user or user.disabled:
            await websocket.accept()
            await websocket.close(code=1008, reason="Usuario invalido o inactivo")
            return None
        return list(user.roles)


async def _mantener_vivo(websocket: WebSocket, channel: str) -> None:
    """Registra la conexión en el canal y la mantiene viva hasta que se desconecte."""
    await manager.connect(websocket, channel)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)


@router.websocket("/pedidos/{pedido_id}")
async def ws_pedido(websocket: WebSocket, pedido_id: int, token: str = Query(...)):
    """Canal de UN pedido — lo sigue el cliente dueño."""
    roles = await _autenticar(websocket, token)
    if roles is None:
        return
    await _mantener_vivo(websocket, str(pedido_id))


@router.websocket("/admin/pedidos")
async def ws_admin(websocket: WebSocket, token: str = Query(...)):
    """Feed de TODOS los pedidos — solo ADMIN/PEDIDOS."""
    roles = await _autenticar(websocket, token)
    if roles is None:
        return
    if not any(r in ("ADMIN", "PEDIDOS") for r in roles):
        await websocket.accept()
        await websocket.close(code=1008, reason="Requiere rol ADMIN/PEDIDOS")
        return
    await _mantener_vivo(websocket, "admin")
