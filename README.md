# 🧣 Bufanditas — Guía de instalación

Tu app tiene tres piezas:

1. **`public/index.html`** — la página del cliente (diseñador + pago).
2. **`public/admin.html`** — el panel privado donde marcás stock.
3. **`api/*`** — el backend (login, stock, pago con Mercado Pago).

Vas a subir todo a **Vercel** (gratis). Necesitás 3 cosas además:

- Una cuenta de **Mercado Pago** (para cobrar).
- Una cuenta de **Resend** (para que te lleguen las ventas por email — opcional pero recomendado).
- **Vercel KV** activado (para guardar el stock y los pedidos).

---

## 1. Subir el proyecto a Vercel

### 1.1 — Crear cuenta y proyecto

1. Entrá a https://vercel.com y registrate (gratis, podés usar GitHub o email).
2. Cuando estés adentro, hacé clic en **"Add New… → Project"**.
3. Vercel te va a pedir importar un repositorio. La forma más simple para arrancar:
   - Bajate la carpeta `bufandita-app/` a tu compu.
   - Subila a un repositorio nuevo en **GitHub** (también gratis).
   - Volvé a Vercel, conectás GitHub y elegís el repo.
4. En **"Configure Project"** dejá todo por defecto y dale **"Deploy"**.

> En 30 segundos vas a tener una URL del tipo `https://bufandita-app-tunombre.vercel.app`. Esa es tu página.

---

## 2. Configurar Mercado Pago

### 2.1 — Conseguir el Access Token

1. Entrá a https://www.mercadopago.com.ar/developers/panel
2. Hacé clic en **"Crear aplicación"** → ponele un nombre como "Bufanditas".
3. Adentro de la aplicación, andá a **"Credenciales de producción"**.
4. Copiá el **Access Token** (el que empieza con `APP_USR-...`).

> Usá las credenciales de **producción** para cobrar de verdad. Si querés probar antes, usá las de **test**, pero las compras serán simuladas.

### 2.2 — Guardar el token en Vercel

1. En Vercel, andá a tu proyecto → **Settings → Environment Variables**.
2. Agregá una variable:
   - **Key**: `MP_ACCESS_TOKEN`
   - **Value**: el token que copiaste
3. Apretá **Save** y redeployá (botón "Redeploy" en la pestaña Deployments).

---

## 3. Activar el almacenamiento (Vercel KV)

Esto guarda el stock y los pedidos.

1. En Vercel, andá a tu proyecto → **Storage**.
2. Hacé clic en **Create Database** → elegí **KV (Redis)**.
3. Ponele un nombre cualquiera (ej. `bufandita-kv`) y dale **Create**.
4. Cuando te pregunte "Connect to project", elegí tu proyecto y dale **Connect**.

> Listo. Las funciones del backend ya saben cómo usarlo automáticamente.

---

## 4. Crear tu clave de admin

1. En Vercel → **Settings → Environment Variables**, agregá:
   - **Key**: `ADMIN_PASSWORD`
   - **Value**: una clave que solo vos sepas (ej. `MiBufandita2025!`)
2. Redeployá.

Ahora, para gestionar el stock, andá a:
**`https://tu-app.vercel.app/admin.html`** e ingresá tu clave.

---

## 5. Email de notificación de ventas (opcional pero útil)

Cuando alguien paga, te llega un email con el detalle del diseño y link al comprobante.

1. Entrá a https://resend.com y registrate gratis.
2. En el panel, andá a **API Keys** → **Create API Key** → copiá el valor.
3. En Vercel → **Settings → Environment Variables**, agregá:
   - `RESEND_API_KEY` = tu API key de Resend
   - `SELLER_EMAIL` = tu email personal (a donde te lleguen las ventas)
4. Redeployá.

> Resend te da 100 emails por día gratis, más que suficiente.

---

## 6. ¡Probar todo!

1. Andá a `https://tu-app.vercel.app/admin.html`, ingresá tu clave, marcá un par de colores como "sin stock". Comprobá que se guardan al recargar.
2. Andá a `https://tu-app.vercel.app/`, fijate que esos colores aparezcan tachados.
3. Diseñá una bufanda y dale "Quiero esta bufanda".
4. Completá tus datos (con un email real al que tengas acceso) y pagá una prueba.
5. Si todo va bien, recibís un email con el detalle y volvés a la página con un cartel de "¡Pago recibido!".

---

## Cosas para personalizar

### Cambiar precios
Hay que cambiarlos en **dos lugares** para que el cliente y el server coincidan:

- `public/index.html` — buscá la función `computePrice`
- `api/create-payment.js` — buscá la función `validatePrice`

### Agregar o editar colores
Editá `public/colors.js`. Es una lista plana, fácil de modificar.

### Cambiar título o textos
Están en `public/index.html`. Buscá "Diseñá tu bufandita!!" y cambialo.

---

## Estructura de archivos

```
bufandita-app/
├── package.json
├── vercel.json
├── README.md (este archivo)
├── public/
│   ├── index.html       ← página del cliente
│   ├── admin.html       ← panel de stock
│   └── colors.js        ← lista de los 57 colores
└── api/
    ├── _jwt.js          ← helper para tokens
    ├── admin-login.js   ← login del admin
    ├── stock.js         ← lectura/escritura del stock
    ├── create-payment.js← crear preferencia de pago
    └── mp-webhook.js    ← recibe notificación de MP y manda email
```

---

## Problemas comunes

**Q: "No se generó el link de pago"**
→ Falta `MP_ACCESS_TOKEN` o está mal copiado. Revisá en Settings → Environment Variables y redeployá.

**Q: "Pago aprobado pero no me llega email"**
→ Revisá `RESEND_API_KEY` y `SELLER_EMAIL`. Mirá los logs en Vercel → Functions.

**Q: "El admin no guarda los cambios"**
→ Verificá que tengas Vercel KV activado y conectado al proyecto.

**Q: "Quiero probar sin pagar de verdad"**
→ Usá el **Access Token de TEST** de Mercado Pago. Las compras simuladas no descuentan plata.

---

¡Listo! Cualquier duda, avisame.
