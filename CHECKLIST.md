# ✅ Checklist de Entrega — Food Store v6.0 (Rúbrica §15.1)

Estado real de cada ítem del checklist oficial de entrega.

**Leyenda:** ✅ Hecho · 🔶 Parcial · ❌ Falta · ⬜ A cargo del equipo en la entrega

| Ítem | Descripción | Estado | Nota |
|------|-------------|:------:|------|
| **CE-01** | Link a repositorio GitHub público en la entrega | ⬜ | El proyecto es un repo git; falta publicarlo/entregar el link |
| **CE-02** | README.md con instrucciones de setup funcionando en máquina limpia | ✅ | README reescrito: backend + ambos frontends + seed |
| **CE-03** | `.env.example` completo (MercadoPago, Cloudinary y WebSocket documentadas) | ✅ | `backend/.env.example` creado con todas las variables |
| **CE-05** | `python -m app.db.seed` carga datos iniciales (incluye UnidadMedida) | ✅ | Roles, estados, formas de pago, unidades y admin |
| **CE-06** | Instalar e iniciar el frontend (`pnpm i` + `pnpm dev`) | 🔶 | Funciona con **npm** (`npm install` + `npm run dev`); son **dos** frontends (5173 y 5174) |
| **CE-07** | `pip install -r requirements.txt` + `uvicorn app.main:app` sin errores | ✅ | App importa OK (54 rutas); requiere MySQL corriendo y `.env` |
| **CE-08** | Swagger UI (`/docs`) con todos los endpoints (incluye `/uploads`) | ✅ | Todos los routers montados bajo `/api/v1` |
| **CE-09** | Pago sandbox MP end-to-end + notifica vía WS | ❌ | **Backend completo** (`/pagos/crear` + webhook + idempotency); falta **integrar el SDK de MP en el frontend** (tokenización + llamada al endpoint) |
| **CE-10** | Unit of Work correcto (ningún `service.session.commit()` directo) | ✅ | Auditado y pulido: nadie comitea a mano, solo el repo toca la BD |
| **CE-11** | 5 Zustand stores tipados con `persist` (incluye `wsStore`) | ❌ | `frontend-store` tiene 2 (auth, carrito) con persist; `frontend-admin` usa Context; **falta `wsStore`** y llegar a 5 |
| **CE-12** | WS: cambio de estado desde el panel admin actualiza la UI del cliente sin recargar | ✅ | Broadcast post-commit + hook `useOrderStatusWS` (invalida queries) |
| **CE-13** | Cloudinary: subir imagen desde el panel admin y verla en el catálogo | ❌ | **Backend completo** (`/uploads/imagen` upload + destroy); falta el **input de subida en el panel admin** |
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

## 📌 Pendientes para llegar a "Excelente"

1. **CE-09 — MercadoPago en el frontend:** integrar `@mercadopago/sdk-react` en el checkout para tokenizar la tarjeta y llamar a `POST /api/v1/pagos/crear` (el backend ya está listo).
2. **CE-13 — Upload Cloudinary en el panel admin:** agregar el input de archivo (`FormData` → `POST /api/v1/uploads/imagen`) y guardar la `secure_url` en el producto.
3. **CE-11 — Stores Zustand:** sumar `wsStore` y los stores faltantes hasta los 5 que pide el spec.
4. **Dashboard de estadísticas en el frontend:** consumir los endpoints `/estadisticas/*` (ya implementados) con gráficos.
5. **CE-15 / CE-01 / CE-16:** grabar el video mostrando WS + Cloudinary y publicar el repo.
