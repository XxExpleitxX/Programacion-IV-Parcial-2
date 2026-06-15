"""
Registro central de modelos SQLModel.

Importar este paquete registra TODAS las tablas en SQLModel.metadata
(necesario antes de create_all y de las migraciones de Alembic).
Orden: catálogos sin FK → entidades → pivotes.
"""
from app.modules.unidades.unidad_medida import UnidadMedida          # noqa: F401
from app.modules.categorias.categoria import Categoria               # noqa: F401
from app.modules.ingredientes.ingrediente import Ingrediente         # noqa: F401
from app.modules.productos.producto import Producto                  # noqa: F401
from app.modules.productos.producto_categoria import ProductoCategoria      # noqa: F401
from app.modules.productos.producto_ingrediente import ProductoIngrediente  # noqa: F401
from app.modules.auth.usuario import Usuario, Rol, UsuarioRol, RefreshToken  # noqa: F401
from app.modules.pedidos.catalogs import FormaPago, EstadoPedido     # noqa: F401
from app.modules.direcciones.direccion_entrega import DireccionEntrega       # noqa: F401
from app.modules.pedidos.pedido import Pedido                        # noqa: F401
from app.modules.pedidos.detalle_pedido import DetallePedido         # noqa: F401
from app.modules.pedidos.historial_estado_pedido import HistorialEstadoPedido  # noqa: F401
from app.modules.pagos.pago import Pago                              # noqa: F401
