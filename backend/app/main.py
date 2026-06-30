import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError

# Mapeo status → code semántico para el formato de error (RFC 7807 simplificado).
_ERROR_CODES = {
    400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN",
    404: "NOT_FOUND", 409: "CONFLICT", 422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
}

from app.modules.auth.router import router as auth_router
from app.modules.categorias.router import router as categorias_router
from app.modules.ingredientes.router import router as ingredientes_router
from app.modules.productos.router import router as productos_router
from app.modules.pedidos.router import router as pedidos_router
from app.modules.direcciones.router import router as direcciones_router
from app.modules.admin.router import router as admin_router
from app.modules.unidades.router import router as umedida_router
from app.modules.uploads.router import router as uploads_router
from app.modules.pagos.router import router as pago_router
from app.modules.estadisticas.router import router as estadisticas_router
from app.modules.ws.router import router as ws_router
from app.core.database import create_db_and_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="Food Store API",
    version="6.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Logging + timing de cada request (se ve por consola) ────────────────
@app.middleware("http")
async def log_y_timing(request: Request, call_next):
    inicio = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - inicio) * 1000
    print(f"[REQ] {request.method} {request.url.path} -> {response.status_code} ({ms:.1f} ms)")
    response.headers["X-Process-Time-ms"] = f"{ms:.1f}"
    return response


# ─── Errores con formato RFC 7807 (simplificado): {detail, code} ─────────
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "code": _ERROR_CODES.get(exc.status_code, "ERROR"),
        },
        headers=getattr(exc, "headers", None),
    )

# ─── Violaciones de integridad de BD → 409 limpio (en vez de 500) ────────
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    msg = str(getattr(exc, "orig", exc)).lower()
    if "duplicate" in msg or "1062" in msg or "unique" in msg:
        detail = "Ya existe un registro con ese valor (nombre o código duplicado)."
    else:
        detail = "Conflicto de integridad: el dato referencia algo inexistente o viola una restricción."
    print(f"[DB] IntegrityError en {request.method} {request.url.path}: {getattr(exc, 'orig', exc)}")
    return JSONResponse(status_code=409, content={"detail": detail, "code": "CONFLICT"})


# ─── Todas las rutas cuelgan de /api/v1 ──────────────────
api = APIRouter(prefix="/api/v1")
api.include_router(auth_router)
api.include_router(categorias_router)
api.include_router(ingredientes_router)
api.include_router(productos_router)
api.include_router(pedidos_router)
api.include_router(direcciones_router)
api.include_router(admin_router)
api.include_router(umedida_router)
api.include_router(uploads_router)
api.include_router(pago_router)          # Rutas de pago (MercadoPago)
api.include_router(estadisticas_router)  # Dashboard de estadísticas (ADMIN)
api.include_router(ws_router)            # WebSocket: /ws/pedidos/{id} y /ws/admin/pedidos

app.include_router(api)