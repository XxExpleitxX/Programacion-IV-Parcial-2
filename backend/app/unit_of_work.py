"""
Unit of Work — gestión transaccional atómica.

CAMBIO IMPORTANTE (devolución del profe — "no commits manuales"):
  Antes el ROUTER tenía que llamar uow.commit() a mano en cada endpoint.
  Ahora el commit es AUTOMÁTICO:
    - Si el bloque `with UnitOfWork()` termina sin error → __exit__ hace commit().
    - Si se lanza una excepción                          → __exit__ hace rollback().
    - En ambos casos se cierra la sesión.

  Resultado: NADIE llama commit() a mano (ni el router, ni el service, ni el seed).
  La transacción es atómica y la coordina un solo lugar: este Unit of Work.
"""

from sqlmodel import Session
from app.core.database import engine
from app.repositories import (
    CategoriaRepository,
    IngredienteRepository,
    ProductoRepository,
)
from app.repositories.pedido_repository import PedidoRepository, DetallePedidoRepository
from app.repositories.historial_estado_pedido_repository import HistorialEstadoPedidoRepository
from app.repositories.catalogo_repository import FormaPagoRepository, EstadoPedidoRepository, UnidadMedidaRepository
from app.repositories.pagos_repository import PagoRepository
from app.repositories.estadisticas_repository import EstadisticasRepository
from app.repositories.direccion_repository import DireccionRepository
from app.models.usuarios.usuario_repository import UsuarioRepository, RolRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.core.websocket import manager


class UnitOfWork:
    def __init__(self):
        self.session:      Session                       | None = None
        self.categorias:   CategoriaRepository           | None = None
        self.ingredientes: IngredienteRepository         | None = None
        self.productos:    ProductoRepository            | None = None
        self.pedidos:      PedidoRepository              | None = None
        self.detalles:     DetallePedidoRepository       | None = None   
        self.historial:    HistorialEstadoPedidoRepository | None = None
        self.formas_pago:  FormaPagoRepository           | None = None   
        self.pagos:        PagoRepository                | None = None
        self.estadisticas: EstadisticasRepository        | None = None
        self.estados:      EstadoPedidoRepository        | None = None
        self.unidades:     UnidadMedidaRepository        | None = None
        self.direcciones:  DireccionRepository           | None = None
        self.usuarios:     UsuarioRepository             | None = None
        self.roles:        RolRepository                 | None = None
        self.refresh_tokens: RefreshTokenRepository       | None = None
        # Eventos WS encolados durante la transacción → se emiten POST-commit (RN-06)
        self.events: list[tuple[int, dict]] = []

    def __enter__(self) -> "UnitOfWork":
        self.session      = Session(engine)
        self.categorias   = CategoriaRepository(self.session)
        self.ingredientes = IngredienteRepository(self.session)
        self.productos    = ProductoRepository(self.session)
        self.pedidos      = PedidoRepository(self.session)
        self.detalles     = DetallePedidoRepository(self.session)
        self.historial    = HistorialEstadoPedidoRepository(self.session)
        self.formas_pago  = FormaPagoRepository(self.session)
        self.pagos        = PagoRepository(self.session)
        self.estadisticas = EstadisticasRepository(self.session)
        self.estados      = EstadoPedidoRepository(self.session)
        self.unidades     = UnidadMedidaRepository(self.session)
        self.direcciones  = DireccionRepository(self.session)
        self.usuarios     = UsuarioRepository(self.session)
        self.roles        = RolRepository(self.session)
        self.refresh_tokens = RefreshTokenRepository(self.session)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Commit automático si todo salió bien; rollback si hubo cualquier error.
        if exc_type is not None:
            self.session.rollback()
        else:
            self.session.commit()       
        self.session.close()

    # Estos métodos siguen existiendo por si se necesitan,
    # pero el código de negocio ya NO los llama a mano.
    def rollback(self) -> None:
        self.session.rollback()

    def flush(self) -> None:
        """Empuja los cambios a la BD sin commitear (sirve para obtener IDs autogenerados)."""
        self.session.flush()

    def refresh(self, entity) -> None:
        self.session.refresh(entity)

    def emit_pedido_event(self, pedido_id: int, evento: dict) -> None:
        """Encola un evento WS para emitirlo DESPUÉS del commit (RN-06)."""
        self.events.append((pedido_id, evento))


async def get_uow():
    """
    Dependencia de FastAPI. Abre el UoW para el request y lo cierra al final.
    - El commit/rollback es automático (vía __exit__).
    - DESPUÉS del commit exitoso, emite por WebSocket los eventos encolados
      durante la transacción (RN-06: broadcast post-commit, fuera del bloque UoW).
      Si hubo excepción, el __exit__ hace rollback y NO se emite nada.
    """
    with UnitOfWork() as uow:
        yield uow
    # Acá el bloque `with` ya cerró → commit hecho. Recién ahora notificamos.
    for pedido_id, evento in uow.events:
        await manager.broadcast_pedido(pedido_id, evento)