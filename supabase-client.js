// Cliente compartido de Supabase y valores predeterminados del sitio.
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const configurado = () =>
  Boolean(window.GABO_SUPABASE_URL && window.GABO_SUPABASE_ANON_KEY);

let promesa = null;
export function obtenerCliente() {
  if (!configurado()) return Promise.resolve(null);
  promesa ??= import(CDN).then(({ createClient }) =>
    createClient(window.GABO_SUPABASE_URL.trim(), window.GABO_SUPABASE_ANON_KEY.trim()));
  return promesa;
}

// Textos y datos que la administradora puede cambiar desde el panel.
export const AJUSTES = [
  { clave: 'hero_titulo', etiqueta: 'Título principal (primera parte)', valor: 'Diseñamos tus espacios y' },
  { clave: 'hero_destacado', etiqueta: 'Título principal (parte resaltada)', valor: 'hacemos realidad tus ideas.' },
  { clave: 'hero_subtitulo', etiqueta: 'Texto de presentación', valor: 'Diseño, fabricación e instalación de cocinas, clósets, puertas y centros de entretenimiento en melamina, aglomerado RH y MDF laminado.', largo: true },
  { clave: 'aviso', etiqueta: 'Aviso superior (opcional, ej. promoción o vacaciones)', valor: '', ayuda: 'Déjalo vacío para ocultarlo.' },
  { clave: 'whatsapp', etiqueta: 'Número de WhatsApp (con 57, solo números)', valor: '573245897519', tipo: 'tel', ayuda: 'Ejemplo: 573245897519' },
  { clave: 'telefono_visible', etiqueta: 'Teléfono como se muestra', valor: '324 589 7519' },
  { clave: 'ciudad', etiqueta: 'Ciudad / ubicación', valor: 'Mosquera, Cundinamarca' },
  { clave: 'horario', etiqueta: 'Horario de atención (opcional)', valor: '', ayuda: 'Ej. Lunes a sábado, 8:00 a. m. – 5:00 p. m.' },
  { clave: 'correo', etiqueta: 'Correo de contacto (opcional)', valor: '', tipo: 'email' },
  { clave: 'instagram', etiqueta: 'Enlace de Instagram (opcional)', valor: '', tipo: 'url' },
  { clave: 'facebook', etiqueta: 'Enlace de Facebook (opcional)', valor: '', tipo: 'url' },
  { clave: 'tiktok', etiqueta: 'Enlace de TikTok (opcional)', valor: '', tipo: 'url' },
];

export const PREDETERMINADOS = Object.fromEntries(AJUSTES.map(a => [a.clave, a.valor]));

export const CATEGORIAS = ['Cocinas', 'Clósets', 'Centros de entretenimiento', 'Puertas', 'Otros muebles'];
