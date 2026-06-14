from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# Mapeo status → code semántico para el formato de error (RFC 7807 simplificado).
_ERROR_CODES = {
    400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN",
    404: "NOT_FOUND", 409: "CONFLICT", 422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
}

from app.routers import categorias, ingredientes, productos, auth
from app.routers.pedidos_router import router as pedidos_router
from app.routers.direcciones_router import router as direcciones_router
from app.routers.admin_router import router as admin_router
from app.routers.Umedida_router import router as umedida_router
from app.routers.uploads_router import router as uploads_router
from app.routers import pago_router
from app.routers.estadisticas_router import router as estadisticas_router
from app.routers.ws_router import router as ws_router
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

# ─── Todas las rutas cuelgan de /api/v1 ──────────────────
api = APIRouter(prefix="/api/v1")
api.include_router(auth.router)
api.include_router(categorias.router)
api.include_router(ingredientes.router)
api.include_router(productos.router)
api.include_router(pedidos_router)
api.include_router(direcciones_router)
api.include_router(admin_router)
api.include_router(umedida_router)
api.include_router(uploads_router)
api.include_router(pago_router.router)  # Rutas de pago (MercadoPago)
api.include_router(estadisticas_router)  # Dashboard de estadísticas (ADMIN)
api.include_router(ws_router)            # WebSocket: /ws/pedidos/{id} y /ws/admin/pedidos

app.include_router(api)