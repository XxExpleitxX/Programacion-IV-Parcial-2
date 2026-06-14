"""
Tests del CRUD de productos.

Cubre la creación vía ProductoCreate (incluye el roundtrip de imagenes_url[] de
Cloudinary) y el control de acceso por rol ADMIN. Sirve además de regresión del
schema de precio_base (Decimal).
"""


def test_crear_producto_ok(client, admin_headers):
    r = client.post("/api/v1/productos/", headers=admin_headers, json={
        "nombre": "Pizza Napolitana",
        "descripcion": "Con tomate y albahaca",
        "precio_base": 1850.50,
        "stock_cantidad": 10,
        "imagenes_url": [
            "https://res.cloudinary.com/demo/image/upload/v1/foodstore/productos/pizza.jpg"
        ],
    })
    assert r.status_code == 201
    body = r.json()
    assert body["nombre"] == "Pizza Napolitana"
    assert float(body["precio_base"]) == 1850.50
    assert body["imagenes_url"] == [
        "https://res.cloudinary.com/demo/image/upload/v1/foodstore/productos/pizza.jpg"
    ]


def test_crear_producto_requiere_admin(client, client_headers):
    r = client.post("/api/v1/productos/", headers=client_headers, json={
        "nombre": "Hamburguesa",
        "precio_base": 900,
    })
    assert r.status_code == 403


def test_crear_producto_precio_negativo_rechazado(client, admin_headers):
    r = client.post("/api/v1/productos/", headers=admin_headers, json={
        "nombre": "Gaseosa",
        "precio_base": -10,
    })
    assert r.status_code == 422


def test_error_formato_rfc7807(client, admin_headers):
    # GET de un producto inexistente → 404 con {detail, code}
    r = client.get("/api/v1/productos/999999", headers=admin_headers)
    assert r.status_code == 404
    body = r.json()
    assert "detail" in body
    assert body["code"] == "NOT_FOUND"


def test_patch_stock_actualiza(client, admin_headers, producto_factory):
    prod = producto_factory(stock=5)
    r = client.patch(f"/api/v1/productos/{prod.id}/stock", headers=admin_headers,
                     json={"stock_cantidad": 42})
    assert r.status_code == 200
    assert r.json()["stock_cantidad"] == 42


def test_patch_stock_negativo_rechazado(client, admin_headers, producto_factory):
    prod = producto_factory()
    r = client.patch(f"/api/v1/productos/{prod.id}/stock", headers=admin_headers,
                     json={"stock_cantidad": -3})
    assert r.status_code == 422


def test_patch_stock_requiere_admin_o_stock(client, client_headers, producto_factory):
    prod = producto_factory()
    r = client.patch(f"/api/v1/productos/{prod.id}/stock", headers=client_headers,
                     json={"stock_cantidad": 10})
    assert r.status_code == 403


def test_listar_productos_incluye_creado(client, admin_headers):
    client.post("/api/v1/productos/", headers=admin_headers, json={
        "nombre": "Empanada", "precio_base": 500,
    })
    r = client.get("/api/v1/productos/", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    # Envelope de paginación
    assert set(body.keys()) >= {"items", "total", "page", "size", "pages"}
    nombres = [p["nombre"] for p in body["items"]]
    assert "Empanada" in nombres
    assert body["total"] >= 1
