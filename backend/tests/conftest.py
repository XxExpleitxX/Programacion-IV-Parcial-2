"""
Fixtures globales de test.

Estrategia de BD: SQLite in-memory (rápido, aislado por test). Se sobrescribe el
`engine` de MySQL que usan el UoW y get_session, SOLO durante los tests.
StaticPool → una única conexión in-memory compartida entre el TestClient y el UoW.

Auth: las fixtures *_headers devuelven el header Authorization Bearer, que sirve
tanto para la dependencia por cookie/header (deps.py) como para oauth2_scheme.
"""
import os
import tempfile
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel
from fastapi.testclient import TestClient

import app.core.database as db_mod
import app.unit_of_work as uow_mod
from app.main import app as fastapi_app
from app.core.security import hash_password
from app.models.usuarios.usuario import Usuario, UsuarioRol, Rol
from app.models.catalogs import FormaPago, EstadoPedido
from app.models.producto import Producto
from app.models.pedido import Pedido
from app.models.detalle_pedido import DetallePedido


# ── Engine SQLite (archivo temporal), parchea el engine real ──────────────────
# Usamos un archivo temporal en vez de ':memory:' + StaticPool porque FastAPI
# corre los endpoints SYNC en un threadpool: con una única conexión compartida
# entre hilos, los commits de los endpoints sync no persistían de forma fiable.
# Un archivo SQLite da conexiones independientes y commits durables/visibles.
@pytest.fixture
def engine():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    eng = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(eng)
    db_mod.engine = eng       # usado por get_session (deps)
    uow_mod.engine = eng      # usado por UnitOfWork
    yield eng
    eng.dispose()
    os.remove(path)


def _seed_catalogos(s: Session) -> None:
    for r in ("ADMIN", "STOCK", "PEDIDOS", "CLIENT"):
        if not s.get(Rol, r):
            s.add(Rol(codigo=r, nombre=r))
    estados = [
        ("PENDIENTE", 1, False), ("CONFIRMADO", 2, False), ("EN_PREP", 3, False),
        ("ENTREGADO", 4, True), ("CANCELADO", 5, True),
    ]
    for cod, orden, term in estados:
        if not s.get(EstadoPedido, cod):
            s.add(EstadoPedido(codigo=cod, descripcion=cod, orden=orden, es_terminal=term))
    for fp in ("MERCADOPAGO", "EFECTIVO", "TRANSFERENCIA"):
        if not s.get(FormaPago, fp):
            s.add(FormaPago(codigo=fp, descripcion=fp, habilitado=True))
    s.commit()


@pytest.fixture
def db_session(engine):
    with Session(engine) as s:
        _seed_catalogos(s)
        yield s


@pytest.fixture
def client(db_session):
    with TestClient(fastapi_app) as c:
        yield c


# ── Rate limiter: resetear entre tests (es un singleton en memoria) ───────────
@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    from app.core.rate_limit import login_limiter
    login_limiter._fails.clear()
    yield
    login_limiter._fails.clear()


# ── Helpers de auth ───────────────────────────────────────────────────────────
def _crear_usuario(db_session, username: str, rol: str) -> Usuario:
    u = Usuario(
        username=username, nombre="Test", apellido="User",
        email=f"{username}@test.com", hashed_password=hash_password("Secret123"),
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    db_session.add(UsuarioRol(usuario_id=u.id, rol_codigo=rol))
    db_session.commit()
    return u


def _login_headers(client, username: str) -> dict:
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": "Secret123"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client, db_session):
    _crear_usuario(db_session, "admin_test", "ADMIN")
    return _login_headers(client, "admin_test")


@pytest.fixture
def client_headers(client, db_session):
    u = _crear_usuario(db_session, "cliente_test", "CLIENT")
    headers = _login_headers(client, "cliente_test")
    headers["X-Usuario-Id"] = str(u.id)   # comodidad para los tests
    return headers


@pytest.fixture
def pedidos_headers(client, db_session):
    _crear_usuario(db_session, "pedidos_test", "PEDIDOS")
    return _login_headers(client, "pedidos_test")


# ── Factories ─────────────────────────────────────────────────────────────────
@pytest.fixture
def producto_factory(db_session):
    def _make(nombre="Hamburguesa", precio=100.0, stock=50, disponible=True) -> Producto:
        p = Producto(nombre=nombre, precio_base=precio, stock_cantidad=stock, disponible=disponible)
        db_session.add(p)
        db_session.commit()
        db_session.refresh(p)
        return p
    return _make


@pytest.fixture
def pedido_factory(db_session, producto_factory):
    def _make(usuario_id: int, producto=None, cantidad: int = 1, estado: str = "PENDIENTE") -> Pedido:
        producto = producto or producto_factory()
        precio = Decimal(str(producto.precio_base))
        sub = precio * cantidad
        ped = Pedido(
            usuario_id=usuario_id, estado_codigo=estado, forma_pago_codigo="EFECTIVO",
            subtotal=sub, descuento=Decimal("0.00"), costo_envio=Decimal("0.00"), total=sub,
        )
        db_session.add(ped)
        db_session.commit()
        db_session.refresh(ped)
        db_session.add(DetallePedido(
            pedido_id=ped.id, producto_id=producto.id, cantidad=cantidad,
            nombre_snapshot=producto.nombre, precio_snapshot=precio, subtotal_snap=sub,
        ))
        db_session.commit()
        return ped
    return _make
