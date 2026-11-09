# El Taller de Gabo — sitio web + panel de administración

Sitio estático para **GitHub Pages** con panel privado sobre **Supabase**.
👉 **Para publicarlo, sigue [GUIA_DESPLIEGUE.md](GUIA_DESPLIEGUE.md).**

## Página pública (`index.html`)
- Cabecera clara y compacta con el logo, fija al hacer scroll y con menú desplegable en celular.
- Portada, servicios, **portafolio con filtros por categoría y visor de fotos ampliadas**, materiales, cómo trabajamos y preguntas frecuentes.
- Formulario de cotización: abre WhatsApp con el mensaje listo **y** guarda la solicitud en el panel.
- Botón flotante de WhatsApp, datos para Google (SEO local) y vista previa al compartir el enlace.
- Textos de portada, WhatsApp, ciudad, horario, correo, redes sociales y aviso superior **editables desde el panel**.
- Sin precios publicados.

## Panel de administración (`admin.html`)
| Pestaña | Qué permite |
|---|---|
| Resumen | Contadores y últimas solicitudes |
| Solicitudes | Ver, buscar y filtrar cotizaciones; cambiar estado (nueva, contactada, cotizada, cerrada); notas internas; responder por WhatsApp; exportar CSV |
| Portafolio | Subir fotos (se optimizan solas), editar, ocultar/publicar, destacar, ordenar y eliminar (borra también la foto) |
| Textos y contacto | Editar los textos y datos de contacto de la web sin tocar código |
| Despiece | Generar piezas de un módulo, plano de corte por lámina, imprimir/PDF y CSV. Se recuerda el último despiece |
| Mi cuenta | Cambiar contraseña. En el inicio de sesión hay "¿Olvidaste tu contraseña?" |

La seguridad depende de las reglas RLS de `supabase.sql`, no del navegador.

## Archivos
| Archivo | Uso |
|---|---|
| `index.html`, `script.js` | Página pública |
| `admin.html`, `admin.js` | Panel privado |
| `supabase-client.js` | Conexión compartida y textos predeterminados |
| `config.js` | URL y clave pública de Supabase (o usa variables de GitHub) |
| `styles.css` | Estilos de todo el sitio |
| `supabase.sql` | Tablas, permisos y almacenamiento (se puede ejecutar varias veces) |
| `.github/workflows/publicar.yml` | Publicación automática en GitHub Pages |
| `assets/` | Logo (cabecera, completo y versión clara para fondo oscuro), favicon e imagen para redes |

## Notas
- **Despiece:** heurística por estantes; no garantiza el mínimo desperdicio ni es una secuencia de corte industrial. Verifica tolerancias, cantos, veta y herrajes antes de fabricar.
- **Fotos ilustrativas:** el portafolio muestra 3 imágenes de referencia (Unsplash) hasta que haya 3 o más trabajos reales publicados.
- **Precios:** el PDF privado de precios no se incluye y `.gitignore` evita subir PDF por error.
