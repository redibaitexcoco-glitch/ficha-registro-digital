// Panel: Trámites de Titulación y Posgrados (verificación de documentos)
(function () {
  const API = '/api/fichas/tramites';
  const lista = document.getElementById('trLista');
  const modal = document.getElementById('modalTramite');
  const detalle = document.getElementById('trDetalle');
  let abiertoId = null;

  const ESTADO_TRAMITE = {
    en_revision: ['En revisión', 'tr-azul'], con_observaciones: ['Con observaciones', 'tr-rojo'],
    expediente_completo: ['Expediente completo', 'tr-verde'], concluido: ['Concluido', 'tr-gris'],
  };
  const ESTADO_DOC = {
    en_revision: ['En revisión', 'tr-azul'], verificado: ['Verificado', 'tr-verde'], no_cumple: ['No cumple', 'tr-rojo'],
    pendiente: ['Pendiente', 'tr-gris'], en_proceso: ['En elaboración', 'tr-azul'], listo: ['Listo', 'tr-verde'],
  };

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chip = ([t, c]) => `<span class="tr-chip ${c}">${esc(t)}</span>`;
  const nombre = (t) => `${t.primer_apellido} ${t.segundo_apellido || ''} ${t.nombres}`.replace(/\s+/g, ' ').trim();
  const fecha = (f) => new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  async function api(url, opciones) {
    const r = await fetch(url, opciones);
    if (r.status === 204) return null;
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Ocurrió un error.');
    return d;
  }

  async function cargar() {
    const p = new URLSearchParams();
    const q = document.getElementById('trQ').value.trim();
    if (q) p.set('q', q);
    if (document.getElementById('trTipo').value) p.set('tipo', document.getElementById('trTipo').value);
    if (document.getElementById('trEstado').value) p.set('estado', document.getElementById('trEstado').value);
    lista.innerHTML = '<p class="tr-vacio">Cargando…</p>';
    try {
      const datos = await api(`${API}?${p}`);
      document.getElementById('trContador').textContent = `${datos.length} trámite${datos.length === 1 ? '' : 's'}`;
      if (!datos.length) { lista.innerHTML = '<p class="tr-vacio">No hay trámites con estos filtros.</p>'; return; }
      lista.innerHTML = datos.map((t) => `
        <div class="ficha-card tr-card ${t.por_revisar ? 'por-revisar' : ''}">
          <div class="ficha-l1">
            <div class="ficha-nombre"><b>${esc(nombre(t))}</b><small>${esc(t.nombre_tramite)} · ${esc(t.plantel || '')} · ${esc(fecha(t.created_at))}</small></div>
            <div class="ficha-matricula"><small>FOLIO</small><b>${esc(t.folio)}</b></div>
          </div>
          <div class="tr-l2">
            ${chip(ESTADO_TRAMITE[t.estado] || [t.estado, 'tr-gris'])}
            ${t.por_revisar ? `<span class="tr-chip tr-ambar">${t.por_revisar} por revisar</span>` : ''}
            ${t.no_cumplen ? `<span class="tr-chip tr-rojo">${t.no_cumplen} no cumple${t.no_cumplen === 1 ? '' : 'n'}</span>` : ''}
            ${t.internos_pendientes ? `<span class="tr-chip tr-gris">${t.internos_pendientes} interno${t.internos_pendientes === 1 ? '' : 's'} pendiente${t.internos_pendientes === 1 ? '' : 's'}</span>` : ''}
            <button type="button" class="btn-mini btn-principal tr-abrir" data-id="${t.id}">Revisar</button>
          </div>
        </div>`).join('');
      lista.querySelectorAll('.tr-abrir').forEach((b) => b.addEventListener('click', () => abrir(Number(b.dataset.id))));
    } catch (e) {
      lista.innerHTML = `<p class="tr-vacio">${esc(e.message)}</p>`;
    }
  }

  async function abrir(id) {
    abiertoId = id;
    modal.hidden = false;
    detalle.innerHTML = '<p class="tr-vacio">Cargando…</p>';
    try { pintarDetalle(await api(`${API}/${id}`)); } catch (e) { detalle.innerHTML = `<p class="tr-vacio">${esc(e.message)}</p>`; }
  }

  function pintarDetalle(t) {
    document.getElementById('trTitulo').textContent = `${t.nombre_tramite} · ${t.folio}`;
    const est = t.documentos.filter((d) => !d.interno);
    const int = t.documentos.filter((d) => d.interno);
    detalle.innerHTML = `
      <div class="tr-datos">
        <div><small>Estudiante</small><b>${esc(nombre(t))}</b></div>
        <div><small>CURP</small><b>${esc(t.curp)}</b></div>
        <div><small>Matrícula</small><b>${esc(t.matricula || '—')}</b></div>
        <div><small>Plantel</small><b>${esc(t.plantel || '—')}</b></div>
        <div><small>Programa</small><b>${esc(t.programa || '—')}</b></div>
        <div><small>Egreso</small><b>${esc(t.periodo_egreso || '—')}</b></div>
        <div><small>Modalidad</small><b>${t.modalidad === 'con_tesis' ? 'Con tesis' : 'Sin tesis'}</b></div>
        <div><small>Contacto</small><b>${esc(t.tel_celular || '')} · ${esc(t.correo_electronico || '')}</b></div>
        ${t.titulo_trabajo ? `<div class="tr-ancho"><small>Título del trabajo</small><b>${esc(t.titulo_trabajo)}</b></div>` : ''}
      </div>
      <div class="tr-estado-general">${chip(ESTADO_TRAMITE[t.estado] || [t.estado, 'tr-gris'])}</div>
      <h3>Documentos del estudiante</h3>
      ${est.map((d) => `
        <div class="tr-doc ${d.estado === 'no_cumple' ? 'mal' : ''}" data-doc="${d.id}">
          <div class="tr-doc-l1">
            <span><b>${esc(d.etiqueta)}</b>${d.version > 1 ? ` <small>(versión ${d.version})</small>` : ''}</span>
            ${chip(ESTADO_DOC[d.estado] || [d.estado, 'tr-gris'])}
          </div>
          ${d.motivo ? `<p class="tr-motivo">Motivo: ${esc(d.motivo)}</p>` : ''}
          <div class="tr-doc-acciones">
            ${d.url ? `<a class="btn-mini tr-ver" href="${esc(d.url)}" target="_blank" rel="noopener">Ver PDF</a>` : '<span class="tr-vacio">Sin archivo</span>'}
            ${t.estado === 'concluido' ? '' : `
            <button type="button" class="btn-mini tr-ok" data-accion="verificado">Verificado</button>
            <button type="button" class="btn-mini tr-mal" data-accion="no_cumple">No cumple</button>`}
          </div>
          <div class="tr-motivo-form" hidden>
            <input type="text" placeholder="Motivo que verá el estudiante (ej. es una fotografía, no un escaneo)" aria-label="Motivo">
            <button type="button" class="btn-mini btn-principal" data-accion="guardar-motivo">Guardar</button>
          </div>
        </div>`).join('')}
      <h3>Los gestiona Servicios Escolares</h3>
      ${int.map((d) => `
        <div class="tr-doc interno" data-doc="${d.id}">
          <div class="tr-doc-l1">
            <span><b>${esc(d.etiqueta)}</b></span>
            <select aria-label="Estado de ${esc(d.etiqueta)}" ${t.estado === 'concluido' ? 'disabled' : ''}>
              <option value="pendiente" ${d.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="en_proceso" ${d.estado === 'en_proceso' ? 'selected' : ''}>En elaboración</option>
              <option value="listo" ${d.estado === 'listo' ? 'selected' : ''}>Listo</option>
            </select>
          </div>
        </div>`).join('')}
      <h3>Observaciones internas</h3>
      <textarea id="trObs" rows="2" class="tr-obs" placeholder="Notas para Servicios Escolares (no las ve el estudiante)">${esc(t.observaciones || '')}</textarea>
      <div class="modal-acciones tr-acciones">
        <button type="button" class="btn-mini btn-eliminar" id="trEliminar">Eliminar trámite</button>
        <span style="flex:1"></span>
        <button type="button" class="btn-secundario" id="trGuardarObs">Guardar observaciones</button>
        ${t.estado === 'expediente_completo' ? '<button type="button" id="trConcluir">Marcar como concluido</button>' : ''}
        ${t.estado === 'concluido' ? '<button type="button" class="btn-secundario" id="trReabrir">Reabrir trámite</button>' : ''}
      </div>`;

    detalle.querySelectorAll('.tr-doc[data-doc]').forEach((caja) => {
      const docId = caja.dataset.doc;
      const formMotivo = caja.querySelector('.tr-motivo-form');
      caja.querySelectorAll('[data-accion]').forEach((b) => b.addEventListener('click', async () => {
        const accion = b.dataset.accion;
        if (accion === 'no_cumple') { formMotivo.hidden = false; formMotivo.querySelector('input').focus(); return; }
        const cuerpo = accion === 'guardar-motivo'
          ? { estado: 'no_cumple', motivo: formMotivo.querySelector('input').value }
          : { estado: accion };
        await cambiarDoc(docId, cuerpo);
      }));
      const sel = caja.querySelector('select');
      if (sel) sel.addEventListener('change', () => cambiarDoc(docId, { estado: sel.value }));
    });
    const accion = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', fn); };
    accion('trGuardarObs', () => patchTramite({ observaciones: document.getElementById('trObs').value }, 'Observaciones guardadas.'));
    accion('trConcluir', () => patchTramite({ concluido: true }));
    accion('trReabrir', () => patchTramite({ concluido: false }));
    accion('trEliminar', async () => {
      if (!confirm(`¿Eliminar el trámite ${t.folio}? Se borra el registro y su seguimiento; los PDF permanecen en la carpeta de Drive del estudiante.`)) return;
      try { await api(`${API}/${t.id}`, { method: 'DELETE' }); cerrar(); cargar(); } catch (e) { alert(e.message); }
    });
  }

  async function cambiarDoc(docId, cuerpo) {
    try {
      await api(`${API}/${abiertoId}/documentos/${docId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      pintarDetalle(await api(`${API}/${abiertoId}`));
    } catch (e) { alert(e.message); }
  }

  async function patchTramite(cuerpo, aviso) {
    try {
      await api(`${API}/${abiertoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      if (aviso) alert(aviso);
      pintarDetalle(await api(`${API}/${abiertoId}`));
    } catch (e) { alert(e.message); }
  }

  function cerrar() {
    modal.hidden = true;
    abiertoId = null;
    cargar();
    if (window.tableroMatriculacion) window.tableroMatriculacion.actualizarIndicadores();
  }

  document.getElementById('trCerrar').addEventListener('click', cerrar);
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) cerrar(); });
  document.getElementById('trBuscar').addEventListener('click', cargar);
  document.getElementById('trQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') cargar(); });
  ['trTipo', 'trEstado'].forEach((id) => document.getElementById(id).addEventListener('change', cargar));

  window.tramitesAdmin = { cargar };
})();
