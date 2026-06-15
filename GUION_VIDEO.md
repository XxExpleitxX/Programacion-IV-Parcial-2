# 🎬 Guion del video demo — Food Store v6.0 (10–15 min)

> Objetivo: mostrar **en vivo** cada criterio de la rúbrica (§16) y los ítems de entrega (CE).
> Cada bloque indica **qué mostrar**, **qué decir** y **qué criterio cubre**.

**Antes de grabar (checklist):**
- [ ] MySQL (XAMPP) corriendo · `python -m app.db.seed` ejecutado
- [ ] Backend: `uvicorn app.main:app --reload --port 8000`
- [ ] Tienda: `pnpm dev` (5173) · Admin: `pnpm dev` (5174)
- [ ] Cargá **8+ productos con imágenes** y generá **2-3 pedidos** (para que el dashboard tenga datos)
- [ ] Tené 2 ventanas listas: **tienda** y **admin**
- [ ] Credenciales a mano: admin / stock / pedidos / cliente (todas en el seed)

---

## 0. Intro (30 s)
**Decir:** "Food Store, app full-stack de gestión de pedidos. Backend FastAPI + SQLModel + MySQL; dos frontends React + TypeScript (tienda y panel admin). Integra MercadoPago, WebSocket en tiempo real y Cloudinary."
**Mostrar:** el README abierto (integrantes + stack).

---

## 1. Setup y arranque · *CE-05/06/07/08* (1 min)
**Mostrar:**
- La terminal con `uvicorn` levantado sin errores.
- `http://localhost:8000/docs` (Swagger) → scrollear: auth, productos, pedidos, pagos, **uploads**, **estadísticas**, **ws**.
- Las dos terminales de `pnpm dev`.

**Decir:** "El seed carga roles, estados, formas de pago, unidades y usuarios. La API documentada en `/docs` con todos los módulos bajo `/api/v1`."

---

## 2. Arquitectura · *Backend Estructura / UoW / Repository / Frontend Estructura* (1.5 min)
**Mostrar (en el editor):**
- `app/modules/` → un paquete por feature (auth, productos, pedidos, pagos, uploads, estadisticas…), cada uno con `router.py` / `service.py` / `repository.py` / `model.py`. **(Feature-First)**
- `app/unit_of_work.py` → "commit/rollback automático; el broadcast WS se emite **post-commit**".
- `app/repositories/base_repository.py` → "`BaseRepository[T]` genérico; **solo los repos tocan la BD**".
- Ambos frontends en **Feature-Sliced Design**: `features/` + `shared/` + `store/`.

**Decir:** "Regla de oro: Router → Service → Unit of Work → Repository → Model. El service nunca comitea ni toca la sesión; todo pasa por el UoW y los repositorios."

---

## 3. Autenticación + RBAC · *§4 / Auth* (1.5 min)
**Mostrar:**
- Login en la **tienda** con `cliente@foodstore.com`.
- Login en el **admin** con `admin@foodstore.com` → ve **todo** (Dashboard, Categorías, Ingredientes, Productos, Cajero).
- (Opcional fuerte) Logout y entrar con `pedidos@foodstore.com` → **solo ve el Cajero**; y con `stock@foodstore.com` → solo productos/stock. **Esto demuestra el RBAC restringiendo.**

**Decir:** "JWT access 30 min + refresh 7 días, cookie httpOnly y rate limiting (5 intentos → 429). 4 roles: ADMIN, STOCK, PEDIDOS, CLIENT."

---

## 4. Catálogo + carrito (cliente) · *Funcionalidades Cliente* (1.5 min)
**Mostrar en la tienda:**
- Escribir en el buscador → notar que filtra con **debounce** (no por cada tecla).
- Filtrar por **categoría** (chips).
- **Paginación**: botones Anterior/Siguiente, "Página X de N", contador total.
- Recargar la página con productos en el carrito → **el carrito persiste** (Zustand + localStorage).

**Decir:** "Catálogo con debounce, filtros, paginación con envelope del backend y skeleton loaders. Carrito persistente con Zustand."

---

## 5. Cloudinary · *CE-13 / Cloudinary back y front* (1.5 min)
**Mostrar en el admin (logueado como ADMIN):**
- Editar/crear un **producto** → subir una imagen → se ve el preview (transformada con `f_auto,q_auto,c_fill`).
- Guardar → ir a la **tienda** → la imagen aparece en el catálogo.
- (Opcional) Subir imagen a una **categoría** (también soportado).

**Decir:** "Upload firmado desde el backend a Cloudinary (valida MIME y tamaño), se guarda la `secure_url`, y en el front se sirve con transformaciones on-the-fly. Al borrar un producto, sus imágenes se eliminan del CDN."

---

## 6. Pedido + Pago MercadoPago · *CE-09 / Backend MercadoPago* (2 min)
**Mostrar en la tienda:**
- Armar un pedido, ir al checkout, elegir **MercadoPago** → "Continuar al pago".
- Aparece el **brick `CardPayment`** (formulario de tarjeta PCI).

