"""Tests del ciclo de vida de pedidos: FSM + historial append-only."""
from sqlmodel import select
from app.modules.auth.usuario import Usuario


def _user_id(db_session, username: str) -> int:
    return db_session.exec(select(Usuario).where(Usuario.username == username)).first().id


def test_crear_pedido_ok(client, client_headers, producto_factory):
    prod = producto_factory(precio=150.0)
    r = client.post("/api/v1/pedidos/", headers=client_headers, json={
        "forma_pago_codigo": "EFECTIVO",
        "items": [{"producto_id": prod.id, "cantidad": 2}],
    })
    assert r.status_code == 201
    body = r.json()
    assert body["estado_codigo"] == "PENDIENTE"
    assert float(body["subtotal"]) == 300.0


def test_avanzar_estado_valido(client, pedidos_headers, client_headers, db_session, pedido_factory):
    cliente_id = _user_id(db_session, "cliente_test")
    pedido = pedido_factory(usuario_id=cliente_id, estado="PENDIENTE")
    r = client.post(f"/api/v1/pedidos/{pedido.id}/estado", headers=pedidos_headers,
                    json={"estado_hacia": "CONFIRMADO"})
    assert r.status_code == 200
    assert r.json()["estado_codigo"] == "CONFIRMADO"


def test_transicion_invalida_terminal(client, pedidos_headers, client_headers, db_session, pedido_factory):
    # RN-01: un estado terminal (ENTREGADO) no admite transiciones salientes
    cliente_id = _user_id(db_session, "cliente_test")
    pedido = pedido_factory(usuario_id=cliente_id, estado="ENTREGADO")
    r = client.post(f"/api/v1/pedidos/{pedido.id}/estado", headers=pedidos_headers,
                    json={"estado_hacia": "EN_PREP"})
    assert r.status_code == 422


def test_cancelar_requiere_motivo(client, pedidos_headers, client_headers, db_session, pedido_factory):
    # RN-05: motivo obligatorio al cancelar
    cliente_id = _user_id(db_session, "cliente_test")
    pedido = pedido_factory(usuario_id=cliente_id, estado="PENDIENTE")
    r = client.post(f"/api/v1/pedidos/{pedido.id}/estado", headers=pedidos_headers,
                    json={"estado_hacia": "CANCELADO"})
    assert r.status_code == 422


def test_cliente_cancela_confirmado(client, client_headers, db_session, pedido_factory):
    # El cliente SÍ puede cancelar su pedido mientras está CONFIRMADO (aún no en cocina)
    cliente_id = _user_id(db_session, "cliente_test")
    pedido = pedido_factory(usuario_id=cliente_id, estado="CONFIRMADO")
    r = client.post(f"/api/v1/pedidos/{pedido.id}/estado", headers=client_headers,
                    json={"estado_hacia": "CANCELADO", "motivo": "Cambié de idea"})
    assert r.status_code == 200
    assert r.json()["estado_codigo"] == "CANCELADO"


def test_cliente_no_cancela_en_prep(client, client_headers, db_session, pedido_factory):
    # En EN_PREP el cliente NO puede cancelar → 403 (solo ADMIN/PEDIDOS)
    cliente_id = _user_id(db_session, "cliente_test")
    pedido = pedido_factory(usuario_id=cliente_id, estado="EN_PREP")
    r = client.post(f"/api/v1/pedidos/{pedido.id}/estado", headers=client_headers,
                    json={"estado_hacia": "CANCELADO", "motivo": "Tarde"})
    assert r.status_code == 403


def test_pedidos_cancela_en_prep(client, pedidos_headers, client_headers, db_session, pedido_factory):
    # PEDIDOS sí puede cancelar desde EN_PREP
    cliente_id = _user_id(db_session, "cliente_test")
    pedido = pedido_factory(usuario_id=cliente_id, estado="EN_PREP")
    r = client.post(f"/api/v1/pedidos/{pedido.id}/estado", headers=pedidos_headers,
                    json={"estado_hacia": "CANCELADO", "motivo": "Sin stock"})
    assert r.status_code == 200
    assert r.json()["estado_codigo"] == "CANCELADO"


def test_listar_pedidos_envelope(client, client_headers, producto_factory):
    # El listado devuelve el envelope de paginación {items, total, page, size, pages}
    prod = producto_factory()
    client.post("/api/v1/pedidos/", headers=client_headers, json={
        "forma_pago_codigo": "EFECTIVO",
        "items": [{"producto_id": prod.id, "cantidad": 1}],
    })
    r = client.get("/api/v1/pedidos/", headers=client_headers)
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) >= {"items", "total", "page", "size", "pages"}
    assert body["total"] >= 1
    assert body["page"] == 1
    assert len(body["items"]) == body["total"]


def test_historial_primer_registro_estado_desde_null(client, client_headers, producto_factory):
    # RN-02: el primer registro de historial tiene estado_desde = None
    prod = producto_factory()
    creado = client.post("/api/v1/pedidos/", headers=client_headers, json={
        "forma_pago_codigo": "EFECTIVO",
        "items": [{"producto_id": prod.id, "cantidad": 1}],
    })
    pid = creado.json()["id"]
    hist = client.get(f"/api/v1/pedidos/{pid}/historial", headers=client_headers)
    assert hist.status_code == 200
    registros = hist.json()
    assert registros[0]["estado_desde"] is None
    assert registros[0]["estado_hacia"] == "PENDIENTE"
