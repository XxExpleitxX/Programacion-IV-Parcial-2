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
| **CE-13** | Cloudinary: subir imagen desde el panel admin y verla en el catálogo | ✅ | Input de archivo en el form de productos → `/uploads/imagen` → `imagenes_url` se guarda y se muestra en el catálogo |
| **CE-15** | Link a video demo (10–15 min) en README (mostrar WS y Cloudinary en vivo) | 🔶 | Link presente en el README; falta grabar/verificar que la demo muestre WS + Cloudinary |
| **CE-16** | Repositorio público verificado con sesión cerrada | ⬜ | A verificar al momento de la entrega |

> **Nota sobre numeración:** la rúbrica oficial salta los ítems **CE-04** y **CE-14** (no figuran en la tabla del documento). Se respeta esa numeración.

---

## 🎁 Bonus / Penalización (Rúbrica §14)

| | Descripción | Estado |
|---|-------------|:------:|
| **Bonus +10** | Tests unitarios con pytest, cobertura > 60% (`test_pedidos`, `test_pagos`, `test_auth`) | ✅ | **Logrado** — 19 tests, cobertura ~74% (auth, pedidos, pagos, uploads, estadísticas) |
| **Penalización −30%** | El proyecto no corre localmente siguiendo el README | ✅ Evitada | Corre con MySQL/XAMPP (uso aprobado por la cátedra) |

---

## 📌 Pendientes

1. **Dashboard de estadísticas en el frontend:** consumir los endpoints `/estadisticas/*` (ya implementados en el backend) con gráficos en el panel admin. *(Suma en el criterio "Panel Admin", no es un CE.)*
2. **CE-15 / CE-01 / CE-16:** grabar el video mostrando WS + Cloudinary en vivo y publicar/verificar el repo público.
3. *(Opcional)* Subir cobertura de tests agregando `test_productos` y `test_categorias`.
