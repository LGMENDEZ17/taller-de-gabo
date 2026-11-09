/* El Taller de Gabo · página pública
   Script clásico (no módulo): funciona aunque la página se abra con doble clic
   desde el computador y en cualquier navegador. Supabase se carga aparte y,
   si falla, la página y el formulario siguen funcionando. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var WA_PREDETERMINADO = '573245897519';
  var TEL_PREDETERMINADO = '324 589 7519';
  var ajustes = { whatsapp: WA_PREDETERMINADO, telefono_visible: TEL_PREDETERMINADO };
  var sb = null;

  $('year').textContent = new Date().getFullYear();

  /* ---------- Formulario de cotización (lo primero, para que nunca falle) ---------- */
  var form = $('quoteForm');
  var esMovil = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  function numeroWA() {
    var n = String(ajustes.whatsapp || WA_PREDETERMINADO).replace(/\D/g, '');
    if (n.length === 10 && n.charAt(0) === '3') n = '57' + n;
    return n.length >= 11 ? n : WA_PREDETERMINADO;
  }

  function guardarSolicitud(datos) {
    if (!sb) return Promise.resolve();
    return sb.from('solicitudes').insert(datos).then(function (r) {
      if (r.error) console.warn('No se guardó la solicitud en el panel:', r.error.message);
    }, function () {});
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = function (id) { return ($(id).value || '').trim(); };
    var note = $('formNote');
    if (v('sitio_web')) return; // trampa anti-spam
    if (v('nombre').length < 2) {
      note.textContent = 'Escribe tu nombre para continuar.'; note.classList.add('error');
      $('nombre').focus(); return;
    }
    note.classList.remove('error');
    var datos = {
      nombre: v('nombre').slice(0, 100), telefono: v('telefono').slice(0, 30), servicio: v('servicio'),
      medidas: v('medidas').slice(0, 500), ciudad: v('ciudad').slice(0, 100), detalles: v('detalles').slice(0, 1500)
    };
    var mensaje = 'Hola, El Taller de Gabo. Quiero solicitar una cotización.\n\n' +
      'Nombre: ' + datos.nombre + '\n' + (datos.telefono ? 'Teléfono: ' + datos.telefono + '\n' : '') +
      'Servicio: ' + datos.servicio + '\nMedidas: ' + (datos.medidas || 'Por definir') + '\n' +
      'Ciudad: ' + (datos.ciudad || 'Por definir') + '\nDetalles: ' + (datos.detalles || 'Por definir');
    var url = 'https://wa.me/' + numeroWA() + '?text=' + encodeURIComponent(mensaje);

    note.innerHTML = '';
    note.append('Abriendo WhatsApp… Si no se abre, ');
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'toca aquí para enviar tu solicitud';
    note.append(a, '.');

    if (esMovil) {
      // En celular: se guarda la solicitud (máx. 1,5 s de espera) y luego se abre la app de WhatsApp.
      var ir = function () { window.location.href = url; };
      Promise.race([guardarSolicitud(datos), new Promise(function (r) { setTimeout(r, 1500); })]).then(ir, ir);
    } else {
      // En computador: nueva pestaña de inmediato (si se espera, el navegador la bloquea).
      var w = window.open(url, '_blank');
      if (w) { try { w.opener = null; } catch (err) {} }
      else window.location.href = url; // ventana emergente bloqueada → abrir en la misma pestaña
      guardarSolicitud(datos);
    }
    form.reset();
  });

  /* ---------- Menú móvil y cabecera ---------- */
  var toggle = $('menuToggle'), menu = $('menu');
  toggle.addEventListener('click', function () {
    var open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('menu-open', open);
  });
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) { toggle.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open'); }
  });
  var onScroll = function () { document.body.classList.toggle('scrolled', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- Contenido editable ---------- */
  var urlSegura = function (v) { return /^https?:\/\//i.test(v || '') ? v : ''; };
  function aplicarAjustes() {
    document.querySelectorAll('[data-ajuste]').forEach(function (el) {
      var v = ajustes[el.dataset.ajuste];
      if (v) el.textContent = v;
    });
    $('aviso').classList.toggle('hidden', !ajustes.aviso);
    document.querySelectorAll('[data-show]').forEach(function (el) {
      var k = el.dataset.show;
      var ok = ['instagram', 'facebook', 'tiktok'].indexOf(k) >= 0 ? urlSegura(ajustes[k]) : ajustes[k];
      el.classList.toggle('hidden', !ok);
    });
    document.querySelectorAll('[data-link]').forEach(function (a) {
      var k = a.dataset.link;
      if (k === 'whatsapp') a.href = 'https://wa.me/' + numeroWA();
      else if (k === 'correo' && ajustes.correo) a.href = 'mailto:' + ajustes.correo;
      else if (urlSegura(ajustes[k])) a.href = ajustes[k];
    });
  }

  /* ---------- Portafolio ---------- */
  var gallery = $('gallery');
  var filtro = 'todos';

  function figura(r) {
    var fig = document.createElement('figure');
    fig.dataset.cat = r.categoria;
    if (r.destacado) fig.classList.add('destacado');
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'zoom';
    var img = document.createElement('img'); img.src = r.imagen_url; img.alt = r.titulo; img.loading = 'lazy';
    btn.append(img);
    var cap = document.createElement('figcaption');
    var t = document.createElement('strong'); t.textContent = r.titulo;
    var c = document.createElement('span'); c.textContent = r.categoria;
    cap.append(t, c);
    if (r.descripcion) { var p = document.createElement('p'); p.textContent = r.descripcion; cap.append(p); }
    fig.append(btn, cap);
    return fig;
  }

  function filtrar() {
    var n = 0;
    gallery.querySelectorAll('figure').forEach(function (f) {
      var show = filtro === 'todos' || f.dataset.cat === filtro;
      f.hidden = !show; if (show) n++;
    });
    $('galleryEmpty').classList.toggle('hidden', n > 0);
  }
  $('filters').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    filtro = b.dataset.cat;
    $('filters').querySelectorAll('.chip').forEach(function (c) {
      var on = c === b; c.classList.toggle('active', on); c.setAttribute('aria-pressed', on);
    });
    filtrar();
  });

  /* ---------- Visor de imágenes ---------- */
  var lb = $('lightbox'), actual = 0;
  var visibles = function () { return Array.prototype.slice.call(gallery.querySelectorAll('figure:not([hidden])')); };
  function mostrar(i) {
    var figs = visibles(); if (!figs.length) return;
    actual = (i + figs.length) % figs.length;
    var f = figs[actual], img = f.querySelector('img');
    $('lbImg').src = img.src; $('lbImg').alt = img.alt;
    $('lbCap').textContent = Array.prototype.map.call(f.querySelectorAll('figcaption > *'), function (n) { return n.textContent; }).join(' · ');
  }
  gallery.addEventListener('click', function (e) {
    var b = e.target.closest('.zoom'); if (!b) return;
    mostrar(visibles().indexOf(b.closest('figure')));
    if (lb.showModal) lb.showModal(); else window.open($('lbImg').src, '_blank');
  });
  $('lbClose').onclick = function () { lb.close(); };
  $('lbPrev').onclick = function () { mostrar(actual - 1); };
  $('lbNext').onclick = function () { mostrar(actual + 1); };
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') mostrar(actual - 1);
    if (e.key === 'ArrowRight') mostrar(actual + 1);
  });

  /* ---------- Datos desde Supabase (opcional) ---------- */
  function cargar() {
    var url = window.GABO_SUPABASE_URL, key = window.GABO_SUPABASE_ANON_KEY;
    if (!url || !key) { filtrar(); return; }
    import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm').then(function (mod) {
      sb = mod.createClient(url.trim(), key.trim());
      return Promise.all([
        sb.from('ajustes').select('clave,valor'),
        sb.from('referencias').select('titulo,categoria,descripcion,imagen_url,destacado,orden,created_at')
          .eq('publicado', true)
          .order('destacado', { ascending: false }).order('orden', { ascending: true }).order('created_at', { ascending: false })
      ]);
    }).then(function (res) {
      var aj = res[0], refs = res[1];
      // Se ignora el número antiguo si quedó guardado en el panel.
      var viejo = { whatsapp: '573014654113', telefono_visible: '301 465 4113' };
      if (!aj.error && aj.data) aj.data.forEach(function (x) {
        if ((x.clave === 'whatsapp' || x.clave === 'telefono_visible') && (!x.valor || x.valor === viejo[x.clave])) return;
        ajustes[x.clave] = x.valor;
      });
      aplicarAjustes();
      if (!refs.error && refs.data && refs.data.length) {
        var frag = document.createDocumentFragment();
        refs.data.forEach(function (r) { frag.append(figura(r)); });
        gallery.prepend(frag);
        if (refs.data.length >= 3) {
          gallery.querySelectorAll('.ilustrativa').forEach(function (f) { f.remove(); });
          $('portafolioIntro').textContent = 'Algunos de los proyectos que hemos diseñado, fabricado e instalado.';
        }
      }
      filtrar();
    }).catch(function (err) {
      console.warn('No se pudo cargar el contenido dinámico:', err && err.message);
      filtrar();
    });
  }
  aplicarAjustes();
  cargar();
})();
