from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from app.routers import categorias, ingredientes, productos, auth
from app.routers.pedidos_router import router as pedidos_router
from app.routers.direcciones_router import router as direcciones_router
from app.routers.admin_router import router as admin_router
from app.routers.Umedida_router import router as umedida_router
from app.routers.uploads_router import router as uploads_router
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

# ─── Todas las rutas cuelgan de /api/v1 (spec v6, sección 5) ──────────────────
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

app.include_router(api)