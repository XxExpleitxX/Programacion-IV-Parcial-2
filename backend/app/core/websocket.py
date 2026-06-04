import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger("app.core.websocket")

class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: set[WebSocket] = set()   # set = sin duplicados

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)

    async def broadcast(self, event_type: str, data: dict[str, Any]) -> None:
        payload = {"event": event_type, "data": data}
        for connection in list(self.active_connections):
            try:
                await connection.send_json(payload)
            except Exception:
                self.active_connections.discard(connection)  # conexión caída → la saco

manager = ConnectionManager()   # 👈 singleton: una sola instancia para toda la app