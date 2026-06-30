import os
import sys
import time

try:
    import httpx
except ImportError:
    print("Falta httpx (viene con FastAPI). Instalá con: pip install httpx")
    sys.exit(2)

BASE = os.environ.get("E2E_BASE", "http://localhost:8000/api/v1")
RUN = str(int(time.time()))[-6:]   # sufijo único por corrida (evita choques de nombre)

USUARIOS = {
    "admin":   ("admin@foodstore.com",   "Admin1234!"),
    "stock":   ("stock@foodstore.com",   "Stock1234!"),
    "pedidos": ("pedidos@foodstore.com", "Pedidos1234!"),
    "cliente": ("cliente@foodstore.com", "Cliente1234!"),
}

# ── Mini-framework de aserciones ─────────────────────────────────────────────
_PASS, _FAILS = 0, []

def check(name, ok, detail=""):
    global _PASS
    if ok:
        _PASS += 1
        print(f"  \033[32mPASS\033[0m  {name}")
    else:
        _FAILS.append(name)
        print(f"  \033[31mFAIL\033[0m  {name}  ->  {detail}")

def expect_status(resp, code, name):
    ok = resp.status_code == code
    check(name, ok, f"esperaba {code}, vino {resp.status_code}: {resp.text[:160]}")
    return resp

def seccion(t):
    print(f"\n\033[1m== {t} ==\033[0m")


class Api:
    def __init__(self, base):
        # connect corto (si el server no responde, falla rápido en vez de colgarse).
        self.c = httpx.Client(base_url=base, timeout=httpx.Timeout(15.0, connect=5.0))
        self.token = None

    def login(self, username, password):
        r = self.c.post("/auth/login", json={"username": username, "password": password})
        if r.status_code == 200:
            self.token = r.json().get("access_token")
        return r

    def _h(self, extra=None):
        h = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        if extra:
            h.update(extra)
        return h

    def get(self, path, **kw):    return self.c.get(path, headers=self._h(), **kw)
    def post(self, path, **kw):   return self.c.post(path, headers=self._h(), **kw)
    def put(self, path, **kw):    return self.c.put(path, headers=self._h(), **kw)
    def patch(self, path, **kw):  return self.c.patch(path, headers=self._h(), **kw)
    def delete(self, path, **kw): return self.c.delete(path, headers=self._h(), **kw)


def stock_ing(admin, ing_id):
    return admin.get(f"/ingredientes/{ing_id}").json().get("stock_disponible", 0)

def prod(admin, pid):
    return admin.get(f"/productos/{pid}").json()


