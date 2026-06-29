# ✅ Checklist manual de defensa — Food Store

Lo que el script E2E **no** puede verificar (necesita navegador / credenciales):
MercadoPago, WebSocket en vivo y el recorrido visual de los frontends.

> El backend y la lógica de negocio ya están cubiertos por `backend/scripts/e2e_smoke.py`
> (cubre las 6 relaciones maestro-detalle + auth/RBAC/stock/FSM/integridad).
> Corré eso **primero**; este checklist es el complemento manual.

---

## 0. Puesta en marcha (orden recomendado)

- [ ] **MySQL** arrancado (XAMPP → Start MySQL).
- [ ] **Seed** corrido: `cd backend && .\.venv\Scripts\python.exe -m app.db.seed`
      (deja datos limpios + los 4 usuarios).
- [ ] **Backend**: `.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`
- [ ] **E2E** en verde: `.\.venv\Scripts\python.exe scripts\e2e_smoke.py` → `✔ Todo el flujo E2E pasó`.
- [ ] **ngrok** (para webhook de MP): `ngrok http 8000` → copiar la URL https en `MP_NOTIFICATION_URL` del `.env` y reiniciar el backend.
- [ ] **Frontend store**: `cd frontend-store && pnpm dev`
- [ ] **Frontend admin**: `cd frontend-admin && pnpm dev`

**Usuarios del seed**
| Rol | Usuario | Contraseña |
|---|---|---|
| ADMIN | admin@foodstore.com | Admin1234! |
| STOCK | stock@foodstore.com | Stock1234! |
| PEDIDOS | pedidos@foodstore.com | Pedidos1234! |
| CLIENT | cliente@foodstore.com | Cliente1234! |

---

## 1. 💳 MercadoPago (Checkout PRO + webhook)

> Navegador **limpio** (sin VPN/adblocker que bloqueen scripts de MP). Usuario comprador de **prueba**.

- [ ] Login en la **store** como cliente de prueba.
- [ ] Agregar productos al carrito → ir a **Checkout** → elegir **MercadoPago**.
- [ ] Se **redirige a Checkout PRO** (no pantalla en blanco).
- [ ] Pagar con **tarjeta de prueba aprobada** (APRO):
      - Mastercard `5031 7557 3453 0604`, venc. `11/30`, CVV `123`, titular `APRO`, DNI `12345678`.
- [ ] Vuelve a la store con resultado **aprobado**.
- [ ] El **webhook** confirma el pedido solo (sin tocar nada): el pedido pasa a **CONFIRMADO/pagado**.
      - Verificar en el panel admin que el pedido figura pagado.
- [ ] Probar tarjeta **rechazada** (titular `OTHE`) → el pedido **no** queda pagado.
- [ ] (Opcional) Pago en **EFECTIVO**: crea el pedido en PENDIENTE sin pasar por MP.

**Si MP falla:** revisar que el `.env` tenga credenciales de **TEST del vendedor**, que `MP_NOTIFICATION_URL` apunte a la URL viva de ngrok, y que el navegador no bloquee los scripts de mercadopago.com.

---

## 2. 🔌 WebSocket en vivo (tiempo real)

> Abrir **dos ventanas**: store (como cliente, viendo "Mis pedidos") + admin (panel Cajero).

- [ ] En el admin, el badge dice **"● En vivo"** (no "○ Sin WS").
- [ ] Cliente crea un pedido en la store.
- [ ] El pedido **aparece solo** en el panel Cajero (sin refrescar (F5)).
- [ ] El cajero avanza el estado (Confirmar → En preparación → Entregado).
- [ ] En la ventana de la store, el estado del pedido **se actualiza solo** en cada cambio.
- [ ] Cancelar un pedido desde el admin → la store lo refleja al instante.
- [ ] Cortar el backend un momento → el badge pasa a **"○ Sin WS"**; al volver, reconecta.

---

## 3. 🛒 Store (cliente) — recorrido visual

