"""
Servicio de uploads — Cloudinary (spec 10).
Valida MIME y tamaño, sube y elimina imágenes. No conoce HTTP más allá de las
excepciones de FastAPI que levanta ante input inválido.
"""
import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, status, UploadFile

from app.core.config import settings

# Config del SDK al importar el módulo (spec 10.3)
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB


async def subir_imagen(file: UploadFile, folder: str = "productos") -> dict:
    # Validación de tipo (spec: jpeg/png/webp)
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no permitido: {file.content_type}. Solo JPEG, PNG o WebP.",
        )
    contenido = await file.read()
    # Validación de tamaño (spec: max 5 MB)
    if len(contenido) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen supera el máximo de 5 MB.",
        )
    try:
        result = cloudinary.uploader.upload(
            contenido,
            folder=f"foodstore/{folder}",
            resource_type="image",
            allowed_formats=["jpg", "jpeg", "png", "webp"],
            overwrite=False,
            unique_filename=True,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error subiendo a Cloudinary: {e}")

    return {
        "secure_url":    result["secure_url"],
        "public_id":     result["public_id"],
        "width":         result.get("width", 0),
        "height":        result.get("height", 0),
        "format":        result.get("format", ""),
        "resource_type": result.get("resource_type", "image"),
    }


def eliminar_imagen(public_id: str) -> None:
    try:
        res = cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error eliminando en Cloudinary: {e}")
    # 'ok' = borrada, 'not found' = ya no estaba (idempotente, no es error)
    if res.get("result") not in ("ok", "not found"):
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar: {res.get('result')}")