"""
Configuración central de la aplicación.
Lee variables de entorno desde .env via python-dotenv.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Base de datos
    DB_HOST: str = "localhost"
    DB_PORT: str = "3306"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "parcial_programacion4"

    # JWT
    SECRET_KEY: str = "cambia-esto-en-produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7   # spec v6

    # Cookie
    COOKIE_NAME: str = "access_token"
    COOKIE_MAX_AGE: int = 1800   # 30 minutos en segundos
    COOKIE_SECURE: bool = False  # True en producción con HTTPS
    COOKIE_SAMESITE: str = "lax"

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()