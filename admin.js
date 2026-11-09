import { obtenerCliente, configurado, AJUSTES, PREDETERMINADOS, CATEGORIAS } from './supabase-client.js';

const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...hijos) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) k.includes('-') ? n.setAttribute(k, v) : (n[k] = v);
  n.append(...hijos); return n;
};
function msg(texto, tipo = '') { const s = $('status'); s.textContent = texto; s.className = 'status ' + tipo; }
const fecha = iso => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const show = (id, on) => $(id).classList.toggle('hidden', !on);

let sb = null, refs = [], leads = [], ajustes = { ...PREDETERMINADOS };
let recuperando = /type=recovery/.test(location.hash);

/* =================== Pestañas =================== */
const tabs = [...document.querySelectorAll('.tab')];
function irA(nombre) {
  tabs.forEach(t => {
    const on = t.id === 'tab-' + nombre;
    t.setAttribute('aria-selected', on);
    $(t.getAttribute('aria-controls')).hidden = !on;
  });
  try { sessionStorage.setItem('gabo-tab', nombre); } catch {}
}
tabs.forEach(t => t.addEventListener('click', () => irA(t.id.replace('tab-', ''))));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => irA(b.dataset.go)));

/* =================== Autenticación =================== */
async function iniciar() {
  if (!configurado()) {
    msg('El panel aún no está conectado a Supabase. Sigue los pasos de abajo para activarlo.');
    show('setupPanel', true);
    return;
  }
  try {
    sb = await obtenerCliente();
  } catch (e) {
    msg('No se pudo conectar con Supabase. Revisa tu conexión a internet. (' + e.message + ')', 'error');
    return;
  }
  sb.auth.onAuthStateChange((evento, sesion) => {
    if (evento === 'PASSWORD_RECOVERY') { recuperando = true; }
    setTimeout(() => actualizarSesion(sesion), 0);
  });
  const { data: { session } } = await sb.auth.getSession();
  await actualizarSesion(session);
}

let turno = 0;
async function actualizarSesion(sesion) {
  const mio = ++turno;
  if (recuperando && sesion) {
    show('loginPanel', false); show('privatePanel', false); show('recoveryPanel', true);
    msg('Escribe tu nueva contraseña.');
    return;
  }
  let admin = false;
  if (sesion) {
    const { data, error } = await sb.from('administradores').select('user_id').eq('user_id', sesion.user.id).maybeSingle();
    admin = Boolean(data && !error);
  }
  if (mio !== turno) return;
  show('recoveryPanel', false);
  show('loginPanel', !admin);
  show('privatePanel', admin);
  if (admin) {
    $('currentUser').textContent = 'Sesión iniciada como ' + sesion.user.email;
    msg('');
    let tab = 'resumen'; try { tab = sessionStorage.getItem('gabo-tab') || tab; } catch {}
    irA(tab);
    await Promise.all([cargarSolicitudes(), cargarReferencias(), cargarAjustes()]);
  } else if (sesion) {
    msg('Esta cuenta no tiene permiso de administración. Revisa el paso 6 de supabase.sql.', 'error');
    await sb.auth.signOut();
  } else {
    msg('');
  }
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); if (!sb) return;
  msg('Verificando acceso…');
  const { error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
  if (error) msg(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : 'No fue posible iniciar sesión: ' + error.message, 'error');
});

$('forgot').addEventListener('click', async () => {
  if (!sb) return;
  const email = $('email').value.trim();
  if (!email) { msg('Escribe tu correo primero.', 'error'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  msg(error ? 'No se pudo enviar el correo: ' + error.message : 'Te enviamos un correo con un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.', error ? 'error' : 'ok');
});

async function cambiarClave(p1, p2) {
  if (p1 !== p2) { msg('Las contraseñas no coinciden.', 'error'); return false; }
  if (p1.length < 8) { msg('Usa al menos 8 caracteres.', 'error'); return false; }
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { msg('No se pudo cambiar la contraseña: ' + error.message, 'error'); return false; }
  msg('Contraseña actualizada correctamente.', 'ok'); return true;
}
$('recoveryForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (await cambiarClave($('newPass1').value, $('newPass2').value)) {
    recuperando = false; history.replaceState(null, '', location.pathname);
    const { data: { session } } = await sb.auth.getSession();
    await actualizarSesion(session);
    msg('Contraseña actualizada. ¡Bienvenida!', 'ok');
  }
});
$('passwordForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (await cambiarClave($('chPass1').value, $('chPass2').value)) e.target.reset();
});

