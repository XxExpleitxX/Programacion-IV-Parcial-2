# ✅ Checklist de Entrega — Food Store v6.0 (Rúbrica §15.1)

Estado real de cada ítem del checklist oficial de entrega.

**Leyenda:** ✅ Hecho · 🔶 Parcial · ❌ Falta · ⬜ A cargo del equipo en la entrega

| Ítem | Descripción | Estado | Nota |
|------|-------------|:------:|------|
| **CE-01** | Link a repositorio GitHub público en la entrega | ⬜ | El proyecto es un repo git; falta publicarlo/entregar el link |
| **CE-02** | README.md con instrucciones de setup funcionando en máquina limpia | ✅ | README reescrito: backend + ambos frontends + seed |
| **CE-03** | `.env.example` completo (MercadoPago, Cloudinary y WebSocket documentadas) | ✅ | `backend/.env.example` creado con todas las variables |
| **CE-05** | `python -m app.db.seed` carga datos iniciales (incluye UnidadMedida) | ✅ | Roles, estados, formas de pago, unidades y admin |
| **CE-06** | Instalar e iniciar el frontend (`pnpm i` + `pnpm dev`) | ✅ | Migrado a **pnpm** en ambos frontends (5173 y 5174); `pnpm install` + `pnpm dev`/`pnpm build` verificados |
| **CE-07** | `pip install -r requirements.txt` + `uvicorn app.main:app` sin errores | ✅ | App importa OK (54 rutas); requiere MySQL corriendo y `.env` |
| **CE-08** | Swagger UI (`/docs`) con todos los endpoints (incluye `/uploads`) | ✅ | Todos los routers montados bajo `/api/v1` |
| **CE-09** | Pago sandbox MP end-to-end + notifica vía WS | ✅ | Brick `CardPayment` en el checkout → `POST /pagos/crear` → aprueba pago, confirma pedido y avisa por WS |
| **CE-10** | Unit of Work correcto (ningún `service.session.commit()` directo) | ✅ | Auditado y pulido: nadie comitea a mano, solo el repo toca la BD |
| **CE-11** | 5 Zustand stores tipados con `persist` (incluye `wsStore`) | ✅ | `frontend-store`: `authStore`, `carritoStore` (con persist), `wsStore`, `uiStore`, `pagoStore` — todos usados |
| **CE-12** | WS: cambio de estado desde el panel admin actualiza la UI del cliente sin recargar | ✅ | Broadcast post-commit + hook `useOrderStatusWS` (invalida queries + toast) |
| **CE-13** | Cloudinary: subir imagen desde el panel admin y verla en el catálogo | ✅ | Upload desde el form → `/uploads/imagen`; **transformaciones on-the-fly** (`f_auto,q_auto,c_fill`) al mostrar en catálogo/detalle; **eliminación** desde la UI con `DELETE /uploads/imagen/{public_id}` |
| **CE-15** | Link a video demo (10–15 min) en README (mostrar WS y Cloudinary en vivo) | 🔶 | Link presente en el README; falta grabar/verificar que la demo muestre WS + Cloudinary |
| **CE-16** | Repositorio público verificado con sesión cerrada | ⬜ | A verificar al momento de la entrega |

> **Nota sobre numeración:** la rúbrica oficial salta los ítems **CE-04** y **CE-14** (no figuran en la tabla del documento). Se respeta esa numeración.

---

## 🎁 Bonus / Penalización (Rúbrica §14)

| | Descripción | Estado |
|---|-------------|:------:|
| **Bonus +10** | Tests unitarios con pytest, cobertura > 60% (`test_pedidos`, `test_pagos`, `test_auth`) | ✅ | **Logrado** — 27 tests, cobertura **77%** (auth, pedidos, pagos, uploads, estadísticas, **websocket**, productos) |
| **Penalización −30%** | El proyecto no corre localmente siguiendo el README | ✅ Evitada | Corre con MySQL/XAMPP (uso aprobado por la cátedra) |

---

## 📌 Pendientes

1. **CE-15 / CE-01 / CE-16:** grabar el video mostrando WS + Cloudinary en vivo y publicar/verificar el repo público.
2. *(Opcional)* `test_categorias` para más cobertura.

> **Hecho recientemente:** `test_websocket.py` + `test_productos.py` (30 tests, cob. 77%); transformaciones Cloudinary on-the-fly y borrado desde la UI; `strict: true` y limpieza de `any`; búsqueda con **debounce**, **paginación** y skeletons; **página de seguimiento** (`/pedidos/:id`) con **timeline en tiempo real**, stepper, badge de conexión y **resync al reconectar** (spec 9.6).
>
> **Bloque "seguro" (rúbrica):** (1) **rutas WS nombradas** `/api/v1/ws/pedidos/{id}` y `/api/v1/ws/admin/pedidos` (router WS dedicado); (2) **interceptor 401 con refresh automático** y reintento single-flight en ambos fronts (+ logout que ahora revoca el refresh token); (3) **gestión de stock** para rol STOCK: `PATCH /productos/{id}/stock` (ADMIN/STOCK) + página `/stock` en el admin.
>
> **Bug corregido:** `precio_base` en `ProductoCreate` apuntaba a `unicodedata.decimal` en vez de `Decimal` (rompía `POST /productos`).
>
> **Paginación + errores:** `GET /productos` y `GET /pedidos` ahora devuelven el **envelope** `{items,total,page,size,pages}` (params `page`/`size`); el catálogo de la tienda pagina de verdad (total/páginas). Errores en formato **RFC 7807 simplificado** `{detail, code}`. 32 tests, cob. 78%.
>
> **Feature-Sliced Design en ambos fronts:** la tienda se reorganizó a `features/` (auth · catalogo · carrito · checkout · pedidos) + `shared/` (api · components · hooks · types · utils) + `store/`, igual que el admin. `tsc` y build verdes.
