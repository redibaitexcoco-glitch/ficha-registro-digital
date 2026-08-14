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

  async function cargar() {
    const params = construirParams();

    const resp = await fetch(`/api/fichas?${params.toString()}`);
    if (!resp.ok) {
      tbody.innerHTML = '<tr><td colspan="10">Error al cargar el listado.</td></tr>';
      return;
    }
    const fichas = await resp.json();
    render(fichas);
  }

  function render(fichas) {
    if (!fichas.length) {
      tbody.innerHTML = '<tr><td colspan="10">Sin resultados.</td></tr>';
      return;
    }
    tbody.innerHTML = fichas.map((f) => `
      <tr>
        <td>${f.id}</td>
        <td>${new Date(f.created_at).toLocaleDateString('es-MX')}</td>
        <td>${f.plantel || '-'}</td>
        <td>${[f.primer_apellido, f.segundo_apellido, f.nombres].filter(Boolean).join(' ')}</td>
        <td>${f.curp || '-'}</td>
        <td>${f.programa_educativo || '-'}</td>
        <td>${f.capturado_por === 'personal' ? 'Personal' : 'Estudiante'}</td>
        <td>
          <select class="select-situacion" data-id="${f.id}">
            <option value="Inscrito" ${f.situacion === 'Inscrito' ? 'selected' : ''}>Inscrito</option>
            <option value="Baja" ${f.situacion === 'Baja' ? 'selected' : ''}>Baja</option>
            <option value="Baja temporal" ${f.situacion === 'Baja temporal' ? 'selected' : ''}>Baja temporal</option>
          </select>
        </td>
        <td><span class="badge ${f.revisado ? 'si' : 'no'}">${f.revisado ? 'Revisado' : 'Pendiente'}</span></td>
        <td>
          <div class="celda-acciones">
            <button class="btn-mini btn-editar" data-id="${f.id}" data-action="editar">Editar</button>
            ${f.revisado ? '' : `<button class="btn-mini" data-id="${f.id}" data-action="revisar">Marcar revisado</button>`}
            <button class="btn-mini btn-eliminar" data-id="${f.id}" data-action="eliminar">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.action === 'editar') {
      abrirModalEditar(id);
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
