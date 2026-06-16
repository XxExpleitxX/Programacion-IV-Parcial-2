# 🍔 Food Store — Sistema de Gestión de Pedidos de Comida

Aplicación **full-stack** para la gestión integral de un negocio de comidas: catálogo, carrito, pedidos con pago vía **MercadoPago**, seguimiento en **tiempo real por WebSocket** e imágenes gestionadas con **Cloudinary**.

**Stack:** FastAPI + SQLModel + MySQL · React + TypeScript + Vite · TanStack Query · Zustand · WebSocket · Cloudinary · MercadoPago Checkout PRO




---

## Integrantes

| Integrante |
|---|
| Matias Martinez |
| Carla Bustos |
| Dario Sinatra |
| Emanuel Ortiz |

---

## Videos de entrega

| Instancia | Link de YouTube |
|---|---|
| Video Parcial 1 | https://youtu.be/OqynLC-KjSQ |
| Video Final TPI |  |

---
## ✨ Funcionalidades

- **Autenticación JWT** (access 30 min + refresh 7 días) con **invalidación de refresh token**, cookie httpOnly y **rate limiting** (5 intentos fallidos por IP / 15 min → HTTP 429).
- **RBAC con 4 roles**: `ADMIN`, `STOCK`, `PEDIDOS`, `CLIENT`.
- **Catálogo**: categorías jerárquicas, productos, ingredientes (con `es_alergeno`) y unidades de medida.
- **Carrito** persistente (Zustand + localStorage).
- **Pedidos** con **máquina de estados (FSM) de 5 estados** y **audit trail append-only** (`HistorialEstadoPedido`).
- **Pagos MercadoPago**: creación de pago con `idempotency_key`, webhook IPN y registro completo de la transacción.
- **WebSocket en tiempo real**: notificación de cambios de estado por canal de pedido y canal admin, broadcast **post-commit**.
- **Cloudinary**: subida y borrado de imágenes (validación de MIME y tamaño).
- **Dashboard de estadísticas** (solo ADMIN): ventas por período, top de productos, distribución por estado, ingresos por forma de pago.
- **Tests con pytest** (auth, pedidos, pagos, uploads, estadísticas).

---

## 🗂 Estructura del proyecto

```
proyecto_parcial/
├── backend/                     # API FastAPI
│   ├── .env.example             # plantilla de variables de entorno (CE-03)
│   ├── requirements.txt
│   ├── tests/                   # pytest (conftest + test_auth/pedidos/pagos/uploads/estadisticas)
│   └── app/  (Feature-First — módulos por dominio)
│       ├── main.py              # app + CORS + handler RFC 7807 + montaje bajo /api/v1
│       ├── unit_of_work.py      # UoW: commit/rollback automático + eventos WS post-commit
│       ├── modules/             # un paquete por feature: router + service + repository + MODEL(s)
│       │                        #   auth · categorias · ingredientes · productos · pedidos ·
│       │                        #   pagos · uploads · estadisticas · direcciones · unidades · admin · ws
│       │                        # (modules/__init__.py registra todos los modelos en SQLModel.metadata)
│       ├── core/                # config, database, deps, websocket, mercado_pago_cliente, rate_limit, security/
│       ├── repositories/        # solo infra compartida: BaseRepository[T] genérico + repos de catálogo/auth
│       ├── schemas/             # Pydantic v2 (Create / Update / Read + pagination)
│       ├── alembic/             # migraciones (env.py + versions/) — alembic upgrade head
│       └── db/seed.py           # seed obligatorio (roles, estados, formas de pago, unidades, admin)
│
├── frontend-store/              # Tienda (cliente) — React + Vite
│   └── src/  (Feature-Sliced Design)
│       ├── features/   auth · catalogo · carrito · checkout · pedidos
│       ├── shared/     api · components · hooks · types · utils
│       └── store/      authStore · carritoStore · wsStore · uiStore · pagoStore
│
└── frontend-admin/              # Panel de administración — React + Vite
    └── src/  (Feature-Sliced Design)
        ├── features/   auth · dashboard · productos · categorias · ingredientes · pedidos · stock
        ├── shared/     api · components · hooks · types · utils
        ├── store/      authStore · wsStore
        └── routes/     PrivateRoute
```

### Arquitectura (regla de oro del backend)

