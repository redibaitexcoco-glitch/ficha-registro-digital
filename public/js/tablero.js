// Tablero de Matriculación (mismo diseño que Servicios Escolares).
// Para agregar una sección nueva: crear su <div id="seccion-…" class="tb-seccion tb-oculto">
// en admin/index.html (con <div class="tb-nav" data-nav></div> y su contenido) y añadir
// un recuadro a RECUADROS con el id de esa sección.
(function () {
  // Íconos Tabler (licencia MIT, (c) Paweł Kuna), incluidos para no depender de servicios externos.
  const ICONOS = { 'clipboard-list': "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" > <path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\"/> <path d=\"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2\" /> <path d=\"M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z\" /> <path d=\"M9 12l.01 0\" /> <path d=\"M13 12l2 0\" /> <path d=\"M9 16l.01 0\" /> <path d=\"M13 16l2 0\" /> </svg>" };

  const RECUADROS = [
    {
      seccion: 'seccion-fichas',
      titulo: 'Fichas de Registro recibidas',
      desc: 'Revisar fichas y documentos, situación del aspirante y asignar matrícula',
      icono: 'clipboard-list',
      color: 1,
      indicador: async () => {
        const r = await fetch('/api/fichas?revisado=false');
        if (!r.ok) return null;
        const n = (await r.json()).length;
        return n ? [`${n >= 500 ? '500+' : n} pendiente${n === 1 ? '' : 's'} de revisar`, 'tb-ambar'] : null;
      },
    },
  ];

  const vistaTablero = document.getElementById('vistaTablero');
  const rejilla = document.getElementById('tableroRecuadros');

  function pintarTablero() {
    rejilla.innerHTML = RECUADROS.map((r, i) => `
      <button type="button" class="tb-card tb-c${r.color}" data-i="${i}">
        <span class="tb-barra"></span>
        <span class="tb-icono">${ICONOS[r.icono] || ''}</span>
        <b>${r.titulo}</b><span class="tb-desc">${r.desc}</span>
        <span class="tb-indicador tb-oculto" data-indicador="${i}"></span>
      </button>`).join('');
    rejilla.querySelectorAll('.tb-card').forEach(b => b.addEventListener('click', () => abrir(Number(b.dataset.i))));
  }

  async function actualizarIndicadores() {
    RECUADROS.forEach(async (r, i) => {
      if (!r.indicador) return;
      const el = rejilla.querySelector(`[data-indicador="${i}"]`);
      try {
        const res = await r.indicador();
        if (!res) return el.classList.add('tb-oculto');
        el.textContent = res[0];
        el.className = `tb-indicador ${res[1]}`;
      } catch { el.classList.add('tb-oculto'); }
    });
  }

  function mostrarTablero() {
    RECUADROS.forEach(r => document.getElementById(r.seccion).classList.add('tb-oculto'));
    vistaTablero.classList.remove('tb-oculto');
    actualizarIndicadores();
  }

  function abrir(i) {
    vistaTablero.classList.add('tb-oculto');
    RECUADROS.forEach((r, j) => {
      const sec = document.getElementById(r.seccion);
      sec.classList.toggle('tb-oculto', j !== i);
      if (j !== i) return;
      const nav = sec.querySelector('[data-nav]');
      nav.innerHTML = `<button type="button" class="volver">← Matriculación</button>` +
        RECUADROS.map((x, k) => `<button type="button" data-k="${k}" class="${k === i ? 'activo' : ''}">${x.titulo}</button>`).join('');
      nav.querySelector('.volver').addEventListener('click', mostrarTablero);
      nav.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => abrir(Number(b.dataset.k))));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  pintarTablero();
  mostrarTablero();
  window.tableroMatriculacion = { mostrarTablero, actualizarIndicadores };
})();
