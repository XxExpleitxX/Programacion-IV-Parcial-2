# Importar todos los modelos para que SQLModel los registre.
# Orden: catálogos sin FK → entidades → pivotes

from .unidad_medida import UnidadMedida      # catálogo sin dependencias
from .categoria import Categoria             # auto-referencia
from .ingrediente import Ingrediente
from .producto import Producto               # FK → UnidadMedida
from .producto_categoria import ProductoCategoria
from .producto_ingrediente import ProductoIngrediente  # FK → UnidadMedida
from .usuarios.usuario import Usuario, Rol, UsuarioRol, RefreshToken
from .catalogs import FormaPago, EstadoPedido
from .direccion_entrega import DireccionEntrega
from .pedido import Pedido
from .detalle_pedido import DetallePedido
from .historial_estado_pedido import HistorialEstadoPedido
from .pago import Pago
__all__ = [
    "UnidadMedida",
    "Categoria",
    "Ingrediente",
    "Producto",
    "ProductoCategoria",
    "ProductoIngrediente",
    "Usuario", "Rol", "UsuarioRol", "RefreshToken",
    "FormaPago", "EstadoPedido",
    "DireccionEntrega",
    "Pedido",
    "DetallePedido",
    "HistorialEstadoPedido",
    "Pago",
]