$('logout').addEventListener('click', async () => {
  if (sb) await sb.auth.signOut();
  show('privatePanel', false); show('loginPanel', true);
  $('password').value = '';
  msg('Sesión cerrada.', 'ok');
});

/* =================== Solicitudes =================== */
const ESTADOS = { nueva: 'Nueva', contactada: 'Contactada', cotizada: 'Cotizada', cerrada: 'Cerrada' };

async function cargarSolicitudes() {
  const { data, error } = await sb.from('solicitudes').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) { msg('No se pudieron cargar las solicitudes: ' + error.message + '. ¿Ejecutaste la versión nueva de supabase.sql?', 'error'); return; }
  leads = data || [];
  pintarSolicitudes(); resumen();
}

function telefonoWA(t) {
  let d = (t || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) d = '57' + d;
  return d.length >= 11 ? d : '';
}

function tarjetaSolicitud(l, compacta = false) {
  const card = el('article', { className: 'lead' });
  card.dataset.estado = l.estado;
  const head = el('div', { className: 'lead-head' },
    el('strong', { textContent: l.nombre }),
    el('span', { className: 'muted small', textContent: fecha(l.created_at) + ' · ' + ESTADOS[l.estado] }));
  const dl = el('dl');
  const fila = (k, v) => { if (v) dl.append(el('dt', { textContent: k }), el('dd', { textContent: v })); };
  fila('Servicio', l.servicio); fila('Teléfono', l.telefono); fila('Ciudad', l.ciudad);
  if (!compacta) { fila('Medidas', l.medidas); fila('Detalles', l.detalles); }
  card.append(head, dl);
  if (compacta) return card;

  const estado = el('select', { 'aria-label': 'Estado' });
  for (const [v, t] of Object.entries(ESTADOS)) estado.append(el('option', { value: v, textContent: t }));
  estado.value = l.estado;
  estado.addEventListener('change', async () => {
    const { error } = await sb.from('solicitudes').update({ estado: estado.value }).eq('id', l.id);
    if (error) { msg('Error: ' + error.message, 'error'); estado.value = l.estado; return; }
    l.estado = estado.value; card.dataset.estado = l.estado; resumen();
    head.lastChild.textContent = fecha(l.created_at) + ' · ' + ESTADOS[l.estado];
  });
  const notas = el('textarea', { value: l.notas || '', placeholder: 'Notas internas (solo las ves tú): valor cotizado, fecha de visita…', maxLength: 1500 });
  const guardar = el('button', { type: 'button', className: 'smallbtn secondary', textContent: 'Guardar nota' });
  guardar.onclick = async () => {
    const { error } = await sb.from('solicitudes').update({ notas: notas.value.trim() }).eq('id', l.id);
    if (error) msg('Error: ' + error.message, 'error'); else { l.notas = notas.value.trim(); msg('Nota guardada.', 'ok'); }
  };
  const acciones = el('div', { className: 'admin-actions' }, estado, guardar);
  const wa = telefonoWA(l.telefono);
  if (wa) {
    const texto = `Hola ${l.nombre.split(' ')[0]}, te saluda El Taller de Gabo. Recibimos tu solicitud de cotización para: ${l.servicio}.`;
    acciones.append(el('a', { className: 'smallbtn', href: `https://wa.me/${wa}?text=${encodeURIComponent(texto)}`, target: '_blank', rel: 'noopener', textContent: 'Responder por WhatsApp' }));
  }
  const borrar = el('button', { type: 'button', className: 'smallbtn danger', textContent: 'Eliminar' });
  borrar.onclick = async () => {
    if (!confirm(`¿Eliminar la solicitud de ${l.nombre}? Esta acción no se puede deshacer.`)) return;
    const { error } = await sb.from('solicitudes').delete().eq('id', l.id);
    if (error) msg('Error: ' + error.message, 'error'); else { leads = leads.filter(x => x.id !== l.id); pintarSolicitudes(); resumen(); }
  };
  acciones.append(borrar);
  card.append(notas, acciones);
  return card;
}