```
Router → Service → Unit of Work → Repository → Model
```

- **Router**: HTTP puro (parsea request, delega al Service, serializa response). No toca la BD.
- **Service**: lógica de negocio, stateless. Orquesta repos a través del UoW. **Nunca** hace `commit`.
- **Unit of Work**: único punto de `commit`/`rollback` (automático en `__exit__`). Emite los eventos WebSocket **después** del commit.
- **Repository**: única capa que ejecuta queries (`BaseRepository[T]` genérico).
- **Model**: tablas SQLModel.

---

## ⚙️ Requisitos previos

- **Python 3.11+**
- **Node.js 18+** y **pnpm** (`npm install -g pnpm` o `corepack enable`)
- **XAMPP** y **DOCKER** con **MySQL** corriendo en el puerto `3306`

---

## 🚀 Instalación y puesta en marcha (máquina limpia)

### 1. Crear la base de datos

En phpMyAdmin (`http://localhost/phpmyadmin`) ejecutá:

```sql
CREATE DATABASE parcial_programacion4 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend

```bash
cd backend

# Entorno virtual
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Dependencias
pip install -r requirements.txt

# Variables de entorno: copiar la plantilla y completar
# Windows:
copy .env.example .env
# Mac/Linux:
cp .env.example .env


# (Opcional) Migraciones con Alembic — el esquema también se crea solo al iniciar la app
alembic upgrade head

# Seed obligatorio (roles, estados, formas de pago, unidades de medida y admin)
python -m app.db.seed

# Levantar la API
uvicorn app.main:app --reload --port 8000
```

- API: **http://localhost:8000**
- Swagger UI: **http://localhost:8000/docs** · ReDoc: **http://localhost:8000/redoc**

> Las tablas se crean automáticamente al iniciar la app. Todos los endpoints cuelgan de `/api/v1`.

### 3. Frontends

**Tienda (cliente):**
```bash
cd frontend-store
pnpm install
pnpm dev             # http://localhost:5173
```

**Panel de administración:**
```bash
cd frontend-admin
pnpm install
pnpm dev             # http://localhost:5174
```

> Ambos frontends apuntan a `http://localhost:8000` (definido en `src/api/axiosInstance.ts`). El CORS del backend ya permite los puertos `5173` y `5174`.

### 4. Credenciales (seed)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `admin@foodstore.com` | `Admin1234!` | `ADMIN` |
| `stock@foodstore.com` | `Stock1234!` | `STOCK` |
| `pedidos@foodstore.com` | `Pedidos1234!` | `PEDIDOS` |
| `cliente@foodstore.com` | `Cliente1234!` | `CLIENT` |

---

## 🔑 Variables de entorno (`backend/.env`)

Ver plantilla completa en [`backend/.env.example`](./backend/.env.example).

| Variable | Descripción |
|----------|-------------|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Conexión MySQL |
| `SECRET_KEY` | Clave para firmar el JWT (mín. 32 caracteres) |
| `ALGORITHM` · `ACCESS_TOKEN_EXPIRE_MINUTES` · `REFRESH_TOKEN_EXPIRE_DAYS` | Configuración JWT |
| `COOKIE_NAME` · `COOKIE_MAX_AGE` · `COOKIE_SECURE` · `COOKIE_SAMESITE` | Cookie del access token |
| `MP_ACCESS_TOKEN` · `MP_PUBLIC_KEY` · `MP_WEBHOOK_SECRET` | MercadoPago |
| `CLOUDINARY_CLOUD_NAME` · `CLOUDINARY_API_KEY` · `CLOUDINARY_API_SECRET` | Cloudinary |

---

## 📡 API REST (prefijo `/api/v1`)

