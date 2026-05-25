"""
Schemas del Dominio 3 — request / response para Pedidos.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, field_validator


# ── DireccionEntrega ─────────────────────────────────────────────────────────

class DireccionCreate(BaseModel):
    alias:         Optional[str] = None
    linea1:        str
    linea2:        Optional[str] = None
    ciudad:        str
    provincia:     Optional[str] = None
    codigo_postal: Optional[str] = None
    latitud:       Optional[Decimal] = None
    longitud:      Optional[Decimal] = None
    es_principal:  bool = False

class DireccionRead(DireccionCreate):
    id:         int
    usuario_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── DetallePedido (request al crear) ────────────────────────────────────────

class ItemPedidoRequest(BaseModel):
    producto_id:     int
    cantidad:        int
    personalizacion: Optional[List[int]] = None  # IDs de ingredientes removidos

    @field_validator("cantidad")
    @classmethod
    def cantidad_positiva(cls, v: int) -> int:
        if v < 1:
            raise ValueError("cantidad debe ser >= 1")
        return v


class DetallePedidoRead(BaseModel):
    pedido_id:       int
    producto_id:     int
    cantidad:        int
    nombre_snapshot: str
    precio_snapshot: Decimal
    subtotal_snap:   Decimal
    personalizacion: Optional[List[int]]
    created_at:      datetime

    class Config:
        from_attributes = True


# ── Pedido ───────────────────────────────────────────────────────────────────

class PedidoCreate(BaseModel):
    direccion_id:      Optional[int] = None
    forma_pago_codigo: str
    notas:             Optional[str] = None
    items:             List[ItemPedidoRequest]


class PedidoRead(BaseModel):
    id:                int
    usuario_id:        int
    direccion_id:      Optional[int]
    estado_codigo:     str
    forma_pago_codigo: str
    subtotal:          Decimal
    descuento:         Decimal
    costo_envio:       Decimal
    total:             Decimal
    notas:             Optional[str]
    created_at:        datetime
    updated_at:        datetime
    detalles:          List[DetallePedidoRead] = []

    class Config:
        from_attributes = True


# ── HistorialEstadoPedido ────────────────────────────────────────────────────

class HistorialRead(BaseModel):
    id:           int
    pedido_id:    int
    estado_desde: Optional[str]
    estado_hacia: str
    usuario_id:   Optional[int]
    motivo:       Optional[str]
    created_at:   datetime

    class Config:
        from_attributes = True


# ── Avanzar estado ───────────────────────────────────────────────────────────

class AvanzarEstadoRequest(BaseModel):
    estado_hacia: str
    motivo:       Optional[str] = None

    @field_validator("motivo")
    @classmethod
    def motivo_requerido_si_cancelado(cls, v, info):
        estado = info.data.get("estado_hacia", "")
        if estado == "CANCELADO" and not v:
            raise ValueError("motivo es obligatorio al cancelar un pedido")
        return v
