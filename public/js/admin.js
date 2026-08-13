(() => {
  const tbody = document.getElementById('tbody');
  const qInput = document.getElementById('qInput');
  const desdeInput = document.getElementById('desdeInput');
  const hastaInput = document.getElementById('hastaInput');
  const revisadoInput = document.getElementById('revisadoInput');
  const programaInput = document.getElementById('programaInput');
  const plantelInput = document.getElementById('plantelInput');
  const btnBuscar = document.getElementById('btnBuscar');
  const btnDescargar = document.getElementById('btnDescargar');

  function construirParams() {
    const params = new URLSearchParams();
    if (qInput.value) params.set('q', qInput.value);
    if (desdeInput.value) params.set('desde', desdeInput.value);
    if (hastaInput.value) params.set('hasta', hastaInput.value);
    if (revisadoInput.value) params.set('revisado', revisadoInput.value);
    if (programaInput.value) params.set('programa', programaInput.value);
    if (plantelInput.value) params.set('plantel', plantelInput.value);
    return params;
  }

  async function cargar() {
    const params = construirParams();

    const resp = await fetch(`/api/fichas?${params.toString()}`);
    if (!resp.ok) {
      tbody.innerHTML = '<tr><td colspan="9">Error al cargar el listado.</td></tr>';
      return;
    }
    const fichas = await resp.json();
    render(fichas);
  }

  function render(fichas) {
    if (!fichas.length) {
      tbody.innerHTML = '<tr><td colspan="9">Sin resultados.</td></tr>';
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
        <td><span class="badge ${f.revisado ? 'si' : 'no'}">${f.revisado ? 'Revisado' : 'Pendiente'}</span></td>
        <td>${f.revisado ? '' : `<button class="btn-mini" data-id="${f.id}">Marcar revisado</button>`}</td>
      </tr>
    `).join('');
  }

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.dataset.id;
    const revisado_por = prompt('¿Quién revisó este registro?') || '';
    btn.disabled = true;
    await fetch(`/api/fichas/${id}/revisar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisado_por }),
    });
    cargar();
  });

  btnBuscar.addEventListener('click', cargar);
  btnDescargar.addEventListener('click', () => {
    const params = construirParams();
    window.location.href = `/api/fichas/exportar/csv?${params.toString()}`;
  });
  cargar();
})();
