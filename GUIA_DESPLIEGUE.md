# Guía paso a paso: publicar El Taller de Gabo desde GitHub

Esta guía te lleva desde el archivo ZIP hasta la web publicada **con el panel de administración funcionando**. No necesitas instalar nada: todo se hace desde el navegador.

| Parte | Qué haces | Tiempo aprox. |
|---|---|---|
| 1 | Subir los archivos a GitHub | 10 min |
| 2 | Activar GitHub Pages (la web queda en línea) | 3 min |
| 3 | Crear la base de datos en Supabase | 10 min |
| 4 | Conectar GitHub con Supabase | 3 min |
| 5 | Probar todo | 5 min |

> Las cuentas de GitHub y Supabase son gratuitas para un sitio de este tamaño.

---

## Parte 1 · Subir los archivos a GitHub

1. Entra a **https://github.com** y crea una cuenta (o inicia sesión). Usa preferiblemente el correo del taller.
2. Arriba a la derecha pulsa **＋ › New repository**.
   - **Repository name:** `taller-de-gabo` (sin espacios ni tildes; este nombre aparecerá en la dirección web).
   - Marca **Public** (GitHub Pages es gratis solo con repositorios públicos).
   - **No** marques "Add a README".
   - Pulsa **Create repository**.
3. Descomprime el ZIP en tu computador. Verás una carpeta con `index.html`, `admin.html`, `assets`, etc.
4. En la página del repositorio recién creado pulsa el enlace **uploading an existing file**.
5. Abre la carpeta descomprimida, **selecciona todo su contenido** (no la carpeta, sino lo que hay dentro) y arrástralo a la ventana de GitHub.
6. Abajo, en **Commit changes**, pulsa el botón verde **Commit changes**.

### ⚠️ Importante: la carpeta oculta `.github`

El ZIP incluye la carpeta `.github/workflows/` que hace la publicación automática. Windows y Mac **ocultan** las carpetas que empiezan con punto, así que puede que no se haya subido. Compruébalo:

- En tu repositorio debe aparecer una carpeta llamada **`.github`**.
- **Si no aparece**, créala a mano:
  1. Pulsa **Add file › Create new file**.
  2. En el nombre escribe exactamente: `.github/workflows/publicar.yml` (al escribir cada `/` GitHub crea la carpeta).
  3. Abre el archivo `publicar.yml` del ZIP con el Bloc de notas (en Mac: TextEdit), copia todo su contenido y pégalo en GitHub.
     - En Windows, para ver la carpeta: Explorador › **Vista › Mostrar › Elementos ocultos**.
     - En Mac, en Finder pulsa **Cmd + Shift + .** (punto).
  4. Pulsa **Commit changes**.

---

## Parte 2 · Activar GitHub Pages

1. En el repositorio, entra a **Settings** (pestaña con el engranaje).
2. En el menú izquierdo pulsa **Pages**.
3. En **Build and deployment › Source** elige **GitHub Actions**.
4. Ve a la pestaña **Actions** del repositorio. Verás el proceso **"Publicar sitio en GitHub Pages"**.
   - Si aparece en rojo ❌ (porque corrió antes de activar Pages), ábrelo y pulsa **Re-run all jobs**.
   - Cuando esté en verde ✅ (≈ 1 minuto), la web ya está en línea.
5. Tu dirección será:

   ```
   https://TU-USUARIO.github.io/taller-de-gabo/
   ```

   (También aparece en **Settings › Pages**, con el botón **Visit site**.)

En este punto la web pública funciona completa (servicios, portafolio, formulario a WhatsApp). El panel de administración mostrará "Configuración pendiente" hasta terminar las partes 3 y 4.

---

## Parte 3 · Crear la base de datos en Supabase

Supabase guarda de forma segura las fotos, las solicitudes de clientes y los textos editables, y controla quién puede entrar al panel.

### 3.1 Crear el proyecto
1. Entra a **https://supabase.com** › **Start your project** e inicia sesión (puedes usar **Continue with GitHub**).
2. Pulsa **New project**:
   - **Name:** `taller-de-gabo`
   - **Database Password:** pulsa *Generate a password* y **guárdala** en un lugar seguro (no se pone en la web).
   - **Region:** `East US (North Virginia)` o `South America (São Paulo)`.
   - Pulsa **Create new project** y espera 1–2 minutos.

### 3.2 Crear las tablas
1. En el menú izquierdo abre **SQL Editor** › **New query**.
2. Abre el archivo `supabase.sql` del ZIP con el Bloc de notas, copia **todo** y pégalo.
3. Pulsa **Run** (o Ctrl + Enter). Debe decir *Success*. La tabla de resultados del final saldrá vacía: es normal por ahora.

### 3.3 Crear la cuenta de la administradora
1. Menú izquierdo › **Authentication** › **Users** › **Add user** › **Create new user**.
2. Escribe el correo (`eltallerdegabo01@gmail.com`) y una contraseña segura.
3. Marca **Auto Confirm User** y pulsa **Create user**.
4. Vuelve a **SQL Editor**, borra lo que haya, pega solo estas líneas y pulsa **Run**:

   ```sql
   insert into public.administradores (user_id)
   select id from auth.users where email = 'eltallerdegabo01@gmail.com'
   on conflict (user_id) do nothing;

   select u.email from public.administradores a join auth.users u on u.id = a.user_id;
   ```

   Debe aparecer el correo en los resultados. ✅ Si usas otro correo, cámbialo en ambas partes.

