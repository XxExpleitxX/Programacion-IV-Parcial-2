# Parcial Programación IV — Fullstack FastAPI + React

Aplicación fullstack que integra FastAPI (backend), React + TypeScript (frontend), TanStack Query para estado de servidor y MySQL (XAMPP) como base de datos.

## 🎥 Video de presentación

> _Subir el link al video aquí después de grabarlo._

---

## 🗂 Estructura del proyecto

```
proyecto_parcial/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   └── database.py        # Conexión MySQL + engine SQLModel
│   │   ├── models/
│   │   │   └── __init__.py        # Clases SQLModel (tablas + relaciones)
│   │   ├── schemas/
│   │   │   └── __init__.py        # Schemas Pydantic request/response
│   │   ├── routers/
│   │   │   ├── categorias.py      # Endpoints con Annotated + Query
│   │   │   ├── ingredientes.py
│   │   │   └── productos.py
│   │   ├── services/
│   │   │   ├── categoria_service.py
│   │   │   ├── ingrediente_service.py
│   │   │   └── producto_service.py
│   │   └── main.py                # FastAPI app + CORS + startup
│   ├── .env                       # Variables de entorno (DB)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api/index.ts           # Funciones fetch tipadas
    │   ├── types/index.ts         # Interfaces TypeScript
    │   ├── components/Modal.tsx   # Componente reutilizable
    │   ├── pages/
    │   │   ├── CategoriasPage.tsx
    │   │   ├── IngredientesPage.tsx
    │   │   ├── ProductosPage.tsx
    │   │   └── ProductoDetallePage.tsx  # Ruta dinámica /productos/:id
    │   ├── App.tsx                # Router + navegación
    │   └── main.tsx               # QueryClient + BrowserRouter
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

---

## ⚙️ Requisitos previos

- **Python 3.11+**
- **Node.js 18+** y **npm**
- **XAMPP** con MySQL corriendo en el puerto `3306`
- **phpMyAdmin** para administrar la base de datos

---

## 🚀 Instalación y puesta en marcha

### 1. Crear la base de datos en phpMyAdmin

Abrí phpMyAdmin (`http://localhost/phpmyadmin`) y ejecutá:

```sql
CREATE DATABASE parcial_programacion4 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

### 2. Configurar y levantar el Backend

Abrí una terminal en la carpeta `backend/` y ejecutá los siguientes comandos:

```bash
# Entrar a la carpeta del backend
cd backend

# Crear entorno virtual
python -m venv .venv

# Activar entorno virtual
# En Windows:
.venv\Scripts\activate
.venv/Scripts/activate
# En Mac/Linux:
source .venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# (Opcional) Verificar que el .env tiene los datos correctos
# Por defecto: host=localhost, puerto=3306, usuario=root, contraseña vacía
# Si tu MySQL tiene contraseña, editá el archivo .env

# Levantar el servidor de desarrollo
uvicorn app.main:app --reload --port 8000
```

La API estará disponible en: **http://localhost:8000**  
Documentación interactiva (Swagger): **http://localhost:8000/docs**

> ✅ Las tablas se crean automáticamente al iniciar la aplicación por primera vez.

---

### 3. Configurar y levantar el Frontend

Abrí **otra terminal** en la carpeta `frontend/` y ejecutá:

```bash
# Entrar a la carpeta del frontend
cd frontend

# Instalar dependencias
npm install

# Levantar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en: **http://localhost:5173**

---

## 🔑 Variables de entorno (backend/.env)

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=         # Dejá vacío si no tiene contraseña (XAMPP por defecto)
DB_NAME=parcial_programacion4
```

---

## 📡 Endpoints disponibles

### Categorías
| Método | URL | Descripción |
|--------|-----|-------------|
| GET | `/categorias/` | Listar (paginación + filtro por nombre) |
| GET | `/categorias/{id}` | Obtener por ID |
| POST | `/categorias/` | Crear |
| PUT | `/categorias/{id}` | Actualizar |
| DELETE | `/categorias/{id}` | Eliminar |

### Ingredientes
| Método | URL | Descripción |
|--------|-----|-------------|
| GET | `/ingredientes/` | Listar (paginación + filtro) |
| GET | `/ingredientes/{id}` | Obtener por ID |
| POST | `/ingredientes/` | Crear |
| PUT | `/ingredientes/{id}` | Actualizar |
| DELETE | `/ingredientes/{id}` | Eliminar |

### Productos
| Método | URL | Descripción |
|--------|-----|-------------|
| GET | `/productos/` | Listar (filtro por nombre y activo) |
| GET | `/productos/{id}` | Obtener con relaciones completas |
| POST | `/productos/` | Crear con categorías e ingredientes |
| PUT | `/productos/{id}` | Actualizar |
| DELETE | `/productos/{id}` | Eliminar |

---

## 🏗 Decisiones técnicas

### Backend
- **SQLModel** unifica Pydantic + SQLAlchemy para definir modelos y schemas en una sola clase.
- Las relaciones N:N (Producto↔Categoria, Producto↔Ingrediente) se implementan mediante tablas pivote con `Relationship` y `back_populates`.
- Se usa `Annotated` + `Query` para validar parámetros de paginación y filtrado directamente en la firma de la función.
- Los `response_model` separan los datos de entrada (schemas de creación) de los datos de salida (schemas de lectura), evitando exponer datos innecesarios.
- Las excepciones se manejan con `HTTPException` para retornar los códigos HTTP correctos (201, 204, 404).

### Frontend
- **TanStack Query** gestiona el estado del servidor: `useQuery` para lecturas y `useMutation` para escrituras.
- Después de cada mutación exitosa se llama `queryClient.invalidateQueries()` para refrescar la caché automáticamente.
- Las props de todos los componentes están tipadas con interfaces TypeScript, evitando el uso de `any`.
- **React Router DOM** maneja la navegación: `/productos/:id` es una ruta dinámica que usa `useParams()` para obtener el ID.
- **Tailwind CSS** se usa de forma consistente mediante clases de utilidad y componentes reutilizables definidos en `index.css`.

### Desafío resuelto
La gestión de las relaciones N:N en los endpoints de Producto requirió eliminar primero los registros de las tablas pivote antes de actualizar, ya que SQLModel no maneja automáticamente la actualización de relaciones muchos-a-muchos. Se resolvió haciendo un `session.flush()` para aplicar los deletes antes de insertar los nuevos registros dentro de la misma transacción.

---

## 📋 Checklist

Ver archivo [CHECKLIST.md](./CHECKLIST.md)
