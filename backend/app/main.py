from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import categorias, ingredientes, productos, auth
from app.routers.pedidos_router import router as pedidos_router
from app.routers.direcciones_router import router as direcciones_router
from app.core.database import create_db_and_tables
from app.routers.admin_router import router as admin_router
from app.routers.Umedida_router import router as umedida_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="Food Store API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(categorias.router)
app.include_router(ingredientes.router)
app.include_router(productos.router)
app.include_router(pedidos_router)
app.include_router(direcciones_router)
app.include_router(admin_router)
app.include_router(umedida_router)
