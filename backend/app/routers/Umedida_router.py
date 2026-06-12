from typing import Annotated, List
from fastapi import APIRouter, Depends
from app.unit_of_work import UnitOfWork, get_uow
from app.models.unidad_medida import UnidadMedida
from app.core.security import require_authenticated
from app.models import Usuario

router = APIRouter(prefix="/unidades-medida", tags=["Unidades de Medida"])

UoWDep = Annotated[UnitOfWork, Depends(get_uow)]

@router.get("/", response_model=List[UnidadMedida])
def listar_unidades(
    uow: UoWDep,
    user: Usuario = Depends(require_authenticated),
):
    # Vía repo (antes: uow.session.exec(select(...)) directo en el router)
    return uow.unidades.list_all()