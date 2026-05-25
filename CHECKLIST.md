# Lista de Verificación del Proyecto Integrador

## Backend (FastAPI + SQLModel)

- [x] **Entorno:** Uso de `.venv`, `requirements.txt` y FastAPI funcionando en modo dev.
- [x] **Modelado:** Tablas creadas con SQLModel incluyendo relaciones `Relationship` (1:N y N:N).
  - Categoria → ProductoCategoria (1:N)
  - Producto → ProductoCategoria (1:N) → Categoria (N:N)
  - Producto → ProductoIngrediente (1:N) → Ingrediente (N:N)
- [x] **Validación:** Uso de `Annotated`, `Query` y `Path` para reglas de negocio (longitudes, rangos, ge/le).
- [x] **CRUD Persistente:** Endpoints funcionales para Crear, Leer, Actualizar y Borrar en MySQL (XAMPP).
- [x] **Seguridad de Datos:** Implementación de `response_model` para no filtrar datos sensibles o innecesarios.
- [x] **Estructura:** Código organizado por módulos (`routers`, `schemas`, `services`, `models`, `core`).

## Frontend (React + TypeScript + Tailwind)

- [x] **Setup:** Proyecto creado con Vite + TS y estructura de carpetas limpia.
- [x] **Componentes:** Uso de componentes funcionales y Props debidamente tipadas con interfaces TypeScript.
- [x] **Estilos:** Interfaz construida con clases de utilidad de Tailwind CSS 3, con componentes reutilizables (`btn-primary`, `card`, `input-field`).
- [x] **Navegación:** Configuración de `react-router-dom` con ruta dinámica `/productos/:id` usando `useParams`.
- [x] **Estado Local:** Uso de `useState` para manejo de formularios (campos de texto, checkboxes, listas de IDs).

## Integración y Server State

- [x] **Lectura (useQuery):** Listados de Categorías, Ingredientes y Productos consumiendo datos reales de la API. Detalle de producto individual.
- [x] **Escritura (useMutation):** Formularios de alta y edición para los tres módulos enviando datos al backend.
- [x] **Sincronización:** Uso de `invalidateQueries` tras cada mutación exitosa para refrescar la UI automáticamente.
- [x] **Feedback:** Estados de "Cargando..." y mensajes de "Error" gestionados visualmente en cada página.

## Video de Presentación

- [ ] **Duración:** El video dura 15 minutos o menos.
- [ ] **Audio/Video:** La voz es clara y la resolución de pantalla permite leer el código.
- [ ] **Demo:** Se muestra el flujo completo desde la creación hasta la persistencia en la DB.
