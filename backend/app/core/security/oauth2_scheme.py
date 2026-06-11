"""
Esquema de seguridad OAuth 2.0 — Password Flow.
Esta instancia es la que FastAPI usa para extraer el token Bearer
de los headers y para mostrar el botón "Authorize" en Swagger.
"""
from fastapi.security import OAuth2PasswordBearer

# tokenUrl: endpoint que devuelve el token cuando se autoriza desde Swagger
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/token")