function pintarSolicitudes() {
  const f = $('leadFilter').value, q = $('leadSearch').value.trim().toLowerCase();
  const lista = leads.filter(l => (!f || l.estado === f) &&
    (!q || [l.nombre, l.ciudad, l.servicio, l.telefono, l.detalles].join(' ').toLowerCase().includes(q)));
  const cont = $('leadList'); cont.replaceChildren();
  if (!lista.length) cont.append(el('p', { className: 'muted', textContent: leads.length ? 'No hay solicitudes con ese filtro.' : 'Todavía no han llegado solicitudes desde la web.' }));
  lista.forEach(l => cont.append(tarjetaSolicitud(l)));
}
$('leadFilter').addEventListener('change', pintarSolicitudes);
$('leadSearch').addEventListener('input', pintarSolicitudes);
$('leadsRefresh').addEventListener('click', async () => { await cargarSolicitudes(); msg('Solicitudes actualizadas.', 'ok'); });
$('leadsCSV').addEventListener('click', () => {
  if (!leads.length) { msg('No hay solicitudes para exportar.', 'error'); return; }
  descargarCSV('solicitudes-gabo.csv', [['Fecha', 'Nombre', 'Telefono', 'Servicio', 'Ciudad', 'Medidas', 'Detalles', 'Estado', 'Notas'],
    ...leads.map(l => [fecha(l.created_at), l.nombre, l.telefono, l.servicio, l.ciudad, l.medidas, l.detalles, ESTADOS[l.estado], l.notas])]);
});

function resumen() {
  const nuevas = leads.filter(l => l.estado === 'nueva').length;
  $('stNuevas').textContent = nuevas; $('stTotal').textContent = leads.length;
  $('badgeNuevas').textContent = nuevas || '';
  $('stPublicadas').textContent = refs.filter(r => r.publicado).length;
  $('stOcultas').textContent = refs.filter(r => !r.publicado).length;
  const rec = $('recentLeads'); rec.replaceChildren();
  if (!leads.length) rec.append(el('p', { className: 'muted', textContent: 'Aún no hay solicitudes. Llegarán aquí cuando los clientes usen el formulario de la web.' }));
  leads.slice(0, 3).forEach(l => rec.append(tarjetaSolicitud(l, true)));
}

/* =================== Portafolio =================== */
CATEGORIAS.forEach(c => $('refCategory').append(el('option', { textContent: c })));

async function cargarReferencias() {
  const { data, error } = await sb.from('referencias').select('*')
    .order('destacado', { ascending: false }).order('orden', { ascending: true }).order('created_at', { ascending: false });
  if (error) { msg('No se pudo cargar el portafolio: ' + error.message, 'error'); return; }
  refs = data || [];
  pintarReferencias(); resumen();
}

const rutaArchivo = r => r.storage_path || (r.imagen_url.split('/object/public/galeria/')[1] || '').split('?')[0];

function pintarReferencias() {
  const cont = $('referenceList'); cont.replaceChildren();
  if (!refs.length) cont.append(el('p', { className: 'muted', textContent: 'Aún no has subido trabajos. ¡Empieza con la foto de tu mejor proyecto!' }));
  for (const r of refs) {
    const tags = el('div', { className: 'tags' }, el('span', { className: 'tag', textContent: r.categoria }));
    if (r.destacado) tags.append(el('span', { className: 'tag star', textContent: '★ Destacado' }));
    if (!r.publicado) tags.append(el('span', { className: 'tag off', textContent: 'Oculto' }));
    const b = (txt, cls, fn) => { const x = el('button', { type: 'button', className: 'smallbtn ' + cls, textContent: txt }); x.onclick = fn; return x; };
    const cambiar = async (campos, ok) => {
      const { error } = await sb.from('referencias').update(campos).eq('id', r.id);
      if (error) msg('Error: ' + error.message, 'error'); else { msg(ok, 'ok'); await cargarReferencias(); }
    };
    cont.append(el('div', { className: 'ref' + (r.publicado ? '' : ' oculta') },
      el('img', { src: r.imagen_url, alt: r.titulo, loading: 'lazy' }),
      el('div', { className: 'ref-body' }, el('strong', { textContent: r.titulo }), el('small', { textContent: r.descripcion || 'Sin descripción' }), tags),
      el('div', { className: 'ref-actions' },
        b('Editar', 'secondary', () => editar(r)),
        b(r.publicado ? 'Ocultar' : 'Publicar', 'secondary', () => cambiar({ publicado: !r.publicado }, r.publicado ? 'Trabajo oculto de la web.' : 'Trabajo publicado en la web.')),
        b(r.destacado ? 'Quitar ★' : '★ Destacar', 'secondary', () => cambiar({ destacado: !r.destacado }, 'Listo.')),
        b('Eliminar', 'danger', async () => {
          if (!confirm(`¿Eliminar «${r.titulo}» y su foto? No se puede deshacer.`)) return;
          const { error } = await sb.from('referencias').delete().eq('id', r.id);
          if (error) { msg('Error: ' + error.message, 'error'); return; }
          const ruta = rutaArchivo(r); if (ruta) await sb.storage.from('galeria').remove([ruta]);
          msg('Trabajo eliminado.', 'ok'); await cargarReferencias();
        }))));
  }
}

