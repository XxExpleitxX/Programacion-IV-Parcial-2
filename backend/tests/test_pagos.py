"""Tests de pagos MercadoPago con el SDK mockeado."""
from sqlmodel import select
from app.modules.auth.usuario import Usuario


def _user_id(db_session, username: str) -> int:
    return db_session.exec(select(Usuario).where(Usuario.username == username)).first().id


class _FakePayment:
    """Simula sdk.payment(): create() aprueba, get() reconsulta."""
    def __init__(self, store):
        self._store = store

    def create(self, data, request_options=None):
        self._store["external_reference"] = data["external_reference"]
        return {"response": {
            "id": 99, "status": "approved", "status_detail": "accredited",
            "payment_method_id": data.get("payment_method_id", "visa"),
            "external_reference": data["external_reference"],
            "transaction_amount": data["transaction_amount"],
        }}

    def get(self, payment_id):
        return {"response": {
            "id": int(payment_id), "status": "approved", "status_detail": "accredited",
            "external_reference": self._store.get("external_reference"),
            "payment_method_id": "visa",
        }}


class _FakeSDK:
    def __init__(self, store):
        self._p = _FakePayment(store)

    def payment(self):
        return self._p


def _crear_pedido_api(client, headers, producto_id) -> int:
    """Crea un pedido PENDIENTE vía la API (todo pasa por el UoW)."""
    r = client.post("/api/v1/pedidos/", headers=headers, json={
        "forma_pago_codigo": "MERCADOPAGO",
        "items": [{"producto_id": producto_id, "cantidad": 1}],
    })
    assert r.status_code == 201
    return r.json()["id"]


def test_crear_pago_aprobado_confirma_pedido(
    client, client_headers, producto_factory, monkeypatch
):
    store = {}
    monkeypatch.setattr("app.modules.pagos.service.get_sdk", lambda: _FakeSDK(store))

    prod = producto_factory()
    pedido_id = _crear_pedido_api(client, client_headers, prod.id)

    r = client.post("/api/v1/pagos/crear", headers=client_headers, json={
        "pedido_id": pedido_id, "token": "tok_test", "payment_method_id": "visa",
        "installments": 1, "payer_email": "cliente@test.com",
    })
    assert r.status_code == 201
    assert r.json()["mp_status"] == "approved"

    # El pago aprobado debe confirmar el pedido (PENDIENTE → CONFIRMADO)
    detalle = client.get(f"/api/v1/pedidos/{pedido_id}", headers=client_headers)
    assert detalle.json()["estado_codigo"] == "CONFIRMADO"


def test_webhook_actualiza_pago(
    client, client_headers, producto_factory, monkeypatch
):
    store = {}
    monkeypatch.setattr("app.modules.pagos.service.get_sdk", lambda: _FakeSDK(store))

    prod = producto_factory()
    pedido_id = _crear_pedido_api(client, client_headers, prod.id)
    client.post("/api/v1/pagos/crear", headers=client_headers, json={
        "pedido_id": pedido_id, "token": "tok", "payment_method_id": "visa",
        "installments": 1, "payer_email": "c@test.com",
    })

    # El IPN reconsulta el pago en MP y sincroniza
    r = client.post("/api/v1/pagos/webhook", json={"type": "payment", "data": {"id": "99"}})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
