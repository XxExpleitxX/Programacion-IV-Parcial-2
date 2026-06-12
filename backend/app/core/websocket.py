"""
WebSocket Manager — pool de conexiones POR CANAL.

Canales:
  - str(pedido_id) → suscriptores de un pedido puntual (el cliente que lo sigue)
  - "admin"        → feed de TODOS los pedidos (cajero / panel admin)

El broadcast SIEMPRE se dispara DESPUÉS del commit del UoW (RN-06):
los eventos se encolan en el UoW durante la transacción y get_uow los emite
una vez confirmada. Si no hay suscriptores en un canal, el envío es un no-op.
"""
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger("app.core.websocket")

ADMIN_CHANNEL = "admin"


class WSManager:
    def __init__(self) -> None:
        # canal -> conjunto de conexiones activas
        self.channels: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str) -> None:
        await websocket.accept()
        self.channels.setdefault(channel, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, channel: str) -> None:
        conns = self.channels.get(channel)
        if conns:
            conns.discard(websocket)
            if not conns:
                del self.channels[channel]

    async def _send(self, channel: str, payload: dict[str, Any]) -> None:
        for connection in list(self.channels.get(channel, set())):
            try:
                await connection.send_json(payload)
            except Exception:
                self.channels[channel].discard(connection)   # conexión caída → la saco

    async def broadcast_pedido(self, pedido_id: int, evento: dict[str, Any]) -> None:
        """Envía el evento al dueño del pedido (canal pedido_id) y al canal admin."""
        payload = {"event": evento.get("event", "estado_cambiado"), "data": evento}
        await self._send(str(pedido_id), payload)
        await self._send(ADMIN_CHANNEL, payload)

    async def broadcast_to_role(self, role: str, evento: dict[str, Any]) -> None:
        payload = {"event": evento.get("event", "estado_cambiado"), "data": evento}
        await self._send(role, payload)


manager = WSManager()   # singleton para toda la app