function editar(r) {
  $('refId').value = r.id; $('refTitle').value = r.titulo; $('refCategory').value = r.categoria;
  $('refDescription').value = r.descripcion || ''; $('refOrder').value = r.orden ?? 0;
  $('refPublished').checked = r.publicado; $('refFeatured').checked = r.destacado;
  vistaPrevia(r.imagen_url);
  $('refFormTitle').textContent = 'Editar trabajo'; $('refSave').textContent = 'Guardar cambios';
  $('referenceForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function limpiarFormulario() {
  $('referenceForm').reset(); $('refId').value = ''; vistaPrevia('');
  $('refFormTitle').textContent = 'Subir un trabajo nuevo'; $('refSave').textContent = 'Guardar trabajo';
}
$('clearReference').addEventListener('click', limpiarFormulario);

let previewURL = '';
function vistaPrevia(src) {
  if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = ''; }
  $('dropPreview').src = src || ''; $('dropPreview').classList.toggle('hidden', !src);
  $('dropText').classList.toggle('hidden', Boolean(src));
}
$('refImage').addEventListener('change', () => {
  const f = $('refImage').files[0]; if (!f) return;
  vistaPrevia(''); previewURL = URL.createObjectURL(f); $('dropPreview').src = previewURL;
  $('dropPreview').classList.remove('hidden'); $('dropText').classList.add('hidden');
});
const drop = $('drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('drag')));

// Reduce la foto (máx. 1800 px) para que cargue rápido en la web.
async function optimizar(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.85));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
    return blob && blob.size < file.size ? blob : file;
  } catch { return file; }
}

$('referenceForm').addEventListener('submit', async e => {
  e.preventDefault(); if (!sb) return;
  const id = $('refId').value, anterior = refs.find(r => r.id === id);
  const titulo = $('refTitle').value.trim();
  if (!titulo) { msg('Escribe un título.', 'error'); return; }
  let imagen_url = anterior?.imagen_url || '', storage_path = anterior ? rutaArchivo(anterior) : '';
  const original = $('refImage').files[0];
  const boton = $('refSave'); boton.disabled = true;
  try {
    if (original) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(original.type)) { msg('La foto debe ser JPG, PNG o WEBP.', 'error'); return; }
      msg('Optimizando y subiendo la foto…');
      const file = await optimizar(original);
      if (file.size > 5 * 1024 * 1024) { msg('La foto pesa más de 5 MB incluso optimizada. Prueba con otra.', 'error'); return; }
      const ext = { 'image/webp': 'webp', 'image/png': 'png' }[file.type] || 'jpg';
      const ruta = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from('galeria').upload(ruta, file, { contentType: file.type, cacheControl: '31536000' });
      if (error) { msg('No se pudo subir la foto: ' + error.message, 'error'); return; }
      imagen_url = sb.storage.from('galeria').getPublicUrl(ruta).data.publicUrl; storage_path = ruta;
    }
    if (!imagen_url) { msg('Selecciona una fotografía.', 'error'); return; }
    const datos = {
      titulo, categoria: $('refCategory').value, descripcion: $('refDescription').value.trim(), imagen_url, storage_path,
      publicado: $('refPublished').checked, destacado: $('refFeatured').checked, orden: parseInt($('refOrder').value, 10) || 0,
    };
    const res = id ? await sb.from('referencias').update(datos).eq('id', id) : await sb.from('referencias').insert(datos);
    if (res.error) { msg('Error al guardar: ' + res.error.message, 'error'); return; }
    if (original && anterior) { const vieja = rutaArchivo(anterior); if (vieja && vieja !== storage_path) await sb.storage.from('galeria').remove([vieja]); }
    msg(datos.publicado ? '¡Trabajo guardado y visible en la web!' : 'Trabajo guardado (oculto en la web).', 'ok');
    limpiarFormulario(); await cargarReferencias();
  } finally { boton.disabled = false; }
});

