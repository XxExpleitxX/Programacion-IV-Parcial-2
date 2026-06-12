"""
Router de uploads — Cloudinary.
POST   /uploads/imagen              → sube imagen (multipart/form-data), ADMIN
DELETE /uploads/imagen/{public_id}  → elimina por public_id, ADMIN
"""
from typing import Annotated
from fastapi import APIRouter, Depends, UploadFile, File, Form, status

from app.core.deps import require_role
from app.models.usuarios.usuario import Usuario
from app.schemas.uploads_schema import CloudinaryResponse
from app.services.uploads_service import subir_imagen, eliminar_imagen

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("/imagen", response_model=CloudinaryResponse, status_code=status.HTTP_201_CREATED)
async def upload_imagen(
    _: Annotated[Usuario, Depends(require_role(["ADMIN"]))],
    file: UploadFile = File(...),
    folder: str = Form("productos"),
):
    """Sube una imagen a Cloudinary y devuelve secure_url + public_id."""
    return await subir_imagen(file, folder)


@router.delete("/imagen/{public_id:path}", status_code=status.HTTP_204_NO_CONTENT)
def delete_imagen(
    public_id: str,
    _: Annotated[Usuario, Depends(require_role(["ADMIN"]))],
):
    """Elimina una imagen de Cloudinary por su public_id (puede tener '/')."""
    eliminar_imagen(public_id)