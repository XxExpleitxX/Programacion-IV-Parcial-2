from fastapi.security import OAuth2PasswordBearer

# tokenUrl: endpoint que devuelve el token cuando se autoriza desde Swagger
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/token")