def main():
    print(f"E2E Food Store · base={BASE} · run={RUN}")

    # Chequeo de que el server responde
    try:
        httpx.get(BASE.replace("/api/v1", "") + "/docs", timeout=5)
    except Exception as e:
        print(f"\n\033[31mNo se pudo contactar el backend en {BASE}.\033[0m")
        print(f"Levantá el server primero (uvicorn app.main:app). Detalle: {e}")
        sys.exit(2)

    apis = {}
    faltan = []
    extra_prod, extra_cat = [], []   # objetos creados por las pruebas de maestro-detalle (para limpiar)

    # ── 1. AUTH ───────────────────────────────────────────────────────────────
    seccion("1. Autenticación")
    for rol, (u, p) in USUARIOS.items():
        a = Api(BASE)
        r = a.login(u, p)
        expect_status(r, 200, f"login {rol} ({u})")
        if r.status_code != 200:
            faltan.append(u)
        apis[rol] = a
    admin, stock, pedidos, cliente = apis["admin"], apis["stock"], apis["pedidos"], apis["cliente"]

    if faltan:
        print(f"\n  \033[33mAVISO:\033[0m no loguearon: {', '.join(faltan)}.")
        print("  Tu DB no tiene esos usuarios del seed. Re-corré el seed y volvé a probar:")
        print("    .venv\\Scripts\\python.exe -m app.db.seed")

    if not admin.token:
        print("\n\033[31mSin ADMIN no se puede continuar. Abortando.\033[0m")
        sys.exit(1)
    if not cliente.token:
        print("\n\033[31mSin CLIENTE no se pueden probar pedidos. Abortando.\033[0m")
        sys.exit(1)

    me = admin.get("/auth/me")
    roles_me = me.json().get("roles", []) if me.status_code == 200 else []
    check("GET /auth/me como admin → tiene rol ADMIN", "ADMIN" in roles_me, me.text[:160])

    # Acciones de staff (confirmar/cancelar/avanzar): preferimos PEDIDOS; si no logueó, ADMIN sirve.
    staff = pedidos if pedidos.token else admin
    if not pedidos.token:
        print("  (usando ADMIN para acciones de staff porque PEDIDOS no logueó)")

    bad = Api(BASE).login("admin@foodstore.com", "ClaveMala!")
    expect_status(bad, 401, "login con contraseña incorrecta → 401")

    anon = httpx.get(f"{BASE}/auth/me")
    check("GET /auth/me sin token → 401", anon.status_code == 401, f"vino {anon.status_code}")

    # ── 2. RBAC ─────────────────────────────────────────────────────────────────
    seccion("2. Permisos por rol (RBAC)")
    expect_status(cliente.post("/productos/", json={"nombre": "hack", "precio_base": 1, "categoria_ids": []}),
                  403, "CLIENT no puede crear productos → 403")
    expect_status(cliente.get("/auth/admin/usuarios"), 403, "CLIENT no ve admin/usuarios → 403")
    expect_status(admin.get("/auth/admin/usuarios"), 200, "ADMIN sí ve admin/usuarios → 200")

    # ── 3. Alta de catálogo ──────────────────────────────────────────────────────
    seccion("3. Alta de catálogo")
    unidades = admin.get("/unidades-medida/").json()
    unidad_id = next((u["id"] for u in unidades if u.get("simbolo") == "kg"), (unidades[0]["id"] if unidades else None))

    rc = admin.post("/categorias/", json={
        "nombre": f"E2E Cat {RUN}", "icono": "🍕", "color": "#8b5cf6",
    })
    expect_status(rc, 201, "crear categoría con icono+color → 201")
    cat = rc.json()
    cat_id = cat.get("id")
    check("la categoría persiste icono y color",
          cat.get("icono") == "🍕" and cat.get("color") == "#8b5cf6", str(cat))

    def crear_ingrediente(nombre, stock, precio=10.0):
        r = admin.post("/ingredientes/", json={
            "nombre": f"{nombre} {RUN}", "precio_unitario": precio,
            "stock_disponible": stock, "unidad_medida_id": unidad_id,
        })
        return r

    r_tom = crear_ingrediente("E2E Tomate", 100)
    r_moz = crear_ingrediente("E2E Mozza", 100)
    r_tru = crear_ingrediente("E2E Trufa", 2)   # escaso a propósito (auto-agotado manuf.)
    for nm, r in [("Tomate", r_tom), ("Mozza", r_moz), ("Trufa", r_tru)]:
        expect_status(r, 201, f"crear ingrediente E2E {nm} → 201")
    tom_id, moz_id, tru_id = r_tom.json()["id"], r_moz.json()["id"], r_tru.json()["id"]

    # Terminado con stock=2
    r_coca = admin.post("/productos/", json={
        "nombre": f"E2E Coca {RUN}", "precio_base": 100, "es_manufacturado": False,
        "stock_cantidad": 2, "disponible": True, "categoria_ids": [cat_id],
    })
    expect_status(r_coca, 201, "crear producto TERMINADO (stock 2) → 201")
    coca_id = r_coca.json()["id"]

    # Manufacturado: 1 tomate + 1 mozza por unidad
    r_pizza = admin.post("/productos/", json={
        "nombre": f"E2E Pizza {RUN}", "precio_base": 500, "es_manufacturado": True,
        "disponible": True, "categoria_ids": [cat_id],
        "ingredientes": [{"ingrediente_id": tom_id, "cantidad": 1}, {"ingrediente_id": moz_id, "cantidad": 1}],
    })
    expect_status(r_pizza, 201, "crear producto MANUFACTURADO con receta → 201")
    pizza = r_pizza.json()
    pizza_id = pizza["id"]
    check("el manufacturado guarda su receta (2 ingredientes)", len(pizza.get("ingredientes", [])) == 2, str(pizza))

    # El front precarga la receta al editar usando ingrediente_id + cantidad del GET.
    det = prod(admin, pizza_id)
    receta = det.get("ingredientes", [])
    ok_pre = len(receta) == 2 and all("ingrediente_id" in i and (i.get("cantidad") or 0) > 0 for i in receta)
    check("GET producto trae la receta lista para precargar (ingrediente_id + cantidad)", ok_pre, str(receta))

    # Manufacturado con insumo escaso (trufa, stock 2)
    r_pt = admin.post("/productos/", json={
        "nombre": f"E2E PizzaTrufa {RUN}", "precio_base": 900, "es_manufacturado": True,
        "disponible": True, "categoria_ids": [cat_id],
        "ingredientes": [{"ingrediente_id": tru_id, "cantidad": 1}],
    })
    expect_status(r_pt, 201, "crear manufacturado con insumo escaso → 201")
    ptrufa_id = r_pt.json()["id"]

    # ── 4. Crear receta NO mueve stock ──────────────────────────────────────────
    seccion("4. La receta es plantilla (crear/editar no mueve stock)")
    check("crear el manufacturado NO descontó insumos",
          stock_ing(admin, tom_id) == 100 and stock_ing(admin, moz_id) == 100,
          f"tomate={stock_ing(admin, tom_id)} mozza={stock_ing(admin, moz_id)}")

    tom_antes = stock_ing(admin, tom_id)
    r_edit = admin.put(f"/productos/{pizza_id}", json={
        "es_manufacturado": True,
        "ingredientes": [{"ingrediente_id": tom_id, "cantidad": 2}, {"ingrediente_id": moz_id, "cantidad": 1}],
    })
    expect_status(r_edit, 200, "editar receta (tomate 1→2) → 200")
    check("editar la receta NO movió el stock de insumos",
          stock_ing(admin, tom_id) == tom_antes, f"antes={tom_antes} ahora={stock_ing(admin, tom_id)}")

    # La receta editada debe quedar persistida y lista para re-precargar al volver a editar.
    receta2 = prod(admin, pizza_id).get("ingredientes", [])
    tom_item = next((i for i in receta2 if i.get("ingrediente_id") == tom_id), None)
    check("la receta editada persiste (tomate cantidad=2) y queda lista para re-precargar",
          tom_item is not None and tom_item.get("cantidad") == 2, str(receta2))

    # ── 5. Consumo de stock por pedido ──────────────────────────────────────────
    seccion("5. El pedido descuenta stock")

    def crear_pedido(api, items, pago="EFECTIVO"):
        return api.post("/pedidos/", json={"forma_pago_codigo": pago, "items": items})

    # receta actual: tomate 2, mozza 1
    tom0, moz0 = stock_ing(admin, tom_id), stock_ing(admin, moz_id)
    r = crear_pedido(cliente, [{"producto_id": pizza_id, "cantidad": 1}])
    expect_status(r, 201, "cliente crea pedido 1x Pizza → 201")
    check("pedido manufacturado descontó insumos (tomate -2, mozza -1)",
          stock_ing(admin, tom_id) == tom0 - 2 and stock_ing(admin, moz_id) == moz0 - 1,
          f"tomate {tom0}->{stock_ing(admin, tom_id)} mozza {moz0}->{stock_ing(admin, moz_id)}")

    r = crear_pedido(cliente, [{"producto_id": coca_id, "cantidad": 1}])
    expect_status(r, 201, "cliente crea pedido 1x Coca → 201")
    check("pedido terminado descontó stock_cantidad (2→1)", prod(admin, coca_id)["stock_cantidad"] == 1,
          f"stock={prod(admin, coca_id)['stock_cantidad']}")

    # ── 6. Rechazo por stock insuficiente ───────────────────────────────────────
    seccion("6. Rechazo por stock insuficiente")
    coca_stock = prod(admin, coca_id)["stock_cantidad"]
    r = crear_pedido(cliente, [{"producto_id": coca_id, "cantidad": 99}])
    expect_status(r, 422, "pedir más Coca que el stock → 422")
    check("el rechazo NO movió el stock del terminado", prod(admin, coca_id)["stock_cantidad"] == coca_stock,
          f"stock={prod(admin, coca_id)['stock_cantidad']}")

    moz_stock = stock_ing(admin, moz_id)
    r = crear_pedido(cliente, [{"producto_id": pizza_id, "cantidad": 99999}])
    expect_status(r, 422, "pedir Pizza sin insumos suficientes → 422")
    check("el rechazo NO movió el stock de insumos", stock_ing(admin, moz_id) == moz_stock,
          f"mozza={stock_ing(admin, moz_id)}")

    # ── 7. Auto-agotado ──────────────────────────────────────────────────────────
    seccion("7. Auto-agotado al llegar a 0")
    # Coca está en 1 → un pedido más la deja en 0 y debe auto-desactivarse
    r = crear_pedido(cliente, [{"producto_id": coca_id, "cantidad": 1}])
    expect_status(r, 201, "agotar la Coca (queda 0) → 201")
    coca = prod(admin, coca_id)
    check("terminado en 0 se auto-agota (disponible=false)",
          coca["stock_cantidad"] == 0 and coca["disponible"] is False, str({k: coca[k] for k in ("stock_cantidad", "disponible")}))
    expect_status(crear_pedido(cliente, [{"producto_id": coca_id, "cantidad": 1}]), 422,
                  "pedir un producto agotado → 422")

    # PizzaTrufa: trufa stock 2, receta 1 → 2 pedidos la dejan sin poder producirse
    crear_pedido(cliente, [{"producto_id": ptrufa_id, "cantidad": 2}])
    pt = prod(admin, ptrufa_id)
    check("manufacturado sin insumos se auto-agota (disponible=false)",
          pt["disponible"] is False, f"disponible={pt['disponible']} trufa={stock_ing(admin, tru_id)}")

    # ── 8. Restaurar stock al cancelar ──────────────────────────────────────────
    seccion("8. Cancelar restaura el stock")
    tom_b, moz_b = stock_ing(admin, tom_id), stock_ing(admin, moz_id)
    r = crear_pedido(cliente, [{"producto_id": pizza_id, "cantidad": 1}])
    expect_status(r, 201, "crear pedido para cancelar → 201")
    ped_cancel = r.json()["id"]
    check("descontó al crear", stock_ing(admin, tom_id) == tom_b - 2, f"tomate={stock_ing(admin, tom_id)}")
    rc = staff.post(f"/pedidos/{ped_cancel}/estado", json={"estado_hacia": "CANCELADO", "motivo": "prueba E2E"})
    expect_status(rc, 200, "cancelar el pedido (rol PEDIDOS) → 200")
    check("cancelar restauró los insumos",
          stock_ing(admin, tom_id) == tom_b and stock_ing(admin, moz_id) == moz_b,
          f"tomate={stock_ing(admin, tom_id)} (esperado {tom_b})")

    # ── 9. FSM de estados ────────────────────────────────────────────────────────
    seccion("9. Máquina de estados (FSM)")
    r = crear_pedido(cliente, [{"producto_id": pizza_id, "cantidad": 1}])
    fsm_id = r.json()["id"]
    expect_status(staff.post(f"/pedidos/{fsm_id}/estado", json={"estado_hacia": "ENTREGADO"}), 422,
                  "transición inválida PENDIENTE→ENTREGADO → 422")
    expect_status(staff.post(f"/pedidos/{fsm_id}/estado", json={"estado_hacia": "CONFIRMADO"}), 200,
                  "PENDIENTE→CONFIRMADO → 200")
    expect_status(staff.post(f"/pedidos/{fsm_id}/estado", json={"estado_hacia": "EN_PREP"}), 200,
                  "CONFIRMADO→EN_PREP → 200")
    expect_status(staff.post(f"/pedidos/{fsm_id}/estado", json={"estado_hacia": "ENTREGADO"}), 200,
                  "EN_PREP→ENTREGADO → 200")

    # ── 10. Reglas de cancelación del cliente ───────────────────────────────────
    seccion("10. Reglas de cancelación del CLIENT")
    r = crear_pedido(cliente, [{"producto_id": pizza_id, "cantidad": 1}])
    cli_ped = r.json()["id"]
    expect_status(cliente.post(f"/pedidos/{cli_ped}/estado", json={"estado_hacia": "CONFIRMADO"}), 403,
                  "CLIENT no puede confirmar (solo cancelar) → 403")
    # Llevar a EN_PREP con rol PEDIDOS y verificar que el cliente ya no puede cancelar
    staff.post(f"/pedidos/{cli_ped}/estado", json={"estado_hacia": "CONFIRMADO"})
    staff.post(f"/pedidos/{cli_ped}/estado", json={"estado_hacia": "EN_PREP"})
    expect_status(cliente.post(f"/pedidos/{cli_ped}/estado", json={"estado_hacia": "CANCELADO", "motivo": "x"}), 403,
                  "CLIENT no puede cancelar desde EN_PREP → 403")
    # Un pedido propio en PENDIENTE sí lo puede cancelar
    r = crear_pedido(cliente, [{"producto_id": pizza_id, "cantidad": 1}])
    cli_ped2 = r.json()["id"]
    expect_status(cliente.post(f"/pedidos/{cli_ped2}/estado", json={"estado_hacia": "CANCELADO", "motivo": "me arrepentí"}), 200,
                  "CLIENT cancela su pedido PENDIENTE → 200")

    # ── 11. Integridad referencial ──────────────────────────────────────────────
    seccion("11. Integridad referencial")
    # El tomate está en la receta de la Pizza (activa) → no se puede borrar (409, no 500).
    expect_status(admin.delete(f"/ingredientes/{tom_id}"), 409,
                  "borrar ingrediente en uso por producto activo → 409")
    # Nombre duplicado → 409 limpio (no 500).
    expect_status(admin.post("/categorias/", json={"nombre": f"E2E Cat {RUN}"}), 409,
                  "crear categoría con nombre duplicado → 409")
    expect_status(admin.post("/ingredientes/", json={"nombre": f"E2E Tomate {RUN}", "precio_unitario": 1}), 409,
                  "crear ingrediente con nombre duplicado → 409")
    # Crear producto con categoría inexistente → error controlado (no 500).
    rbad = admin.post("/productos/", json={"nombre": f"E2E Bad {RUN}", "precio_base": 1, "categoria_ids": [999999]})
    check("crear producto con categoría inexistente → 4xx (no 500)",
          400 <= rbad.status_code < 500, f"vino {rbad.status_code}")

    # ── 12. Maestro-detalle: receta del producto ────────────────────────────────
    seccion("12. Maestro-detalle: receta del producto")
    # Manufacturado sin ingredientes → 422
    expect_status(admin.post("/productos/", json={
        "nombre": f"E2E SinReceta {RUN}", "precio_base": 100, "es_manufacturado": True,
        "categoria_ids": [cat_id], "ingredientes": [],
    }), 422, "crear manufacturado sin ingredientes → 422")

    # Quitar un ingrediente del detalle (2 → 1): no debe quedar huérfano ni duplicado
    admin.put(f"/productos/{pizza_id}", json={
        "es_manufacturado": True, "ingredientes": [{"ingrediente_id": tom_id, "cantidad": 2}],
    })
    r1 = prod(admin, pizza_id).get("ingredientes", [])
    check("quitar un ingrediente del detalle deja exactamente 1",
          len(r1) == 1 and r1[0]["ingrediente_id"] == tom_id, str(r1))

    # Volver a agregar (1 → 2): sin duplicar
    admin.put(f"/productos/{pizza_id}", json={
        "es_manufacturado": True,
        "ingredientes": [{"ingrediente_id": tom_id, "cantidad": 2}, {"ingrediente_id": moz_id, "cantidad": 1}],
    })
    r2 = prod(admin, pizza_id).get("ingredientes", [])
    check("agregar al detalle deja 2 sin duplicar",
          len(r2) == 2 and sorted(i["ingrediente_id"] for i in r2) == sorted([tom_id, moz_id]), str(r2))

    # Editar manufacturado dejando receta vacía → 422 (y no rompe la receta existente)
    expect_status(admin.put(f"/productos/{pizza_id}", json={"es_manufacturado": True, "ingredientes": []}),
                  422, "editar manufacturado a receta vacía → 422")
    check("tras el 422, la receta quedó intacta (rollback)",
          len(prod(admin, pizza_id).get("ingredientes", [])) == 2, "se esperaba 2 ingredientes")

    # ── 13. Maestro-detalle: pedido (detalle, snapshot, total, historial) ────────
    seccion("13. Maestro-detalle: pedido")
    r_combo = admin.post("/productos/", json={
        "nombre": f"E2E Combo {RUN}", "precio_base": 250, "es_manufacturado": False,
        "stock_cantidad": 50, "disponible": True, "categoria_ids": [cat_id],
    })
    expect_status(r_combo, 201, "crear producto terminado para el pedido → 201")
    combo_id = r_combo.json()["id"]; extra_prod.append(combo_id)

    rp = crear_pedido(cliente, [{"producto_id": pizza_id, "cantidad": 1}, {"producto_id": combo_id, "cantidad": 2}])
    expect_status(rp, 201, "crear pedido multi-línea (2 productos) → 201")
    ped_id = rp.json()["id"]
    det = admin.get(f"/pedidos/{ped_id}").json()
    dets = det.get("detalles", [])
    check("el pedido trae 2 líneas de detalle", len(dets) == 2, str(dets))
    check("cada detalle congela snapshot de nombre y precio",
          all(d.get("nombre_snapshot") and d.get("precio_snapshot") is not None for d in dets), str(dets))
    esperado = 500 * 1 + 250 * 2   # pizza + combo, sin envío (sin dirección)
    check("el total del pedido suma bien los subtotales",
          abs(float(det["total"]) - esperado) < 0.01, f"total={det['total']} esperado={esperado}")

    staff.post(f"/pedidos/{ped_id}/estado", json={"estado_hacia": "CONFIRMADO"})
    hist = admin.get(f"/pedidos/{ped_id}/historial").json()
    check("el historial registra los cambios de estado (audit trail)",
          isinstance(hist, list) and len(hist) >= 2, str(hist)[:200])

    # Snapshot INMUTABLE: cambiar el precio del producto NO debe alterar el pedido ya creado.
    admin.put(f"/productos/{combo_id}", json={"precio_base": 999})
    det_post = admin.get(f"/pedidos/{ped_id}").json()
    combo_det = next((d for d in det_post.get("detalles", []) if d.get("producto_id") == combo_id), None)
    check("el snapshot del pedido es inmutable (conserva el precio viejo 250, no 999)",
          combo_det is not None and abs(float(combo_det["precio_snapshot"]) - 250) < 0.01, str(combo_det))

    # ── 14. Maestro-detalle: producto ↔ categorías (M2M) ─────────────────────────
    seccion("14. Maestro-detalle: producto ↔ categorías")
    rc2 = admin.post("/categorias/", json={"nombre": f"E2E Cat2 {RUN}"})
    expect_status(rc2, 201, "crear 2da categoría → 201")
    cat2_id = rc2.json()["id"]; extra_cat.append(cat2_id)

    rpm = admin.post("/productos/", json={
        "nombre": f"E2E MultiCat {RUN}", "precio_base": 100, "es_manufacturado": False,
        "stock_cantidad": 5, "categoria_ids": [cat_id, cat2_id],
    })
    expect_status(rpm, 201, "crear producto con 2 categorías → 201")
    multicat_id = rpm.json()["id"]; extra_prod.append(multicat_id)
    cats1 = prod(admin, multicat_id).get("categorias", [])
    check("producto con 2 categorías → GET trae 2", len(cats1) == 2, str([c.get("nombre") for c in cats1]))

    admin.put(f"/productos/{multicat_id}", json={"categoria_ids": [cat2_id]})
    cats2 = prod(admin, multicat_id).get("categorias", [])
    check("editar a 1 categoría → GET trae 1 (links viejos limpiados)",
          len(cats2) == 1 and cats2[0]["id"] == cat2_id, str([c.get("nombre") for c in cats2]))

    # ── 15. Envelope de paginación ───────────────────────────────────────────────
    seccion("15. Envelope de paginación")
    env = admin.get("/productos/?page=1&size=5").json()
    ok_env = isinstance(env, dict) and all(k in env for k in ("items", "total", "page", "size", "pages")) and isinstance(env.get("items"), list)
    check("GET /productos devuelve envelope {items,total,page,size,pages}",
          ok_env, str(list(env.keys()) if isinstance(env, dict) else env))
    check("el envelope respeta size y trae a lo sumo 'size' items",
          env.get("size") == 5 and len(env.get("items", [])) <= 5,
          str({k: env.get(k) for k in ("size", "page", "total", "pages")}))

    # ── 16. Soft-delete ───────────────────────────────────────────────────────────
    seccion("16. Soft-delete de producto")
    rb = admin.post("/productos/", json={
        "nombre": f"E2E Borrable {RUN}", "precio_base": 10, "es_manufacturado": False,
        "stock_cantidad": 1, "categoria_ids": [cat2_id],
    })
    expect_status(rb, 201, "crear producto para borrar → 201")
    borrable_id = rb.json()["id"]
    expect_status(admin.delete(f"/productos/{borrable_id}"), 204, "borrar (soft) un producto → 204")
    expect_status(admin.get(f"/productos/{borrable_id}"), 404, "el producto borrado ya no se obtiene por id → 404")
    env2 = admin.get("/productos/?size=500").json()
    check("el producto borrado no aparece en el listado",
          all(p["id"] != borrable_id for p in env2.get("items", [])), "seguía apareciendo en el listado")

    # ── 17. Maestro-detalle: producto → unidad de medida ────────────────────────
    seccion("17. Producto → unidad de medida")
    r_um = admin.post("/productos/", json={
        "nombre": f"E2E ConUnidad {RUN}", "precio_base": 100, "es_manufacturado": False,
        "stock_cantidad": 5, "unidad_venta_id": unidad_id, "categoria_ids": [cat_id],
    })
    expect_status(r_um, 201, "crear producto con unidad de venta → 201")
    um_prod_id = r_um.json()["id"]; extra_prod.append(um_prod_id)
    check("el producto conserva su unidad de venta (FK round-trip)",
          prod(admin, um_prod_id).get("unidad_venta_id") == unidad_id,
          f"unidad_venta_id={prod(admin, um_prod_id).get('unidad_venta_id')} esperado={unidad_id}")

    # ── 18. Maestro-detalle: usuario → dirección de entrega ──────────────────────
    seccion("18. Usuario → dirección de entrega")
    rd = cliente.post("/direcciones/", json={
        "alias": "Casa E2E", "linea1": "Calle Falsa 123", "ciudad": "Rosario",
        "provincia": "Santa Fe", "codigo_postal": "2000",
    })
    expect_status(rd, 201, "cliente crea una dirección → 201")
    dir_id = rd.json()["id"]
    lista = cliente.get("/direcciones/").json()
    check("la dirección aparece en el listado del usuario",
          any(d["id"] == dir_id for d in lista), str([d.get("alias") for d in lista]))
    expect_status(cliente.put(f"/direcciones/{dir_id}", json={
        "alias": "Casa", "linea1": "Calle Verdadera 456", "ciudad": "Rosario",
    }), 200, "editar la dirección → 200")

    # Pedido CON dirección → debe sumar costo de envío (vincula Usuario→Dirección→Pedido)
    r_env = cliente.post("/pedidos/", json={
        "forma_pago_codigo": "EFECTIVO", "direccion_id": dir_id,
        "items": [{"producto_id": um_prod_id, "cantidad": 1}],
    })
    expect_status(r_env, 201, "crear pedido con dirección → 201")
    check("el pedido con dirección suma costo de envío (50)",
          abs(float(r_env.json()["costo_envio"]) - 50) < 0.01, f"costo_envio={r_env.json().get('costo_envio')}")

    # DELETE de una dirección no referenciada
    rd2 = cliente.post("/direcciones/", json={"linea1": "Temporal 1", "ciudad": "Rosario"})
    dir2_id = rd2.json()["id"]
    expect_status(cliente.delete(f"/direcciones/{dir2_id}"), 204, "eliminar una dirección → 204")
    lista2 = cliente.get("/direcciones/").json()
    check("la dirección eliminada ya no aparece", all(d["id"] != dir2_id for d in lista2), "seguía apareciendo")

    # ── 19. Entradas inválidas y validaciones ───────────────────────────────────
    seccion("19. Entradas inválidas")
    expect_status(admin.post("/productos/", json={"nombre": "   ", "precio_base": 10, "categoria_ids": []}),
                  422, "producto con nombre vacío → 422")
    expect_status(admin.post("/productos/", json={"nombre": f"E2E Neg {RUN}", "precio_base": -5, "categoria_ids": []}),
                  422, "producto con precio negativo → 422")
    expect_status(admin.post("/productos/", json={"nombre": f"E2E NegS {RUN}", "precio_base": 10, "stock_cantidad": -3, "categoria_ids": []}),
                  422, "producto con stock negativo → 422")
    expect_status(admin.post("/ingredientes/", json={"nombre": f"E2E INeg {RUN}", "precio_unitario": -1}),
                  422, "ingrediente con precio negativo → 422")
    expect_status(admin.post("/ingredientes/", json={"nombre": f"E2E INegS {RUN}", "stock_disponible": -1}),
                  422, "ingrediente con stock negativo → 422")
    expect_status(crear_pedido(cliente, [{"producto_id": pizza_id, "cantidad": 0}]),
                  422, "pedido con cantidad 0 → 422")
    expect_status(admin.post("/productos/", json={"nombre": "X" * 200, "precio_base": 10, "categoria_ids": []}),
                  422, "producto con nombre larguísimo (>150) → 422")
    expect_status(admin.post("/categorias/", json={"nombre": "C" * 200}),
                  422, "categoría con nombre larguísimo (>100) → 422")
    expect_status(Api(BASE).c.post("/auth/register", json={
        "username": f"bad{RUN}", "nombre": "x", "apellido": "x", "email": "no-es-email", "password": "Larga1234"}),
                  422, "registro con email inválido → 422")

    # ── 20. Acciones de admin / staff extra ──────────────────────────────────────
    seccion("20. Acciones admin/staff extra")
    # Cambiar disponibilidad (PATCH)
    expect_status(admin.patch(f"/productos/{combo_id}/disponibilidad", json={"disponible": False}),
                  200, "cambiar disponibilidad (PATCH) → 200")
    check("la disponibilidad quedó en false", prod(admin, combo_id).get("disponible") is False, "seguía disponible")
    admin.patch(f"/productos/{combo_id}/disponibilidad", json={"disponible": True})

    # Estado terminal: un pedido ENTREGADO (fsm_id de la sección 9) no admite más cambios
    expect_status(staff.post(f"/pedidos/{fsm_id}/estado", json={"estado_hacia": "CONFIRMADO"}),
                  422, "cambiar estado de un pedido ENTREGADO (terminal) → 422")

    # Eliminar categoría usada por productos activos → 409
    expect_status(admin.delete(f"/categorias/{cat_id}"),
                  409, "eliminar categoría con productos activos → 409")

    # Registro feliz de un cliente nuevo + login.
    # Convención del proyecto: el front manda el email como username (ver seed.py).
    email_nuevo = f"e2e{RUN}@test.com"
    nuevo = Api(BASE)
    rr = nuevo.c.post("/auth/register", json={
        "username": email_nuevo, "nombre": "E2E", "apellido": "Test",
        "email": email_nuevo, "password": "Cliente1234!"})
    expect_status(rr, 201, "registrar un cliente nuevo → 201")
    expect_status(nuevo.login(email_nuevo, "Cliente1234!"), 200, "loguear el cliente recién registrado → 200")
    if rr.status_code == 201:   # deja el usuario de prueba desactivado (no se pueden borrar usuarios)
        admin.post(f"/auth/admin/usuarios/{rr.json()['id']}/desactivar")

    # ── Limpieza (best-effort) ───────────────────────────────────────────────────
    seccion("Limpieza (best-effort)")
    def borrar(path):
        try:
            r = admin.delete(path)
            print(f"  DELETE {path} → {r.status_code}")
        except Exception as e:
            print(f"  DELETE {path} → error {type(e).__name__}")
    for pid in [coca_id, pizza_id, ptrufa_id, *extra_prod]:
        borrar(f"/productos/{pid}")
    for iid in (tom_id, moz_id, tru_id):   # ya sin productos activos que los usen
        borrar(f"/ingredientes/{iid}")
    for cid in [cat_id, *extra_cat]:
        borrar(f"/categorias/{cid}")

    # ── Resumen ──────────────────────────────────────────────────────────────────
    total = _PASS + len(_FAILS)
    print(f"\n\033[1m== Resumen ==\033[0m")
    print(f"  {_PASS}/{total} checks OK")
    if _FAILS:
        print("\033[31m  Fallaron:\033[0m")
        for f in _FAILS:
            print(f"    - {f}")
        sys.exit(1)
    print("\033[32m  ✔ Todo el flujo E2E pasó.\033[0m")
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n(interrumpido por el usuario)")
        sys.exit(130)
    except httpx.TimeoutException as e:
        print(f"\n\033[31mTimeout hablando con el backend:\033[0m {e!r}")
        print(f"  Checks OK hasta el corte: {_PASS}. ¿El server sigue vivo?")
        sys.exit(1)
    except Exception as e:
        print(f"\n\033[31mError inesperado:\033[0m {type(e).__name__}: {e}")
        print(f"  Checks OK hasta el corte: {_PASS}")
        sys.exit(1)
