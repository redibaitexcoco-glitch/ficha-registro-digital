// Formulario por pasos de los trámites de Titulación y Posgrados.
// El tipo llega en la URL (grado.html?tipo=maestria) y los documentos que se piden
// vienen del servidor (/api/tramites/config/:tipo).
(async () => {
  const tipo = new URLSearchParams(location.search).get('tipo');
  const form = document.getElementById('formTramite');
  const mensaje = document.getElementById('mensaje');
  const btnAtras = document.getElementById('btnAtras');
  const btnSiguiente = document.getElementById('btnSiguiente');
  const btnEnviar = document.getElementById('btnEnviar');
  const listaPasos = document.getElementById('listaPasos');
  const secciones = Array.from(form.querySelectorAll('.paso'));
  const completados = new Set();
  let actual = secciones[0];
  const TAMANO_MAXIMO = 5 * 1024 * 1024;
  let cfg;

  function mostrarMensaje(texto) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje error';
    mensaje.hidden = false;
    mensaje.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  try {
    const r = await fetch(`/api/tramites/config/${encodeURIComponent(tipo || '')}`);
    if (!r.ok) throw new Error();
    cfg = await r.json();
  } catch {
    document.getElementById('tituloTramite').textContent = 'Trámite no disponible';
    form.innerHTML = '<p>Este trámite no está disponible. <a href="index.html">Volver a los trámites</a></p>';
    return;
  }

  document.title = `${cfg.nombre} - Red IBAI Texcoco`;
  document.getElementById('tituloTramite').textContent = cfg.nombre;
  document.getElementById('programa').value = cfg.programaSugerido || '';
  const selPlantel = document.getElementById('plantel');
  cfg.planteles.forEach((p) => selPlantel.add(new Option(p, p)));

  // ---------- Mayúsculas sin acentos ----------
  const aMayus = (s) => s.replace(/[ñÑ]/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\u0001/g, 'Ñ');
  form.querySelectorAll('input[type="text"]').forEach((i) => i.addEventListener('input', () => {
    const a = i.selectionStart, b = i.selectionEnd;
    i.value = aMayus(i.value);
    if (i.id === 'curp' || i.id === 'matricula') i.value = i.value.replace(/\s/g, '');
    try { i.setSelectionRange(a, b); } catch (e) { /* sin selección */ }
  }));

  // ---------- Documentos (desde la configuración) ----------
  const listaDocs = document.getElementById('listaDocumentos');
  const lateral = document.getElementById('listaLateral');
  let grupoActual = null;
  cfg.documentos.forEach((d) => {
    if (d.grupo !== grupoActual) {
      grupoActual = d.grupo;
      const h = document.createElement('p');
      h.className = 'grupo-titulo';
      h.textContent = d.grupo;
      listaDocs.appendChild(h);
    }
    const caja = document.createElement('div');
    caja.className = 'documento';
    caja.innerHTML = `<label for="doc_${d.clave}" class="etiqueta"></label>
      <input type="file" id="doc_${d.clave}" name="${d.clave}" accept="application/pdf,.pdf">
      <span class="estado-archivo">Ningún archivo seleccionado</span>`;
    caja.querySelector('label').textContent = `${d.etiqueta} *`;
    listaDocs.appendChild(caja);
    const li = document.createElement('li');
    li.textContent = d.etiqueta;
    lateral.appendChild(li);
  });
  const hInt = document.createElement('p');
  hInt.className = 'grupo-titulo';
  hInt.textContent = 'Los gestiona Servicios Escolares (no los subes tú)';
  listaDocs.appendChild(hInt);
  cfg.internos.forEach((d) => {
    const caja = document.createElement('div');
    caja.className = 'documento interno';
    caja.innerHTML = '<span class="etiqueta"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span></span></span><span class="ayuda"></span>';
    caja.querySelector('.etiqueta span').textContent = d.etiqueta;
    caja.querySelector('.ayuda').textContent = d.ayuda;
    listaDocs.appendChild(caja);
  });

  // ---------- Errores ----------
  const cajaDe = (c) => c.closest('.campo') || c.closest('.documento');
  function limpiarError(c) {
    const caja = cajaDe(c);
    if (!caja) return;
    caja.removeAttribute('data-invalido');
    caja.classList.remove('con-error');
    c.removeAttribute('aria-invalid');
    const p = caja.querySelector('.error-campo');
    if (p) p.hidden = true;
  }
  function ponerError(c, texto) {
    const caja = cajaDe(c);
    let p = caja.querySelector('.error-campo');
    if (!p) { p = document.createElement('p'); p.className = 'error-campo'; p.id = `err-${c.id}`; caja.appendChild(p); }
    p.textContent = texto;
    p.hidden = false;
    caja.setAttribute('data-invalido', '');
    if (c.type === 'file') caja.classList.add('con-error');
    c.setAttribute('aria-invalid', 'true');
    c.setAttribute('aria-describedby', p.id);
  }
  form.addEventListener('input', (e) => { if (e.target.matches('input, select')) limpiarError(e.target); });

  // Revisa que sea un PDF real (empieza con %PDF) y no una imagen renombrada
  async function errorDeArchivo(input) {
    const a = input.files[0];
    if (!a) return 'Este documento es obligatorio.';
    if (!/\.pdf$/i.test(a.name)) return 'Solo se aceptan archivos PDF escaneados. Las fotografías (JPG, PNG, HEIC) no se aceptan.';
    if (a.size > TAMANO_MAXIMO) return 'El archivo supera los 5 MB permitidos.';
    const cabecera = await a.slice(0, 5).text().catch(() => '');
    if (!cabecera.startsWith('%PDF')) return 'El archivo no es un PDF válido. Escanéalo y guárdalo como PDF.';
    return null;
  }

  listaDocs.querySelectorAll('input[type="file"]').forEach((input) => {
    const caja = input.closest('.documento');
    const estado = caja.querySelector('.estado-archivo');
    input.addEventListener('change', async () => {
      limpiarError(input);
      caja.classList.remove('con-archivo');
      if (!input.files.length) { estado.textContent = 'Ningún archivo seleccionado'; return; }
      const err = await errorDeArchivo(input);
      if (err) { ponerError(input, err); estado.textContent = 'Archivo no válido'; input.value = ''; return; }
      caja.classList.add('con-archivo');
      const kb = input.files[0].size;
      estado.textContent = `${input.files[0].name} · ${kb < 1048576 ? Math.max(1, Math.round(kb / 1024)) + ' KB' : (kb / 1048576).toFixed(1) + ' MB'}`;
    });
  });

  // ---------- Validación ----------
  const CURP_FORMATO = /^[A-Z]{4}\d{6}[HMX][A-Z]{2}[A-Z]{3}[A-Z0-9]\d$/;
  async function validarPaso(seccion) {
    let primero = null;
    const marcar = (c, t) => { ponerError(c, t); if (!primero) primero = c; };
    for (const c of seccion.querySelectorAll('input, select')) {
      if (c.type === 'checkbox') continue;
      limpiarError(c);
      if (c.type === 'file') {
        const err = await errorDeArchivo(c);
        if (err) marcar(c, err);
        continue;
      }
      const v = c.value.trim();
      if (c.required && !v) { marcar(c, c.tagName === 'SELECT' ? 'Selecciona una opción.' : 'Este campo es obligatorio.'); continue; }
      if (c.id === 'curp' && v && !CURP_FORMATO.test(v)) { marcar(c, 'La CURP no tiene un formato válido. Revísala contra tu documento.'); continue; }
      if (c.type === 'email' && v && c.validity.typeMismatch) marcar(c, 'Escribe un correo válido, por ejemplo nombre@dominio.com.');
    }
    if (primero) primero.focus();
    return !primero;
  }

  // ---------- Navegación ----------
  function render() {
    const idx = secciones.indexOf(actual);
    listaPasos.textContent = '';
    secciones.forEach((s, i) => {
      const li = document.createElement('li');
      const hecho = completados.has(s.dataset.paso) && s !== actual;
      li.className = s === actual ? 'actual' : hecho ? 'hecho' : '';
      const b = document.createElement('button');
      b.type = 'button';
      b.disabled = !hecho;
      if (s === actual) b.setAttribute('aria-current', 'step');
      b.innerHTML = `<span class="paso-num">${hecho ? '✓' : i + 1}</span><span></span>`;
      b.lastChild.textContent = s.dataset.titulo;
      b.addEventListener('click', () => mostrar(s));
      li.appendChild(b);
      listaPasos.appendChild(li);
    });
    document.getElementById('eyebrow').textContent = `Paso ${idx + 1} de ${secciones.length}`;
    document.getElementById('tituloPaso').textContent = actual.dataset.titulo;
    document.getElementById('descripcionPaso').textContent = actual.dataset.descripcion;
    const pct = Math.round(((idx + 1) / secciones.length) * 100);
    document.getElementById('avanceConteo').textContent = `${idx + 1} de ${secciones.length}`;
    document.getElementById('avanceBarra').style.width = `${pct}%`;
    document.getElementById('movilConteo').textContent = `Paso ${idx + 1} de ${secciones.length}`;
    document.getElementById('movilBarra').style.width = `${pct}%`;
    document.getElementById('movilTitulo').textContent = actual.dataset.titulo;
    btnAtras.style.visibility = idx === 0 ? 'hidden' : 'visible';
    btnSiguiente.hidden = idx === secciones.length - 1;
    btnEnviar.hidden = idx !== secciones.length - 1;
  }

  function mostrar(s) {
    actual = s;
    secciones.forEach((x) => { x.hidden = x !== s; });
    mensaje.hidden = true;
    if (s.dataset.paso === 'revision') construirResumen();
    render();
    document.getElementById('tituloPaso').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function siguiente() {
    if (!(await validarPaso(actual))) return;
    completados.add(actual.dataset.paso);
    mostrar(secciones[secciones.indexOf(actual) + 1]);
  }
  btnSiguiente.addEventListener('click', siguiente);
  btnAtras.addEventListener('click', () => mostrar(secciones[Math.max(0, secciones.indexOf(actual) - 1)]));

  function construirResumen() {
    const cont = document.getElementById('resumen');
    cont.textContent = '';
    secciones.forEach((s) => {
      if (s.dataset.paso === 'revision') return;
      const filas = [];
      s.querySelectorAll('input, select').forEach((c) => {
        if (c.type === 'file') { if (c.files.length) filas.push([c.labels[0].textContent.replace(' *', ''), c.files[0].name]); return; }
        const v = c.tagName === 'SELECT' ? (c.value ? c.selectedOptions[0].text : '') : c.value.trim();
        if (v) filas.push([c.labels[0].textContent.replace(/\s*\*$/, ''), v]);
      });
      const bloque = document.createElement('div');
      bloque.className = 'resumen-bloque';
      bloque.innerHTML = '<header><h3></h3><button type="button" class="btn-enlace">Editar</button></header><dl></dl>';
      bloque.querySelector('h3').textContent = s.dataset.titulo;
      bloque.querySelector('button').addEventListener('click', () => mostrar(s));
      const dl = bloque.querySelector('dl');
      filas.forEach(([k, v]) => {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        dl.append(dt, dd);
      });
      cont.appendChild(bloque);
    });
  }

  // ---------- Envío ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (actual !== secciones[secciones.length - 1]) return siguiente();
    for (const s of secciones.slice(0, -1)) {
      if (!(await validarPaso(s))) { mostrar(s); await validarPaso(s); return; }
    }
    const acepto = document.getElementById('acepto');
    document.getElementById('errorAcepto').hidden = acepto.checked;
    if (!acepto.checked) { acepto.focus(); return; }

    const datos = new FormData(form);
    datos.set('tipo', tipo);
    datos.set('acepto', 'true');
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando documentos...';
    try {
      const r = await fetch('/api/tramites', { method: 'POST', body: datos });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) { mostrarMensaje(res.error || 'No se pudo enviar el trámite. Intenta de nuevo.'); return; }
      document.getElementById('zonaFormulario').style.display = 'none';
      document.getElementById('exito').hidden = false;
      document.getElementById('folioExito').textContent = res.folio;
      document.getElementById('enlaceSeguimiento').href =
        `seguimiento.html?folio=${encodeURIComponent(res.folio)}`;
      document.getElementById('tituloExito').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      mostrarMensaje('No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar trámite';
    }
  });

  mostrar(secciones[0]);
  window.scrollTo(0, 0);
})();
