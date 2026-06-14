"""
Tests del WebSocket de seguimiento de pedidos (RN-06).

Verifican que un cambio de estado vía REST dispara el broadcast POST-commit
y llega al suscriptor por el canal del pedido y por el canal admin, además del
cierre por token inválido. Se usa el TestClient de FastAPI (websocket_connect).
"""
import pytest
from sqlmodel import select
from starlette.websockets import WebSocketDisconnect

from app.models.usuarios.usuario import Usuario


def _user_id(db_session, username: str) -> int:
    return db_session.exec(select(Usuario).where(Usuario.username == username)).first().id


def _token(headers: dict) -> str:
    """Extrae el JWT crudo del header Authorization Bearer para el query param ?token=."""
    return headers["Authorization"].split(" ", 1)[1]


def test_ws_canal_pedido_recibe_cambio_estado(
    client, pedidos_headers, client_headers, db_session, pedido_factory
):
    # El cliente se suscribe al canal de SU pedido
    cliente_id = _user_id(db_session, "cliente_test")
    pedido = pedido_factory(usuario_id=cliente_id, estado="PENDIENTE")
    token = _token(client_headers)

    with client.websocket_connect(
        f"/api/v1/ws/pedidos/{pedido.id}?token={token}"
    ) as ws:
        # El cajero avanza el estado → debe dispararse el broadcast post-commit
        r = client.post(
            f"/api/v1/pedidos/{pedido.id}/estado",
            headers=pedidos_headers,
            json={"estado_hacia": "CONFIRMADO"},
        )
        assert r.status_code == 200

        msg = ws.receive_json()
        assert msg["event"] == "estado_cambiado"
        assert msg["data"]["pedido_id"] == pedido.id
        assert msg["data"]["estado_anterior"] == "PENDIENTE"
        assert msg["data"]["estado_nuevo"] == "CONFIRMADO"


def test_ws_feed_admin_recibe_eventos(
    client, pedidos_headers, client_headers, db_session, pedido_factory
):
    # Sin pedido_id → feed admin de TODOS los pedidos (rol PEDIDOS habilitado)
    cliente_id = _user_id(db_session, "cliente_test")
    pedido = pedido_factory(usuario_id=cliente_id, estado="PENDIENTE")
    token = _token(pedidos_headers)

    with client.websocket_connect(f"/api/v1/ws/admin/pedidos?token={token}") as ws:
        r = client.post(
            f"/api/v1/pedidos/{pedido.id}/estado",
            headers=pedidos_headers,
            json={"estado_hacia": "CONFIRMADO"},
        )
        assert r.status_code == 200

        msg = ws.receive_json()
        assert msg["data"]["pedido_id"] == pedido.id
        assert msg["data"]["estado_nuevo"] == "CONFIRMADO"


def test_ws_cancelacion_emite_evento_con_motivo(
    client, pedidos_headers, client_headers, db_session, pedido_factory
):
    cliente_id = _user_id(db_session, "cliente_test")
    pedido = pedido_factory(usuario_id=cliente_id, estado="PENDIENTE")
    token = _token(client_headers)

    with client.websocket_connect(
        f"/api/v1/ws/pedidos/{pedido.id}?token={token}"
    ) as ws:
        r = client.post(
            f"/api/v1/pedidos/{pedido.id}/estado",
            headers=pedidos_headers,
            json={"estado_hacia": "CANCELADO", "motivo": "Sin stock"},
        )
        assert r.status_code == 200

        msg = ws.receive_json()
        assert msg["event"] == "pedido_cancelado"
        assert msg["data"]["estado_nuevo"] == "CANCELADO"
        assert msg["data"]["motivo"] == "Sin stock"


def test_ws_token_invalido_cierra_conexion(client):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/v1/ws/pedidos/1?token=token-falso") as ws:
            ws.receive_text()
    assert exc.value.code == 1008
