(() => {
  const tbody = document.getElementById('tbody');
  const qInput = document.getElementById('qInput');
  const desdeInput = document.getElementById('desdeInput');
  const hastaInput = document.getElementById('hastaInput');
  const revisadoInput = document.getElementById('revisadoInput');
  const programaInput = document.getElementById('programaInput');
  const plantelInput = document.getElementById('plantelInput');
  const situacionInput = document.getElementById('situacionInput');
  const btnBuscar = document.getElementById('btnBuscar');
  const btnDescargar = document.getElementById('btnDescargar');

  const modal = document.getElementById('modalEditar');
  const formEditar = document.getElementById('formEditar');
  const btnCerrarModal = document.getElementById('btnCerrarModal');
  const btnCancelarEditar = document.getElementById('btnCancelarEditar');
  const mensajeEditar = document.getElementById('mensajeEditar');

  // ---------- Asignar matrícula con vista previa ----------
  // Muestra la matrícula que se asignaría (se recalcula al cambiar año o periodo) y solo
  // crea al estudiante en Servicios Escolares al pulsar "Confirmar y asignar".
  (function estilosVistaPrevia() {
    const st = document.createElement('style');
    st.textContent = `
      .vp-caja { max-width: 560px; }
      .vp-datos { display: grid; grid-template-columns: 110px 1fr; gap: 6px 12px; margin: 4px 0 14px; font-size: 0.92rem; }
      .vp-datos span:nth-child(odd) { font-weight: 700; color: #26333f; }
      .vp-datos span:nth-child(even) { color: #0b1520; word-break: break-word; }
      .vp-selectores { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
      .vp-selectores label { display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 0.85rem; color: #142a46; flex: 1; min-width: 150px; }
      .vp-selectores select { padding: 8px 10px; border-radius: 8px; border: 1px solid #b9c3cc; font: inherit; }
      .vp-resultado { border: 2px solid #1F3A5F; border-radius: 12px; padding: 14px; text-align: center; margin-bottom: 12px; }
      .vp-resultado small { display: block; font-size: 0.75rem; font-weight: 700; color: #4a5560; letter-spacing: 0.04em; text-transform: uppercase; }
      .vp-resultado b { display: block; font-family: ui-monospace, Menlo, monospace; font-size: 1.6rem; color: #142a46; margin-top: 4px; }
      .vp-resultado.bloqueado { border-color: #a0242f; background: #fff8f8; }
      .vp-resultado.bloqueado b { font-family: inherit; font-size: 0.95rem; color: #a0242f; }
      .vp-aviso { margin: 0 0 10px; padding: 10px 12px; border-radius: 8px; background: #fdf0dc; color: #7a4a06; font-size: 0.88rem; font-weight: 600; }
      .vp-nota { margin: 0 0 12px; font-size: 0.82rem; color: #4a5560; }
      .vp-error { color: #a0242f; font-weight: 600; font-size: 0.9rem; min-height: 1em; margin: 0 0 8px; }
      #vpConfirmar { background: #1F3A5F; color: #fff; border: none; border-radius: 10px; padding: 10px 20px; font: inherit; font-weight: 700; cursor: pointer; }
      #vpConfirmar:hover:not(:disabled) { background: #142a46; }
      #vpConfirmar:disabled { opacity: 0.55; cursor: not-allowed; }
      #vpConfirmar:focus-visible, .vp-selectores select:focus-visible { outline: 3px solid #b8893f; outline-offset: 2px; }`;
    document.head.appendChild(st);
  })();

  function textoSeguro(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function abrirVistaPreviaMatricula(id) {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const periodoActual = String(Math.floor(hoy.getMonth() / 4) + 1);
    const fondo = document.createElement('div');
    fondo.className = 'modal-overlay';
    fondo.innerHTML = `
      <div class="modal-caja vp-caja" role="dialog" aria-modal="true" aria-labelledby="vpTitulo">
        <div class="modal-header">
          <h2 id="vpTitulo">Asignar matrícula</h2>
          <button type="button" class="btn-cerrar-modal" data-cerrar aria-label="Cerrar">&times;</button>
        </div>
        <div class="vp-datos" id="vpDatos"><span>Ficha</span><span>Cargando…</span></div>
        <div class="vp-selectores">
          <label>Año de ingreso
            <select id="vpAnio">${[anioActual - 1, anioActual, anioActual + 1].map(a => `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`).join('')}</select>
          </label>
          <label>Periodo de ingreso
            <select id="vpPeriodo">
              <option value="1" ${periodoActual === '1' ? 'selected' : ''}>1 · enero – abril</option>
              <option value="2" ${periodoActual === '2' ? 'selected' : ''}>2 · mayo – agosto</option>
              <option value="3" ${periodoActual === '3' ? 'selected' : ''}>3 · septiembre – diciembre</option>
            </select>
          </label>
        </div>
        <div class="vp-resultado" id="vpResultado"><small>Matrícula que se asignará</small><b>Calculando…</b></div>
        <div id="vpAvisos"></div>
        <p class="vp-nota">Al confirmar, se crea al estudiante en Servicios Escolares con contraseña inicial igual a su CURP. Si otra persona asigna una matrícula del mismo programa y periodo en este momento, el consecutivo puede avanzar uno; el mensaje final mostrará la matrícula real.</p>
        <p class="vp-error" id="vpError" role="alert"></p>
        <div class="modal-acciones">
          <button type="button" class="btn-secundario" data-cerrar>Cancelar</button>
          <button type="button" id="vpConfirmar" disabled>Confirmar y asignar</button>
        </div>
      </div>`;
    document.body.appendChild(fondo);
    const $ = (sel) => fondo.querySelector(sel);
    const selAnio = $('#vpAnio');
    const selPeriodo = $('#vpPeriodo');
    const btnConfirmar = $('#vpConfirmar');
    let consulta = 0;
    let enviando = false;
    let existente = null; // matrícula ya registrada en SE para esta CURP

    const cerrar = () => { if (enviando) return; fondo.remove(); document.removeEventListener('keydown', teclas); };
    const teclas = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', teclas);
    fondo.addEventListener('click', (e) => { if (e.target === fondo || e.target.closest('[data-cerrar]')) cerrar(); });

    async function actualizar() {
      const n = ++consulta;
      btnConfirmar.disabled = true;
      existente = null;
      btnConfirmar.textContent = 'Confirmar y asignar';
      $('#vpError').textContent = '';
      $('#vpResultado').className = 'vp-resultado';
      $('#vpResultado').innerHTML = '<small>Matrícula que se asignará</small><b>Calculando…</b>';
      try {
        const r = await fetch(`/api/matricular/${id}/vista-previa?anio=${selAnio.value}&periodo=${selPeriodo.value}`);
        const d = await r.json().catch(() => ({}));
        if (n !== consulta) return; // llegó una respuesta vieja
        if (!r.ok) throw new Error(d.error || 'No se pudo calcular la matrícula');
        $('#vpDatos').innerHTML = `
          <span>Estudiante</span><span>${textoSeguro(d.nombre)}</span>
          <span>CURP</span><span>${textoSeguro(d.curp || '—')}</span>
          <span>Programa</span><span>${textoSeguro(d.programa || '—')}</span>
          <span>Plantel</span><span>${textoSeguro(d.plantel || '—')}</span>`;
        $('#vpAvisos').innerHTML = d.pago_externo
          ? `<p class="vp-aviso">${textoSeguro(d.plantel_pago_externo || d.plantel)} cobra a sus propios estudiantes: quedará marcado con pago externo y no se le generarán adeudos en Texcoco.</p>` : '';
        if (d.bloqueo) {
          $('#vpResultado').className = 'vp-resultado bloqueado';
          if (d.existente) {
            existente = d.existente;
            $('#vpResultado').innerHTML = `<small>Matrícula ya registrada en Servicios Escolares</small><b>${textoSeguro(d.existente.matricula)}</b><span class="vp-sub">${textoSeguro(d.existente.nombre)} · se dio de alta manualmente</span>`;
            btnConfirmar.textContent = 'Vincular esta matrícula';
            btnConfirmar.disabled = false;
            return;
          }
          $('#vpResultado').innerHTML = `<small>No se puede asignar</small><b>${textoSeguro(d.bloqueo)}</b>`;
          return;
        }
        $('#vpResultado').innerHTML = `<small>Matrícula que se asignará</small><b>${textoSeguro(d.matricula)}</b>`;
        btnConfirmar.disabled = false;
      } catch (err) {
        if (n !== consulta) return;
        $('#vpResultado').innerHTML = '<small>Matrícula que se asignará</small><b>—</b>';
        $('#vpError').textContent = err.message;
      }
    }

    selAnio.addEventListener('change', actualizar);
    selPeriodo.addEventListener('change', actualizar);

    btnConfirmar.addEventListener('click', async () => {
      if (existente) {
        enviando = true;
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Vinculando…';
        try {
          const resp = await fetch(`/api/matricular/${id}/vincular`, { method: 'POST' });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(data.error || 'No se pudo vincular la matrícula');
          enviando = false;
          cerrar();
          cargar();
        } catch (err) {
          enviando = false;
          $('#vpError').textContent = err.message;
          btnConfirmar.textContent = 'Vincular esta matrícula';
          btnConfirmar.disabled = false;
        }
        return;
      }
      enviando = true;
      btnConfirmar.disabled = true;
      btnConfirmar.textContent = 'Asignando…';
      $('#vpError').textContent = '';
      try {
        const resp = await fetch(`/api/matricular/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anio: selAnio.value, periodo: selPeriodo.value }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.error || 'No se pudo matricular');
        enviando = false;
        cerrar();
        alert(`Estudiante matriculado.\\nMatrícula asignada: ${data.matricula}`);
        cargar();
      } catch (err) {
        enviando = false;
        $('#vpError').textContent = err.message;
        btnConfirmar.textContent = 'Confirmar y asignar';
        btnConfirmar.disabled = false;
      }
    });

    actualizar();
    selPeriodo.focus();
  }

  async function vincularExistentes(e) {
    const b = e.currentTarget;
    if (!confirm('Se buscará por CURP en Servicios Escolares a cada ficha sin matrícula. Si el estudiante ya existe, su matrícula se anotará en la ficha (no se crea ni se modifica ningún estudiante). ¿Continuar?')) return;
    b.disabled = true;
    b.textContent = 'Vinculando…';
    try {
      const r = await fetch('/api/matricular/vincular-existentes', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudieron vincular las matrículas');
      const lista = d.vinculadas.map((v) => `• ${v.nombre}: ${v.matricula}`).join('\n');
      alert(d.vinculadas.length
        ? `Se vincularon ${d.vinculadas.length} matrícula(s):\n${lista}\n\nSin registro en Servicios Escolares: ${d.sin_registro}`
        : `No se encontró ninguna ficha con matrícula ya registrada.\nSin registro en Servicios Escolares: ${d.sin_registro}`);
      cargar();
    } catch (err) {
      alert(err.message);
      b.disabled = false;
      b.textContent = 'Vincular matrículas ya registradas';
    }
  }

  function construirParams() {
    const params = new URLSearchParams();
    if (qInput.value) params.set('q', qInput.value);
    if (desdeInput.value) params.set('desde', desdeInput.value);
    if (hastaInput.value) params.set('hasta', hastaInput.value);
    if (revisadoInput.value) params.set('revisado', revisadoInput.value);
    if (programaInput.value) params.set('programa', programaInput.value);
    if (plantelInput.value) params.set('plantel', plantelInput.value);
    if (situacionInput.value) params.set('situacion', situacionInput.value);
    return params;
  }

  const DOCUMENTOS_CHECKLIST = [
    { campo: 'doc_acta_nacimiento_id', etiqueta: 'Acta' },
    { campo: 'doc_curp_id', etiqueta: 'CURP' },
    { campo: 'doc_ine_id', etiqueta: 'INE' },
    { campo: 'doc_certificado_id', etiqueta: 'Certificado' },
    { campo: 'doc_titulo_id', etiqueta: 'Título' },
    { campo: 'doc_cedula_id', etiqueta: 'Cédula' },
    { campo: 'doc_fotografia_id', etiqueta: 'Foto' },
  ];

  function celdaDocumentos(f) {
    const items = DOCUMENTOS_CHECKLIST.map(({ campo, etiqueta }) => {
      const cargado = Boolean(f[campo]);
      return `<span class="doc-chip ${cargado ? 'doc-ok' : 'doc-pendiente'}" title="${etiqueta}: ${cargado ? 'cargado' : 'pendiente'}">${etiqueta}</span>`;
    }).join('');
    const enlaceCarpeta = f.drive_folder_id
      ? `<a href="https://drive.google.com/drive/folders/${f.drive_folder_id}" target="_blank" rel="noopener" class="doc-carpeta">Ver carpeta</a>`
      : '';
    return `<div class="celda-documentos">${items}${enlaceCarpeta}</div>`;
  }

  async function cargar() {
    const params = construirParams();

    const resp = await fetch(`/api/fichas?${params.toString()}`);
    if (!resp.ok) {
      tbody.innerHTML = '<tr><td colspan="12">Error al cargar el listado.</td></tr>';
      return;
    }
    const fichas = await resp.json();
    render(fichas);
  }

  function render(fichas) {
    const contador = document.getElementById('fichasContador');
    if (contador) {
      const pendientes = fichas.filter(f => !f.revisado).length;
      const sinMatricula = fichas.filter(f => !f.matricula_asignada).length;
      contador.textContent = `${fichas.length} ficha${fichas.length === 1 ? '' : 's'} · ${pendientes} pendiente${pendientes === 1 ? '' : 's'} de revisar · ${sinMatricula} sin matrícula`;
      if (sinMatricula) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-mini btn-vincular';
        b.textContent = 'Vincular matrículas ya registradas';
        b.title = 'Busca por CURP en Servicios Escolares a quienes ya tienen matrícula asignada a mano y la anota en su ficha';
        b.addEventListener('click', vincularExistentes);
        contador.append(' ', b);
      }
    }
    if (!fichas.length) {
      tbody.innerHTML = '<tr><td colspan="12"><p class="fichas-vacio">Sin resultados con esos filtros.</p></td></tr>';
      return;
    }
    const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const opcionesSituacion = ['Inscrito', 'Baja', 'Baja temporal', 'Concluido [Programa Académico]', 'En Proceso [Título o Grado]', 'Entregado [Título o Grado]'];
    tbody.innerHTML = fichas.map((f) => {
      const nombre = [f.primer_apellido, f.segundo_apellido, f.nombres].filter(Boolean).join(' ');
      const ini = ((f.nombres || '').charAt(0) + (f.primer_apellido || '').charAt(0)).toUpperCase();
      const cargados = DOCUMENTOS_CHECKLIST.filter(({ campo }) => Boolean(f[campo])).length;
      const programa = String(f.programa_educativo || '-').replace(' (No escolarizado)', '');
      return `<tr class="ficha-tr"><td colspan="12">
        <div class="ficha-card ${f.revisado ? '' : 'por-revisar'}">
          <div class="ficha-l1">
            <span class="ficha-avatar">${esc(ini)}</span>
            <span class="ficha-nombre"><b>${esc(nombre)}</b>
              <small>${esc(f.curp || 'Sin CURP')} · ${esc(f.plantel || '-')} · ${esc(programa)}</small>
              <small>Recibida el ${new Date(f.created_at).toLocaleDateString('es-MX')} · capturada por ${f.capturado_por === 'personal' ? 'personal' : 'el estudiante'}</small></span>
            <span class="ficha-matricula">
              ${f.matricula_asignada
                ? `<small>MATRÍCULA</small><b>${esc(f.matricula_asignada)}</b>`
                : `<button class="btn-mini btn-principal" data-id="${f.id}" data-action="matricular">Asignar matrícula</button>`}
            </span>
          </div>
          <div class="ficha-l2">
            <span class="ficha-estado">
              ${f.revisado ? '<span class="ficha-chip verde">Revisada</span>' : `<button class="btn-mini btn-revisar" data-id="${f.id}" data-action="revisar">Marcar revisada</button>`}
              <select class="select-situacion" data-id="${f.id}" aria-label="Situación">
                ${opcionesSituacion.map(o => `<option value="${esc(o)}" ${f.situacion === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
              </select>
            </span>
            <span class="ficha-docs"><span class="ficha-docs-cuenta ${cargados === DOCUMENTOS_CHECKLIST.length ? 'completo' : ''}">${cargados}/${DOCUMENTOS_CHECKLIST.length} documentos</span>${celdaDocumentos(f)}</span>
            <details class="ficha-menu">
              <summary aria-label="Más acciones">⋯</summary>
              <div>
                <button class="btn-mini" data-id="${f.id}" data-action="editar">Editar ficha</button>
                ${f.matricula_asignada ? `<button class="btn-mini peligro" data-id="${f.id}" data-action="deshacer-matricula">Deshacer matrícula…</button>` : ''}
                <button class="btn-mini peligro" data-id="${f.id}" data-action="eliminar">Eliminar ficha…</button>
              </div>
            </details>
          </div>
        </div>
      </td></tr>`;
    }).join('');
  }


  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.action === 'editar') {
      abrirModalEditar(id);
      return;
    }

    if (btn.dataset.action === 'deshacer-matricula') {
      const confirmar = confirm('¿Deshacer esta matriculación? Se eliminará el estudiante creado en Servicios Escolares y la ficha regresará a pendiente. Esta acción no se puede deshacer.');
      if (!confirmar) return;
      btn.disabled = true;
      btn.textContent = 'Deshaciendo...';
      try {
        const resp = await fetch(`/api/matricular/${id}`, { method: 'DELETE' });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'No se pudo deshacer la matriculación');
        cargar();
      } catch (err) {
        alert('Error: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Deshacer';
      }
      return;
    }

    if (btn.dataset.action === 'matricular') {
      abrirVistaPreviaMatricula(id);
      return;
    }

    if (btn.dataset.action === 'eliminar') {
      const confirmar = confirm('¿Eliminar este registro de forma permanente? Esta acción no se puede deshacer.');
      if (!confirmar) return;
      btn.disabled = true;
      const resp = await fetch(`/api/fichas/${id}`, { method: 'DELETE' });
      if (!resp.ok) {
        alert('No se pudo eliminar el registro.');
        btn.disabled = false;
        return;
      }
      cargar();
      return;
    }

    const revisado_por = prompt('¿Quién revisó este registro?') || '';
    btn.disabled = true;
    await fetch(`/api/fichas/${id}/revisar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisado_por }),
    });
    cargar();
  });

  tbody.addEventListener('change', async (e) => {
    const select = e.target.closest('.select-situacion');
    if (!select) return;
    const id = select.dataset.id;
    select.disabled = true;
    await fetch(`/api/fichas/${id}/situacion`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situacion: select.value }),
    });
    select.disabled = false;
  });

  async function abrirModalEditar(id) {
    mensajeEditar.hidden = true;
    const resp = await fetch(`/api/fichas/${id}`);
    if (!resp.ok) {
      alert('No se pudo cargar el registro.');
      return;
    }
    const f = await resp.json();

    document.getElementById('editId').value = f.id;
    document.getElementById('editPlantel').value = f.plantel || '';
    document.getElementById('editPrograma').value = f.programa_educativo || '';
    document.getElementById('editPrimerApellido').value = f.primer_apellido || '';
    document.getElementById('editSegundoApellido').value = f.segundo_apellido || '';
    document.getElementById('editNombres').value = f.nombres || '';
    document.getElementById('editCurp').value = f.curp || '';
    document.getElementById('editFechaNacimiento').value = f.fecha_nacimiento ? f.fecha_nacimiento.slice(0, 10) : '';
    document.getElementById('editPromedio').value = f.promedio_ultimo_grado ?? '';
    document.getElementById('editInstitucion').value = f.institucion_procedencia || '';
    document.getElementById('editCorreo').value = f.correo_electronico || '';
    document.getElementById('editCalle').value = f.calle || '';
    document.getElementById('editNoExt').value = f.no_ext || '';
    document.getElementById('editNoInt').value = f.no_int || '';
    document.getElementById('editColonia').value = f.colonia || '';
    document.getElementById('editCp').value = f.cp || '';
    document.getElementById('editLocalidad').value = f.localidad || '';
    document.getElementById('editMunicipio').value = f.municipio || '';
    document.getElementById('editEntidad').value = f.entidad_federativa || '';
    document.getElementById('editTelCasa').value = f.tel_casa || '';
    document.getElementById('editTelCelular').value = f.tel_celular || '';
    document.getElementById('editTutorPrimerApellido').value = f.tutor_primer_apellido || '';
    document.getElementById('editTutorSegundoApellido').value = f.tutor_segundo_apellido || '';
    document.getElementById('editTutorNombres').value = f.tutor_nombres || '';
    document.getElementById('editTutorOcupacion').value = f.tutor_ocupacion || '';
    document.getElementById('editTutorTelefono').value = f.tutor_telefono || '';

    modal.hidden = false;
  }

  function cerrarModal() {
    modal.hidden = true;
  }
  btnCerrarModal.addEventListener('click', cerrarModal);
  btnCancelarEditar.addEventListener('click', cerrarModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
  });

  // Mismo criterio que el formulario público: mayúsculas sin acentos mientras se escribe.
  function aMayusculasSinAcentos(str) {
    if (!str) return str;
    return str
      .replace(/[ñÑ]/g, '\u0001')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\u0001/g, 'Ñ');
  }
  formEditar.querySelectorAll('input[type="text"], input[type="tel"]').forEach((input) => {
    if (input.id === 'editCurp') return; // el propio input ya limita mayúsculas al guardar
    input.addEventListener('input', () => {
      const inicio = input.selectionStart;
      const fin = input.selectionEnd;
      input.value = aMayusculasSinAcentos(input.value);
      if (inicio !== null && fin !== null) input.setSelectionRange(inicio, fin);
    });
  });

  formEditar.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensajeEditar.hidden = true;

    const id = document.getElementById('editId').value;
    const datos = Object.fromEntries(new FormData(formEditar).entries());

    const btnGuardar = document.getElementById('btnGuardarEditar');
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
      const resp = await fetch(`/api/fichas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const data = await resp.json();

      if (!resp.ok) {
        mensajeEditar.textContent = data.error || 'No se pudo guardar la corrección.';
        mensajeEditar.className = 'mensaje error';
        mensajeEditar.hidden = false;
        return;
      }

      cerrarModal();
      cargar();
    } catch (err) {
      mensajeEditar.textContent = 'No se pudo conectar con el servidor.';
      mensajeEditar.className = 'mensaje error';
      mensajeEditar.hidden = false;
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.textContent = 'Guardar corrección';
    }
  });

  btnBuscar.addEventListener('click', cargar);
  btnDescargar.addEventListener('click', () => {
    const params = construirParams();
    window.location.href = `/api/fichas/exportar/csv?${params.toString()}`;
  });
  cargar();
})();

document.addEventListener('click', (e) => {
  document.querySelectorAll('.ficha-menu[open]').forEach(d => { if (!d.contains(e.target) || e.target.closest('button')) d.removeAttribute('open'); });
});