| Módulo | Rutas principales |
|--------|-------------------|
| **Auth** | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| **Productos** | `GET /productos` · `GET /productos/{id}` · `POST /productos` · `PUT /productos/{id}` · `PATCH /productos/{id}/disponibilidad` · `DELETE /productos/{id}` |
| **Categorías** | `GET/POST /categorias` · `GET/PUT/DELETE /categorias/{id}` |
| **Ingredientes** | `GET/POST /ingredientes` · `GET/PUT/DELETE /ingredientes/{id}` |
| **Unidades de medida** | `GET /unidades-medida` |
| **Pedidos** | `POST /pedidos` · `GET /pedidos` · `GET /pedidos/{id}` · `POST /pedidos/{id}/estado` · `GET /pedidos/{id}/historial` |
| **Direcciones** | `POST /direcciones` · `GET /direcciones` · `PATCH /direcciones/{id}/principal` · `DELETE /direcciones/{id}` |
| **Pagos (MercadoPago)** | `POST /pagos/crear` (CardPayment) · `POST /pagos/preferencia` (Checkout PRO) · `POST /pagos/confirmar` · `POST /pagos/verificar` · `POST /pagos/webhook` · `GET /pagos/{pedido_id}` |
| **Uploads (Cloudinary)** | `POST /uploads/imagen` · `DELETE /uploads/imagen/{public_id}` |
| **Admin** | gestión de usuarios y roles (solo `ADMIN`) |
| **Estadísticas** | `GET /estadisticas/resumen` · `/ventas` · `/productos-top` · `/pedidos-por-estado` · `/ingresos` (solo `ADMIN`) |

La documentación interactiva completa está en **`/docs`**.

---

## 🔌 WebSocket — seguimiento en tiempo real

```
ws://localhost:8000/api/v1/ws/pedidos/{pedido_id}?token=<access_token>   # canal de un pedido (cliente)
ws://localhost:8000/api/v1/ws/admin/pedidos?token=<access_token>          # feed de todos (ADMIN/PEDIDOS)
```

- **`/ws/pedidos/{id}`** → suscribe al canal de ese pedido (el cliente que lo sigue).
- **`/ws/admin/pedidos`** → feed de todos los pedidos (solo `ADMIN`/`PEDIDOS`).
- El broadcast se dispara **después del commit** del Unit of Work.
- En el frontend lo encapsula el hook `useOrderStatusWS` (reconexión exponencial + badge de conexión + resync al reconectar).

---

## 📄 Convenciones de la API

- **Paginación** (envelope estándar): los listados `GET /productos` y `GET /pedidos` aceptan `?page=1&size=20` y devuelven
  ```json
  { "items": [...], "total": 42, "page": 1, "size": 20, "pages": 3 }
  ```
- **Errores** (RFC 7807 simplificado): `{ "detail": "mensaje", "code": "NOT_FOUND" }`.

---

## 🧪 Tests

Suite con **pytest** sobre **SQLite** (archivo temporal aislado por test; no toca la base MySQL real):

```bash
cd backend
.venv\Scripts\activate          # o: source .venv/bin/activate

pytest                          # correr toda la suite
pytest --cov=app                # con reporte de cobertura
```

**38 tests · cobertura ~78%.** Cubre: registro/login/logout/refresh, rate limiting, FSM de pedidos, historial append-only (RN-02), reglas de cancelación por rol (RN-05: cliente cancela en PENDIENTE/CONFIRMADO, no en EN_PREP), pagos MercadoPago (SDK mockeado), uploads Cloudinary (SDK mockeado), estadísticas (RBAC + exclusión de cancelados), **WebSocket** (`websocket_connect`: broadcast post-commit al canal del pedido y al feed admin, cierre por token inválido y por token expirado 4001), **productos** (CRUD + stock + roundtrip de `imagenes_url` + borrado en Cloudinary), **paginación** (envelope) y **formato de error** (RFC 7807).

---

## 🏗 Patrones aplicados

- **Unit of Work** — transacciones atómicas con commit/rollback automático.
- **Repository Pattern** — `BaseRepository[T]` genérico; única capa con acceso a BD.
- **Service Layer** — lógica de negocio stateless e independiente del framework.
- **Snapshot Pattern** — nombre y precio del producto quedan congelados en `DetallePedido`.
- **Soft Delete** — `deleted_at` en entidades de negocio (nunca DELETE físico).
- **Audit Trail Append-Only** — `HistorialEstadoPedido`: solo INSERT.
- **State Machine (FSM)** — transiciones de pedido validadas en el Service.
- **Idempotent Payments** — `idempotency_key` UUID hacia MercadoPago.
- **Custom Hooks / TanStack Query / Zustand** — estado de servidor vs. estado de cliente separados en el frontend.

---

## 📋 Checklist de entrega

Ver [CHECKLIST.md](./CHECKLIST.md).
