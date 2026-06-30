import re

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, status, UploadFile

from app.core.config import settings

# Config del SDK al importar el módulo (instancia única). Usa las variables de entorno definidas en .env.
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB


async def subir_imagen(file: UploadFile, folder: str = "productos") -> dict:
    # Validación de tipo
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no permitido: {file.content_type}. Solo JPEG, PNG o WebP.",
        )
    contenido = await file.read()
    # Validación de tamaño
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


def public_id_de_url(url: str) -> str | None:
    partes = url.split("/upload/", 1)
    if len(partes) < 2:
        return None
    path = partes[1].split("?")[0].split("#")[0]
    m = re.search(r"v\d+/", path)          # quita el segmento de versión vNNN/
    if m:
        path = path[m.end():]
    path = re.sub(r"\.[^/.]+$", "", path)  # quita la extensión
    return path or None


def borrar_por_url(url: str) -> None:
    public_id = public_id_de_url(url)
    if not public_id:
        return
    try:
        cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception:
        pass   # el borrado del CDN no debe bloquear la baja del producto