# 🍔 Food Store — Sistema de Gestión de Pedidos de Comida

Aplicación **full-stack** para la gestión integral de un negocio de comidas: catálogo, carrito, pedidos con pago vía **MercadoPago**, seguimiento en **tiempo real por WebSocket** e imágenes gestionadas con **Cloudinary**.

**Stack:** FastAPI + SQLModel + MySQL · React + TypeScript + Vite · TanStack Query · Zustand · WebSocket · Cloudinary · MercadoPago Checkout PRO

> **Nota sobre la base de datos:** el sistema corre sobre **MySQL (XAMPP)**, uso aprobado por la cátedra para esta entrega.

---

## 👥 Integrantes del grupo

- Matias Martinez
- Carla Bustos
- Dario Sinatra
- Emanuel Ortiz

## 🎥 Video de demostración (10–15 min)

> Demuestra WebSocket y Cloudinary en vivo.

🔗 https://youtu.be/OqynLC-KjSQ

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
│   └── app/
│       ├── main.py              # app + CORS + montaje de routers bajo /api/v1
│       ├── unit_of_work.py      # UoW: commit/rollback automático + eventos WS post-commit
│       ├── core/                # config, database, deps, websocket, mercado_pago_cliente, rate_limit, security/
│       ├── models/              # SQLModel (usuarios/, producto, pedido, pago, ...)
│       ├── repositories/        # ÚNICA capa que toca la BD (BaseRepository[T] genérico)
│       ├── services/            # lógica de negocio (stateless, sin commits)
│       ├── schemas/             # Pydantic v2 (Create / Update / Read separados)
│       ├── routers/             # auth, productos, categorias, ingredientes, unidades,
│       │                        # pedidos, direcciones, admin, pagos, uploads, estadisticas
│       └── db/seed.py           # seed obligatorio (roles, estados, formas de pago, unidades, admin)
│
├── frontend-store/              # Tienda (cliente) — React + Vite — http://localhost:5173
│   └── src/  (api · store[Zustand] · hooks[useOrderStatusWS] · pages · components · types)
│
└── frontend-admin/              # Panel de administración — React + Vite — http://localhost:5174
    └── src/  (api · context · hooks[useOrderStatusWS] · pages · components · routes · types)
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
- **XAMPP** con **MySQL** corriendo en el puerto `3306`

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
#   → editar .env: DB_PASSWORD si tu MySQL tiene clave, y las credenciales
#     de MercadoPago y Cloudinary si vas a probar pagos / subida de imágenes.

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

### 4. Credenciales del administrador (seed)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `admin@foodstore.com` | `Admin1234!` | `ADMIN` |

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
| **Pagos (MercadoPago)** | `POST /pagos/crear` · `POST /pagos/webhook` · `GET /pagos/{pedido_id}` |
| **Uploads (Cloudinary)** | `POST /uploads/imagen` · `DELETE /uploads/imagen/{public_id}` |
| **Admin** | gestión de usuarios y roles (solo `ADMIN`) |
| **Estadísticas** | `GET /estadisticas/resumen` · `/ventas` · `/productos-top` · `/pedidos-por-estado` · `/ingresos` (solo `ADMIN`) |

La documentación interactiva completa está en **`/docs`**.

---

## 🔌 WebSocket — seguimiento en tiempo real

```
ws://localhost:8000/api/v1/pedidos/ws?token=<access_token>[&pedido_id=<id>]
```

- **Con `pedido_id`** → suscribe al canal de ese pedido (el cliente que lo sigue).
- **Sin `pedido_id`** → feed `admin` de todos los pedidos (solo `ADMIN`/`PEDIDOS`).
- El broadcast se dispara **después del commit** del Unit of Work.
- En el frontend lo encapsula el hook `useOrderStatusWS` (reconexión exponencial + indicador de conexión).

---

## 🧪 Tests

Suite con **pytest** sobre **SQLite in-memory** (no toca la base MySQL real):

```bash
cd backend
.venv\Scripts\activate          # o: source .venv/bin/activate

pytest                          # correr toda la suite
pytest --cov=app                # con reporte de cobertura
```

Cubre: registro/login/logout/refresh, rate limiting, FSM de pedidos, historial append-only (RN-02), reglas de cancelación (RN-05), pagos MercadoPago (SDK mockeado), uploads Cloudinary (SDK mockeado) y estadísticas (RBAC + exclusión de cancelados).

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