**Decir:** "Checkout PRO con el brick CardPayment: la tarjeta se tokeniza del lado de MercadoPago (PCI), nunca pasa por nuestro servidor. El backend crea el pago con `idempotency_key` UUID y, si aprueba, confirma el pedido y notifica por WebSocket. Tiene webhook IPN que re-consulta el pago en MP."

> **Sobre la aprobación real:** el sandbox de MercadoPago está restringido en mi cuenta de prueba (devuelve *"Unauthorized use of live credentials"*), por eso muestro el flujo hasta el brick + el **manejo de error** y lo valido con los **tests de integración** (ver bloque 9). *(Consultar con el profe; el código de la integración está completo.)*

**Mostrar también (editor):** `app/modules/pagos/service.py` → `idempotency_key`, `payment().create()`, webhook que re-consulta MP.

---

## 7. WebSocket en tiempo real · *CE-12 / WebSocket back y front* (2 min) ⭐ EL QUE MÁS LUCE
**Preparar:** dos ventanas lado a lado:
- Izquierda: **tienda** en el **seguimiento de un pedido** (`/pedidos/{id}`) — se ve el timeline + badge **"● En vivo"**.
- Derecha: **admin → Cajero** con ese pedido.

**Hacer:** en el admin, **avanzar el estado** del pedido (ej. PENDIENTE → CONFIRMADO → EN_PREP).

**Mostrar:** la tienda **se actualiza sola, sin recargar** — cambia el badge de estado, crece el timeline y salta un toast. (Y en los logs del backend se ve el broadcast.)

**Decir:** "El broadcast se dispara **después del commit** del Unit of Work (RN-06). Hay dos canales: el del pedido (cliente) y el feed admin. Reconexión exponencial y, si el token expira, el front detecta el close code 4001 y reintenta."

---

## 8. Dashboard de estadísticas · *Estadísticas back y front* (1 min)
**Mostrar en el admin (ADMIN) → Dashboard:**
- 4 KPI cards (ventas hoy, ticket promedio, pedidos activos, mes).
- **LineChart** ventas por período (toggle Día/Semana/Mes), **BarChart** top productos, **PieChart** por estado, **BarChart** ingresos por forma de pago.

**Decir:** "Gráficos con recharts consumiendo `/estadisticas/*`. Las queries excluyen pedidos CANCELADOS y usan `subtotal_snap` para ingresos precisos (reglas EST-01/02/03)."

---

## 9. Tests · *Tests con TestClient (bonus) + respaldo de CE-09* (1.5 min)
**Mostrar en la terminal:**
```bash
cd backend
pytest -q                 # 38 tests verdes
pytest --cov=app          # cobertura ~78%
```
**Decir:** "38 tests de integración con el TestClient de FastAPI y SQLite. Cubren auth, FSM de pedidos, historial append-only, reglas de cancelación, **pagos MercadoPago con el SDK mockeado** (crea pago aprobado → confirma pedido → webhook), uploads, estadísticas, **WebSocket** (broadcast post-commit + close 4001), paginación y formato de error. Cobertura ~78% (supera el 60% del bonus)."

> Acá señalás explícitamente los tests de `test_pagos.py` y `test_websocket.py` para respaldar CE-09 y CE-12 a nivel código.

---

## 10. Cierre (30 s)
**Decir:** "Resumen: arquitectura por capas con UoW y Repository en el backend, Feature-First; Feature-Sliced Design en los frontends; JWT + RBAC, MercadoPago, Cloudinary, WebSocket en tiempo real, dashboard y tests. Gracias."
**Mostrar:** el CHECKLIST.md con los CE.

---

## 🗺️ Mapa criterio → bloque (para no olvidarte nada)
| Criterio rúbrica | Bloque |
|---|---|
| Backend Estructura / UoW / Repository / Servicio | 2 |
| Backend MercadoPago | 6 |
| Backend WebSocket | 7 |
| Backend Cloudinary | 5 |
| Backend Estadísticas | 8 |
| Tests con TestClient | 9 |
| Frontend Estructura / Zustand / TanStack Query | 2, 4 |
| Frontend WebSocket | 7 |
| Frontend Cloudinary | 5 |
| Frontend Estadísticas | 8 |
| Funcionalidades Cliente | 4, 6 |
| Panel Admin | 3, 5, 7, 8 |
| UI/UX | transversal (toasts, skeletons, badge WS, modales) |
| Calidad de Código | 2, 9 |
| CE-05/06/07/08 | 1 |
| CE-09 | 6, 9 |
| CE-11 (5 stores) | 2, 4 |
| CE-12 | 7 |
| CE-13 | 5 |
| CE-15 (este video) | — |

**Tip:** grabá en orden; si algo falla, cortás y regrabás ese bloque. Hablá mirando lo que pasa en pantalla, sin leer textual.
