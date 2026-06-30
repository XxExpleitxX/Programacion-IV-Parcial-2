from sqlmodel import select
from app.modules.auth.usuario import Usuario


def _user_id(db_session, username: str) -> int:
    return db_session.exec(select(Usuario).where(Usuario.username == username)).first().id


def test_resumen_requiere_admin(client, client_headers):
    # Un CLIENT no puede ver estadísticas
    r = client.get("/api/v1/estadisticas/resumen", headers=client_headers)
    assert r.status_code == 403


def test_resumen_admin_ok(client, admin_headers):
    r = client.get("/api/v1/estadisticas/resumen", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    for campo in ("ventas_hoy", "ticket_promedio", "pedidos_activos", "ventas_mes"):
        assert campo in body


def test_productos_top_excluye_cancelado(client, admin_headers, db_session, pedido_factory, producto_factory):
    # EST-01/EST-02: CANCELADO no suma; ingresos por subtotal_snap
    cliente_id = _user_id(db_session, "admin_test")
    prod = producto_factory(nombre="Pizza", precio=100.0)
    pedido_factory(usuario_id=cliente_id, producto=prod, cantidad=2, estado="ENTREGADO")   # 200, cuenta
    pedido_factory(usuario_id=cliente_id, producto=prod, cantidad=5, estado="CANCELADO")   # 500, NO cuenta

    r = client.get("/api/v1/estadisticas/productos-top", headers=admin_headers)
    assert r.status_code == 200
    fila = next(p for p in r.json() if p["producto_id"] == prod.id)
    assert float(fila["ingresos"]) == 200.0       # solo el ENTREGADO
    assert fila["cantidad_vendida"] == 2


def test_pedidos_por_estado(client, admin_headers, db_session, pedido_factory, producto_factory):
    cliente_id = _user_id(db_session, "admin_test")
    prod = producto_factory()
    pedido_factory(usuario_id=cliente_id, producto=prod, estado="PENDIENTE")
    pedido_factory(usuario_id=cliente_id, producto=prod, estado="ENTREGADO")

    r = client.get("/api/v1/estadisticas/pedidos-por-estado", headers=admin_headers)
    assert r.status_code == 200
    dist = {d["estado_codigo"]: d["cantidad"] for d in r.json()}
    assert dist.get("PENDIENTE", 0) >= 1
    assert dist.get("ENTREGADO", 0) >= 1