- [ ] **Registro** de un usuario nuevo (queda como CLIENT).
- [ ] **Catálogo**: los **chips de categoría** muestran su **icono y color** (los que cargaste en el admin).
- [ ] **Buscar** por nombre filtra; filtrar por **categoría** y por **precio**.
- [ ] **ProductoCard**: selector de **cantidad** antes de agregar al carrito.
- [ ] Producto **manufacturado sin insumos** o **terminado agotado** → no se puede pedir / no aparece disponible.
- [ ] **Carrito**: cambiar cantidades, quitar ítems, total correcto.
- [ ] **Direcciones**: crear / editar / eliminar (CRUD completo).
- [ ] **Checkout**: con dirección suma envío; el total coincide con el carrito.
- [ ] **Mis pedidos**: ver historial y estado actual.
- [ ] **Cancelar** un pedido propio en PENDIENTE (permitido); intentar cancelar uno EN_PREP (no permitido).

---

## 4. 🛠️ Admin — recorrido por rol

### Dashboard (ADMIN)
- [ ] KPIs (ventas hoy, ticket promedio, etc.) y gráficos cargan sin error.

### Categorías (ADMIN)
- [ ] Crear: elegir **icono** (emoji) y **color**, ver la **vista previa** en vivo.
- [ ] Buscador de **categoría padre** con árbol indentado.
- [ ] El árbol muestra icono/color, contador de productos y líneas de jerarquía.
- [ ] Borrar categoría con **subcategorías** o **productos activos** → error claro (no rompe).

### Ingredientes (ADMIN)
- [ ] Selector de **unidad con iconos**; switch de **alérgeno**.
- [ ] Crear/editar/eliminar. Borrar uno **en uso** → mensaje claro (409), no 500.

### Productos (ADMIN)
- [ ] Form en **2 columnas** con tarjetas.
- [ ] Tipo **Terminado** ↔ **Manufacturado** (cambia stock vs receta).
- [ ] **Recipe builder**: buscar ingrediente con autocompletado + agregar; tabla con cantidad/costo; total en vivo.
- [ ] **Calculadora**: costo + operativos + margen (slider e input sincronizados) → precio sugerido → "Usar". Ganancia estimada.
- [ ] **Imágenes**: drag & drop, marcar principal 🌟, eliminar.
- [ ] **Editar** un manufacturado → los ingredientes aparecen **precargados** ✅.
- [ ] Vista **Tabla** ↔ **Tarjetas**; switch de disponibilidad desde la lista.

### Stock (STOCK / ADMIN)
- [ ] Filtros semáforo: **🔴 sin stock / 🟡 bajo / 🟢 disponibles** con contadores.
- [ ] Botones **+/−** y barra flotante **"Guardar todos"**.
- [ ] Manufacturado: muestra **"~N posibles"** + estado de insumos (✅ / ⚠️ falta X).
- [ ] Switch de **disponibilidad** inmediato.

### Cajero (PEDIDOS / ADMIN)
- [ ] **Tiempo transcurrido** ("Hace X min", rojo si pasa de 30).
- [ ] **Timeline** de estados por pedido.
- [ ] Toggle **Lista ↔ Tablero (Kanban)**; arrastrar tarjeta entre columnas cambia el estado.
- [ ] Crear **pedido en mostrador** (Nuevo pedido).

### RBAC visual
- [ ] Login como **STOCK**: solo ve lo suyo (no el CRUD de categorías/productos completo).
- [ ] Login como **PEDIDOS**: ve el panel Cajero.
- [ ] Cada rol no ve las secciones que no le corresponden.

---

## 5. 🧹 Antes de la defensa
- [ ] Re-correr el **seed** para dejar datos limpios.
- [ ] Re-correr el **E2E** → `✔ Todo el flujo E2E pasó`.
- [ ] Tener ngrok vivo y el `.env` con la URL actual.
- [ ] Cerrar pestañas con VPN/adblocker para la demo de MP.
