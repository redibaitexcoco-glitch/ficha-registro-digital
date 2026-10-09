// Tablero de Trámites (mismo diseño que Servicios Escolares).
// Para agregar una sección nueva: crear su <div id="seccion-…" class="tb-seccion tb-oculto">
// en admin/index.html (con <div class="tb-nav" data-nav></div> y su contenido) y añadir
// un recuadro a RECUADROS con el id de esa sección.
(function () {
  // Íconos Tabler (licencia MIT, (c) Paweł Kuna), incluidos para no depender de servicios externos.
  const ICONOS = { 'certificado': "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 9l10-5 10 5-10 5z\"/><path d=\"M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5\"/><path d=\"M22 9v5\"/></svg>", 'clipboard-list': "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" > <path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\"/> <path d=\"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2\" /> <path d=\"M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z\" /> <path d=\"M9 12l.01 0\" /> <path d=\"M13 12l2 0\" /> <path d=\"M9 16l.01 0\" /> <path d=\"M13 16l2 0\" /> </svg>" };

  // Un trámite de Titulación y Posgrados: abre la misma sección, ya filtrada por tipo
  const tramite = (tipo, titulo, desc, color) => ({
    seccion: 'seccion-tramites', grupo: 'Departamento de Titulación y Posgrados',
    titulo, desc, icono: 'certificado', color,
    alAbrir: () => {
      document.getElementById('trTituloSeccion').textContent = titulo;
      document.getElementById('trTipo').value = tipo;
      if (window.tramitesAdmin) window.tramitesAdmin.cargar();
    },
    indicador: async () => {
      const r = await fetch(`/api/fichas/tramites?tipo=${tipo}`);
      if (!r.ok) return null;
      const n = (await r.json()).filter((t) => t.por_revisar > 0).length;
      return n ? [`${n} con documentos por revisar`, 'tb-ambar'] : null;
    },
  });

  const RECUADROS = [
    {
      seccion: 'seccion-fichas',
      grupo: 'Departamento de Control Escolar',
      titulo: 'Inscripción',
      desc: 'Revisar fichas y documentos de nuevo ingreso, situación del aspirante y asignar matrícula',
      icono: 'clipboard-list',
      color: 1,
      indicador: async () => {
        const r = await fetch('/api/fichas?revisado=false');
        if (!r.ok) return null;
        const n = (await r.json()).length;
        return n ? [`${n >= 500 ? '500+' : n} pendiente${n === 1 ? '' : 's'} de revisar`, 'tb-ambar'] : null;
      },
    },
    tramite('licenciatura', 'Titulación Licenciatura', 'Verificar documentos del trámite de titulación de licenciatura', 2),
    tramite('maestria', 'Grado Maestría', 'Verificar documentos del trámite de obtención del grado de maestría', 3),
    tramite('doctorado', 'Grado Doctorado', 'Verificar documentos del trámite de obtención del grado de doctorado', 4),
  ];

  const vistaTablero = document.getElementById('vistaTablero');
  const rejilla = document.getElementById('tableroRecuadros');

  function tarjeta(r, i) {
    return `
      <button type="button" class="tb-card tb-c${r.color}" data-i="${i}">
        <span class="tb-barra"></span>
        <span class="tb-icono">${ICONOS[r.icono] || ''}</span>
        <b>${r.titulo}</b><span class="tb-desc">${r.desc}</span>
        <span class="tb-indicador tb-oculto" data-indicador="${i}"></span>
      </button>`;
  }

  // Recuadros agrupados por departamento, en el mismo orden del selector que ve el estudiante
  function pintarTablero() {
    const grupos = [];
    RECUADROS.forEach((r, i) => {
      let g = grupos.find((x) => x.nombre === r.grupo);
      if (!g) grupos.push(g = { nombre: r.grupo, items: [] });
      g.items.push(tarjeta(r, i));
    });
    rejilla.classList.remove('tb-grid');
    rejilla.innerHTML = grupos.map((g) => `
      <section class="tb-grupo">
        <h2 class="tb-grupo-titulo">${g.nombre}</h2>
        <div class="tb-grid">${g.items.join('')}</div>
      </section>`).join('');
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

  const SECCIONES = [...new Set(RECUADROS.map(r => r.seccion))];

  function mostrarTablero() {
    SECCIONES.forEach(id => document.getElementById(id).classList.add('tb-oculto'));
    vistaTablero.classList.remove('tb-oculto');
    actualizarIndicadores();
  }

  function abrir(i) {
    const r = RECUADROS[i];
    vistaTablero.classList.add('tb-oculto');
    SECCIONES.forEach(id => document.getElementById(id).classList.toggle('tb-oculto', id !== r.seccion));
    const sec = document.getElementById(r.seccion);
    if (r.alAbrir) r.alAbrir();
    const nav = sec.querySelector('[data-nav]');
    nav.innerHTML = `<button type="button" class="volver">← Trámites</button>` +
      RECUADROS.map((x, k) => `<button type="button" data-k="${k}" class="${k === i ? 'activo' : ''}">${x.titulo}</button>`).join('');
    nav.querySelector('.volver').addEventListener('click', mostrarTablero);
    nav.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => abrir(Number(b.dataset.k))));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  pintarTablero();
  mostrarTablero();
  window.tableroMatriculacion = { mostrarTablero, actualizarIndicadores };
})();