/* =================== Textos y contacto =================== */
const campos = $('settingsFields');
for (const a of AJUSTES) {
  const input = a.largo ? el('textarea', { id: 'aj_' + a.clave, maxLength: 1000 }) : el('input', { id: 'aj_' + a.clave, type: a.tipo || 'text', maxLength: 1000 });
  const label = el('label', { className: a.largo ? 'span-2' : '' }, a.etiqueta, input);
  if (a.ayuda) label.append(el('span', { className: 'help', textContent: a.ayuda }));
  campos.append(label);
}
function llenarAjustes() { for (const a of AJUSTES) $('aj_' + a.clave).value = ajustes[a.clave] ?? ''; }
llenarAjustes();

async function cargarAjustes() {
  const { data, error } = await sb.from('ajustes').select('clave,valor');
  if (error) { msg('No se pudieron cargar los textos: ' + error.message, 'error'); return; }
  for (const { clave, valor } of data || []) ajustes[clave] = valor;
  llenarAjustes();
}
async function guardarAjustes(valores) {
  const filas = AJUSTES.map(a => ({ clave: a.clave, valor: (valores[a.clave] ?? '').trim(), updated_at: new Date().toISOString() }));
  const { error } = await sb.from('ajustes').upsert(filas, { onConflict: 'clave' });
  if (error) { msg('No se pudieron guardar los cambios: ' + error.message, 'error'); return; }
  filas.forEach(f => ajustes[f.clave] = f.valor); llenarAjustes();
  msg('Cambios guardados. Ya se ven en la página pública.', 'ok');
}
$('settingsForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = Object.fromEntries(AJUSTES.map(a => [a.clave, $('aj_' + a.clave).value]));
  v.whatsapp = v.whatsapp.replace(/\D/g, '');
  if (v.whatsapp && v.whatsapp.length < 11) { msg('El WhatsApp debe incluir el indicativo 57, por ejemplo 573245897519.', 'error'); return; }
  for (const k of ['instagram', 'facebook', 'tiktok']) if (v[k] && !/^https?:\/\//i.test(v[k])) { msg(`El enlace de ${k} debe empezar por https://`, 'error'); return; }
  guardarAjustes(v);
});
$('settingsReset').addEventListener('click', () => {
  if (confirm('¿Restaurar todos los textos y datos de contacto originales?')) guardarAjustes(PREDETERMINADOS);
});