### 3.4 Cerrar el registro público (seguridad)
1. **Authentication** › **Sign In / Providers** (en algunas versiones: **Providers › Email**).
2. Desactiva **Allow new users to sign up** y guarda.
   Así nadie más puede crearse una cuenta.

### 3.5 Dirección de la web (para recuperar contraseña)
1. **Authentication** › **URL Configuration**.
2. **Site URL:** `https://TU-USUARIO.github.io/taller-de-gabo/`
3. En **Redirect URLs** pulsa **Add URL** y agrega: `https://TU-USUARIO.github.io/taller-de-gabo/admin.html`
4. Guarda.

### 3.6 Copiar las claves públicas
1. Menú izquierdo › **Project Settings** (engranaje) › **API** (o **Data API** / **API Keys**).
2. Copia estos dos valores:
   - **Project URL** → algo como `https://abcdxyz.supabase.co`
   - **anon public** key (empieza por `eyJ…`). Si solo ves claves nuevas, usa la **Publishable key** (`sb_publishable_…`).

> 🔒 **Nunca** copies la clave `service_role` / `secret` ni la contraseña de la base de datos a GitHub.

---

## Parte 4 · Conectar GitHub con Supabase

1. En tu repositorio de GitHub: **Settings** › **Secrets and variables** › **Actions**.
2. Abre la pestaña **Variables** (no "Secrets") › **New repository variable**:
   - **Name:** `SUPABASE_URL` · **Value:** la Project URL.
   - Pulsa **Add variable**.
3. Repite con:
   - **Name:** `SUPABASE_ANON_KEY` · **Value:** la clave anon / publishable.
4. Ve a **Actions** › **Publicar sitio en GitHub Pages** › **Run workflow** › **Run workflow**.
5. Espera a que quede en verde ✅.

> **Alternativa sin variables:** edita `config.js` directamente en GitHub (abre el archivo › ícono del lápiz ✏️), pega los dos valores entre las comillas y pulsa **Commit changes**. La web se vuelve a publicar sola.

---

## Parte 5 · Probar que todo funciona

1. Abre `https://TU-USUARIO.github.io/taller-de-gabo/admin.html`.
2. Inicia sesión con el correo y la contraseña de la parte 3.3.
3. **Portafolio:** sube una foto de prueba › abre la web pública › debe aparecer en "Portafolio de trabajos".
4. **Solicitudes:** en la web pública llena el formulario de cotización › vuelve al panel › pestaña **Solicitudes** › pulsa **↻ Actualizar**.
5. **Textos y contacto:** cambia, por ejemplo, el horario › Guardar › recarga la web pública.

Si los cambios no se ven, recarga con **Ctrl + F5** (en celular, cierra y abre la pestaña).

---

## Cómo actualizar la web más adelante

| Quiero… | Cómo |
|---|---|
| Subir fotos, cambiar textos, WhatsApp, horario, redes | Desde **admin.html** (no hay que tocar GitHub) |
| Cambiar el diseño o el código | En GitHub abre el archivo › ✏️ › edita › **Commit changes**. Se publica solo en ~1 minuto. |
| Reemplazar varios archivos | **Add file › Upload files** › arrastra los archivos nuevos › **Commit changes** |
| Usar un dominio propio (ej. `eltallerdegabo.com`) | Compra el dominio › **Settings › Pages › Custom domain** › sigue las instrucciones DNS de GitHub |

---

## Solución de problemas

| Síntoma | Causa probable y solución |
|---|---|
| La pestaña **Actions** no muestra nada | Falta la carpeta `.github/workflows/publicar.yml`. Ver "carpeta oculta" en la Parte 1. |
| Actions en rojo con "Pages not enabled" | En **Settings › Pages** elige **Source: GitHub Actions** y pulsa **Re-run all jobs**. |
| Error 404 al abrir la web | Espera 1–2 minutos tras el primer despliegue y revisa que la dirección incluya `/taller-de-gabo/`. |
| El panel dice "Configuración pendiente" | Faltan las variables de la Parte 4 o no se volvió a ejecutar el workflow. |
| "Correo o contraseña incorrectos" | Revisa el usuario en **Authentication › Users**; puedes cambiar la contraseña desde ahí (menú ⋯ › *Send password recovery* o editar). |
| "Esta cuenta no tiene permiso de administración" | No se ejecutó el paso 3.3 punto 4 (o el correo no coincide). |
| "relation … does not exist" o "No se pudieron cargar las solicitudes" | No se ejecutó `supabase.sql` completo. Ejecútalo de nuevo (se puede repetir sin problema). |
| El enlace de recuperar contraseña lleva a otra página | Revisa la Parte 3.5 (Site URL y Redirect URLs). |
| La foto no sube | Debe ser JPG, PNG o WEBP. El panel la optimiza; si aun así supera 5 MB, usa otra. |
| El proyecto de Supabase aparece "Paused" | En el plan gratuito se pausa tras ~1 semana sin visitas. Entra a supabase.com y pulsa **Restore project**. |

---

## Seguridad en resumen

- La clave **anon / publishable** es pública por diseño: puede estar en la web.
- La protección real la dan las reglas (RLS) de `supabase.sql`: solo las cuentas de la tabla `administradores` pueden ver solicitudes, subir fotos o cambiar textos.
- **Nunca** subas a GitHub: contraseñas, la clave `service_role`, ni el PDF privado de precios (el archivo `.gitignore` ya excluye los PDF).
