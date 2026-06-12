"""Tests del módulo de uploads Cloudinary con el SDK mockeado."""


def test_upload_imagen_ok(client, admin_headers, monkeypatch):
    def _fake_upload(contenido, **kwargs):
        return {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/foodstore/x.png",
            "public_id": "foodstore/productos/x",
            "width": 800, "height": 600, "format": "png", "resource_type": "image",
        }
    monkeypatch.setattr("cloudinary.uploader.upload", _fake_upload)

    r = client.post(
        "/api/v1/uploads/imagen",
        headers=admin_headers,
        files={"file": ("foto.png", b"fake-image-bytes", "image/png")},
        data={"folder": "productos"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["secure_url"].startswith("https://")
    assert body["public_id"] == "foodstore/productos/x"


def test_upload_rechaza_mime_invalido(client, admin_headers):
    # PDF no permitido (solo jpeg/png/webp)
    r = client.post(
        "/api/v1/uploads/imagen",
        headers=admin_headers,
        files={"file": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 400


def test_upload_requiere_admin(client, client_headers):
    r = client.post(
        "/api/v1/uploads/imagen",
        headers=client_headers,
        files={"file": ("foto.png", b"x", "image/png")},
    )
    assert r.status_code == 403