/* =================== Utilidades =================== */
function descargarCSV(nombre, filas) {
  const q = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  const blob = new Blob(['﻿' + filas.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: nombre }); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* =================== Despiece =================== */
let placements = [], layouts = [];
const num = id => Number($(id).value);
const CAMPOS_DESPIECE = ['projectName', 'material', 'thickness', 'cabW', 'cabH', 'cabD', 'shelves', 'backPanel', 'sheetW', 'sheetH', 'kerf', 'margin'];

function addRow(name = '', w = 500, h = 300, q = 1, grain = true) {
  const tr = document.createElement('tr');
  const cell = (type, val, label) => {
    const inp = el('input', { type, 'aria-label': label });
    if (type === 'checkbox') inp.checked = val; else inp.value = val;
    if (type === 'number') { inp.min = 1; inp.step = 1; }
    inp.addEventListener('change', guardarDespiece);
    tr.append(el('td', {}, inp));
  };
  cell('text', name, 'Pieza'); cell('number', w, 'Ancho'); cell('number', h, 'Largo'); cell('number', q, 'Cantidad'); cell('checkbox', grain, 'Veta fija');
  const quitar = el('button', { type: 'button', className: 'smallbtn danger', textContent: 'Quitar' });
  quitar.onclick = () => { tr.remove(); guardarDespiece(); };
  tr.append(el('td', { className: 'no-print' }, quitar));
  $('partsBody').append(tr);
}
function guardarDespiece() {
  try {
    const filas = [...$('partsBody').rows].map(tr => { const v = tr.querySelectorAll('input'); return [v[0].value, v[1].value, v[2].value, v[3].value, v[4].checked]; });
    localStorage.setItem('gabo-despiece', JSON.stringify({ campos: Object.fromEntries(CAMPOS_DESPIECE.map(k => [k, $(k).value])), filas }));
  } catch {}
}
function restaurarDespiece() {
  try {
    const d = JSON.parse(localStorage.getItem('gabo-despiece') || 'null'); if (!d) return false;
    for (const [k, v] of Object.entries(d.campos || {})) if ($(k)) $(k).value = v;
    (d.filas || []).forEach(f => addRow(...f));
    return (d.filas || []).length > 0;
  } catch { return false; }
}
CAMPOS_DESPIECE.forEach(k => $(k).addEventListener('change', guardarDespiece));

$('addPart').onclick = () => { addRow('Nueva pieza'); guardarDespiece(); };
$('generateCabinet').onclick = () => {
  const w = num('cabW'), h = num('cabH'), d = num('cabD'), t = num('thickness'), s = num('shelves');
  if ([w, h, d, t].some(v => !Number.isFinite(v) || v <= 0) || w <= 2 * t || h <= 2 * t || !Number.isInteger(s) || s < 0 || s > 50) {
    $('cutSummary').textContent = 'Dimensiones o cantidad de entrepaños no válidas.'; return;
  }
  $('partsBody').replaceChildren();
  addRow('Costado', d, h, 2, true);
  addRow('Tapa y base', d, w - 2 * t, 2, true);
  if (s) addRow('Entrepaño', d, w - 2 * t, s, true);
  if ($('backPanel').value === 'si') addRow('Trasera', w, h, 1, true);
  $('cutSummary').textContent = 'Módulo básico: costados completos, tapa y base entre costados' + (s ? ', entrepaños' : '') +
    ($('backPanel').value === 'si' ? ' y trasera sobrepuesta' : '') + '. No incluye puertas, cajones, cantos ni holguras de herrajes.';
  guardarDespiece();
};

function readParts() {
  const out = [];
  for (const tr of $('partsBody').rows) {
    const v = [...tr.querySelectorAll('input')];
    const name = v[0].value.trim(), w = +v[1].value, h = +v[2].value, q = +v[3].value;
    if (!name || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || !Number.isInteger(q) || q < 1 || q > 500) throw Error('Revisa nombres, medidas y cantidades (1 a 500).');
    for (let k = 1; k <= q; k++) out.push({ name: name + ' #' + k, w, h, grain: v[4].checked });
  }
  if (!out.length) throw Error('Agrega al menos una pieza.');
  if (out.length > 1000) throw Error('Máximo 1000 piezas.');
  return out;
}

// Empaquetado por estantes: heurística determinista, no es un optimizador industrial.
function pack(parts, W, H, kerf, margin) {
  const usableW = W - 2 * margin, usableH = H - 2 * margin;
  if (usableW <= 0 || usableH <= 0) throw Error('Margen demasiado grande.');
  const pieces = [...parts].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
  const sheets = [];
  for (const piece of pieces) {
    const orientations = [{ w: piece.w, h: piece.h, rot: false }];
    if (!piece.grain && piece.w !== piece.h) orientations.push({ w: piece.h, h: piece.w, rot: true });
    if (!orientations.some(o => o.w <= usableW && o.h <= usableH)) throw Error('La pieza ' + piece.name + ' no cabe en la lámina, incluso con rotación permitida.');
    let placed = false;
    for (const sheet of sheets) {
      for (const shelf of sheet.shelves) {
        for (const o of orientations) {
          const x = shelf.nextX + (shelf.count ? kerf : 0);
          if (o.h <= shelf.height && x + o.w <= W - margin + 1e-6) { sheet.parts.push({ ...piece, ...o, x, y: shelf.y }); shelf.nextX = x + o.w; shelf.count++; placed = true; break; }
        }
        if (placed) break;
      }
      if (placed) break;
      const y = sheet.nextY + (sheet.shelves.length ? kerf : 0);
      for (const o of orientations) {
        if (y + o.h <= H - margin && o.w <= usableW) { sheet.shelves.push({ y, height: o.h, nextX: margin + o.w, count: 1 }); sheet.nextY = y + o.h; sheet.parts.push({ ...piece, ...o, x: margin, y }); placed = true; break; }
      }
      if (placed) break;
    }
    if (!placed) {
      const sheet = { parts: [], shelves: [], nextY: margin };
      const o = orientations.find(o => o.w <= usableW && o.h <= usableH);
      sheet.parts.push({ ...piece, ...o, x: margin, y: margin });
      sheet.shelves.push({ y: margin, height: o.h, nextX: margin + o.w, count: 1 });
      sheet.nextY = margin + o.h; sheets.push(sheet);
    }
  }
  return sheets;
}

const COLORES = ['#e8c69a', '#cfdcb8', '#d9d2c4', '#c9d8e0', '#ead1c4'];
$('calculate').onclick = () => {
  try {
    const W = num('sheetW'), H = num('sheetH'), k = num('kerf'), m = num('margin');
    if (![W, H, k, m].every(Number.isFinite) || W <= 0 || H <= 0 || k < 0 || m < 0) throw Error('Revisa las medidas de lámina, margen y ancho de sierra.');
    const parts = readParts();
    layouts = pack(parts, W, H, k, m);
    placements = layouts.flatMap((s, i) => s.parts.map(p => ({ ...p, sheet: i + 1 })));
    const area = parts.reduce((a, p) => a + p.w * p.h, 0);
    $('cutSummary').textContent = `${$('projectName').value} · ${$('material').value} · ${parts.length} piezas · ${layouts.length} lámina(s) · aprovechamiento teórico ${(100 * area / (layouts.length * W * H)).toFixed(1)} %. Coordenadas X/Y desde la esquina superior izquierda, en mm. Sierra: ${k} mm. Margen: ${m} mm. ↻ = pieza girada.`;
    const out = $('cutDrawings'); out.replaceChildren();
    const nombres = [...new Set(parts.map(p => p.name.replace(/ #\d+$/, '')))];
    layouts.forEach((sheet, i) => {
      out.append(el('p', { className: 'sheet-label', textContent: `Lámina ${i + 1} · ${W} × ${H} mm` }));
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', '750'); svg.classList.add('sheet');
      for (const p of sheet.parts) {
        const rect = document.createElementNS(NS, 'rect');
        const color = COLORES[nombres.indexOf(p.name.replace(/ #\d+$/, '')) % COLORES.length];
        for (const [a, v] of Object.entries({ x: p.x, y: p.y, width: p.w, height: p.h, fill: color, stroke: '#57422c', 'stroke-width': 3 })) rect.setAttribute(a, v);
        svg.append(rect);
        const fs = Math.max(14, Math.min(30, p.h * 0.3, p.w / 9));
        const label = document.createElementNS(NS, 'text');
        label.setAttribute('x', p.x + 10); label.setAttribute('y', p.y + fs + 6); label.setAttribute('font-size', fs); label.setAttribute('font-family', 'Arial');
        label.textContent = p.name + ' ' + p.w + '×' + p.h + (p.rot ? ' ↻' : '');
        svg.append(label);
      }
      out.append(svg);
    });
    const t = el('table', { className: 'parts-table' });
    const header = el('tr'); ['Lámina', 'Pieza', 'X (mm)', 'Y (mm)', 'Ancho (mm)', 'Largo (mm)', 'Girada'].forEach(c => header.append(el('th', { textContent: c })));
    t.append(header);
    for (const p of placements) { const tr = el('tr'); [p.sheet, p.name, p.x, p.y, p.w, p.h, p.rot ? 'Sí' : 'No'].forEach(v => tr.append(el('td', { textContent: String(v) }))); t.append(tr); }
    out.append(el('div', { className: 'table-wrap' }, t));
  } catch (err) {
    $('cutSummary').textContent = 'No se pudo calcular: ' + err.message;
    $('cutDrawings').replaceChildren(); placements = [];
  }
};
$('printCut').onclick = () => { if (!placements.length) { $('cutSummary').textContent = 'Calcula primero el plano de corte.'; return; } window.print(); };
$('exportCSV').onclick = () => {
  if (!placements.length) { $('cutSummary').textContent = 'Calcula primero el plano de corte.'; return; }
  descargarCSV('despiece-gabo.csv', [['Lamina', 'Pieza', 'X_mm', 'Y_mm', 'Ancho_mm', 'Largo_mm', 'Girada'], ...placements.map(p => [p.sheet, p.name, p.x, p.y, p.w, p.h, p.rot ? 'Si' : 'No'])]);
};
if (!restaurarDespiece()) $('generateCabinet').click();

iniciar();
