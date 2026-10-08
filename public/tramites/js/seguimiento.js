(() => {
  const form = document.getElementById('formConsulta');
  const folio = document.getElementById('folio');
  const curp = document.getElementById('curp');
  const mensaje = document.getElementById('mensaje');
  const resultado = document.getElementById('resultado');

  const ESTADOS = {
    en_revision: ['En revisión', 'revision'], verificado: ['Verificado', 'ok'], no_cumple: ['No cumple', 'mal'],
    pendiente: ['Pendiente', 'gris'], en_proceso: ['En elaboración', 'revision'], listo: ['Listo', 'ok'],
  };
  const GENERAL = {
    en_revision: ['Tus documentos están en revisión. Te avisaremos si alguno necesita corrección.', 'revision'],
    con_observaciones: ['Hay documentos que no cumplen. Revisa el motivo y vuelve a subir solo esos documentos.', 'mal'],
    expediente_completo: ['Tu expediente está completo. Servicios Escolares continuará con tu trámite.', 'ok'],
    concluido: ['Tu trámite está concluido.', 'ok'],
  };

  [folio, curp].forEach((i) => i.addEventListener('input', () => { i.value = i.value.toUpperCase().replace(/\s/g, ''); }));
  const params = new URLSearchParams(location.search);
  if (params.get('folio')) folio.value = params.get('folio').toUpperCase();

  function error(texto) { mensaje.textContent = texto; mensaje.className = 'mensaje error'; mensaje.hidden = !texto; }

  async function consultar() {
    error('');
    if (!folio.value || curp.value.length !== 18) return error('Escribe tu folio y tu CURP completa (18 caracteres).');
    const r = await fetch('/api/tramites/seguimiento', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio: folio.value, curp: curp.value }),
    }).catch(() => null);
    if (!r) return error('No se pudo conectar con el servidor. Intenta de nuevo.');
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { resultado.hidden = true; return error(d.error || 'No se pudo consultar el trámite.'); }
    pintar(d);
  }

  function chip(estado) {
    const [t, c] = ESTADOS[estado] || [estado, 'gris'];
    const s = document.createElement('span');
    s.className = `chip-estado ${c}`;
    s.textContent = t;
    return s;
  }

  function pintar(d) {
    document.getElementById('resTramite').textContent = d.nombre_tramite;
    document.getElementById('resFolio').textContent = `Folio ${d.folio}`;
    document.getElementById('resNombre').textContent = d.nombre;
    const [txt, cls] = GENERAL[d.estado] || ['', 'revision'];
    const est = document.getElementById('resEstado');
    est.textContent = txt;
    est.className = `estado-general ${cls}`;
    const cE = document.getElementById('docsEstudiante');
    const cI = document.getElementById('docsInternos');
    cE.textContent = '';
    cI.textContent = '';
    d.documentos.forEach((doc) => {
      const fila = document.createElement('div');
      fila.className = `seg-doc${doc.interno ? ' interno' : ''}${doc.estado === 'no_cumple' ? ' mal' : ''}`;
      const n = document.createElement('span');
      n.textContent = doc.etiqueta;
      fila.append(n, chip(doc.estado));
      if (doc.estado === 'no_cumple') {
        const m = document.createElement('p');
        m.className = 'motivo';
        m.textContent = `Motivo: ${doc.motivo || 'no especificado'}`;
        const zona = document.createElement('div');
        zona.className = 'reenviar';
        zona.innerHTML = '<input type="file" accept="application/pdf,.pdf"><button type="button" class="btn btn-primario">Subir de nuevo</button><span class="ayuda"></span>';
        const [input, btn, nota] = zona.children;
        input.setAttribute('aria-label', `Nuevo PDF de ${doc.etiqueta}`);
        btn.addEventListener('click', () => reenviar(doc.clave, input, btn, nota));
        fila.append(m, zona);
      }
      (doc.interno ? cI : cE).appendChild(fila);
    });
    resultado.hidden = false;
    document.getElementById('resFolio').focus();
  }

  async function reenviar(clave, input, btn, nota) {
    const a = input.files[0];
    nota.style.color = 'var(--rojo)';
    if (!a) return (nota.textContent = 'Elige el PDF corregido.');
    if (!/\.pdf$/i.test(a.name)) return (nota.textContent = 'Solo se aceptan PDF escaneados, no fotografías.');
    if (a.size > 5 * 1024 * 1024) return (nota.textContent = 'El archivo supera los 5 MB.');
    if (!(await a.slice(0, 5).text()).startsWith('%PDF')) return (nota.textContent = 'El archivo no es un PDF válido.');
    const fd = new FormData();
    fd.append('folio', folio.value);
    fd.append('curp', curp.value);
    fd.append('clave', clave);
    fd.append('archivo', a);
    btn.disabled = true;
    btn.textContent = 'Subiendo...';
    const r = await fetch('/api/tramites/reenviar', { method: 'POST', body: fd }).catch(() => null);
    btn.disabled = false;
    btn.textContent = 'Subir de nuevo';
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) return (nota.textContent = d.error || 'No se pudo subir. Intenta de nuevo.');
    consultar();
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); consultar(); });
})();
