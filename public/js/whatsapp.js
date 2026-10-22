// Mensajes por WhatsApp (envío manual): arma el texto con una plantilla y abre
// WhatsApp Web o la app con el mensaje escrito; la persona revisa y da Enviar.
// Uso: WhatsApp.abrir({ nombre, telefono, curp, matricula, materias: [], pagos: [], faltantes: [], plantilla, valores: {} })
(function () {
  const EXPEDIENTE_URL = 'https://serviciosescolares.redibaiconnect.org/portal/';
  const FICHA_URL = 'https://ficha-registro-digital.onrender.com/';
  const INST = 'Servicios Escolares de la Red IBAI Texcoco';

  const PLANTILLAS = [
    { id: 'saludo', titulo: 'Saludo libre', campos: [],
      texto: (d) => `Hola ${d.nombre}, te saludamos de ${INST}. ` },
    { id: 'documento', titulo: 'Documento pendiente', campos: ['documentos'],
      texto: (d, c) => `Hola ${d.nombre}, te saludamos de ${INST}. Para completar tu expediente necesitamos ${c.documentos || '[documentos]'} en PDF escaneado y legible. ${d.matricula ? `Puedes subirlos en tu Expediente Electrónico: ${EXPEDIENTE_URL}` : 'Puedes enviarlos respondiendo a este mensaje.'}\nGracias.` },
    { id: 'acceso', titulo: 'Datos de acceso', campos: [],
      texto: (d) => `Hola ${d.nombre}, te compartimos tus datos para ingresar a tu Expediente Electrónico de la Red IBAI Texcoco:\n\nEnlace: ${EXPEDIENTE_URL}\nUsuario: tu CURP${d.curp ? ` (${d.curp})` : ''}\nContraseña inicial: tu CURP en mayúsculas${d.matricula ? `\nMatrícula: ${d.matricula}` : ''}\n\nTe recomendamos cambiar tu contraseña al ingresar. Saludos, ${INST}.` },
    { id: 'matricula', titulo: 'Asignación de matrícula', campos: ['enlace'], enlacePorDefecto: FICHA_URL,
      texto: (d, c) => `Hola ${d.nombre}, te saludamos de ${INST}. Para la asignación de tu matrícula es necesario que llenes el formulario de inscripción y subas tus documentos en el siguiente enlace:\n${c.enlace || FICHA_URL}\n\nAl concluir, te informaremos tu matrícula. Gracias.` },
    { id: 'inasistencia', titulo: 'No asistencia a sesión sincrónica', campos: ['materia', 'fecha'],
      texto: (d, c) => `Hola ${d.nombre}, te saludamos de ${INST}. Te informamos que no se registró tu asistencia a la sesión sincrónica de ${c.materia || '[materia]'} del ${c.fecha ? fechaLarga(c.fecha) : '[fecha]'}. Te pedimos comunicarte con tu docente o con Servicios Escolares para cualquier aclaración. Gracias.` },
    { id: 'comprobante', titulo: 'Recepción y registro de comprobante de pago', campos: ['concepto'],
      texto: (d, c) => `Hola ${d.nombre}, te saludamos de ${INST}. Te confirmamos que recibimos y registramos tu comprobante de pago${c.concepto ? ` de ${c.concepto}` : ''}. Puedes consultarlo en tu Expediente Electrónico, sección Pagos: ${EXPEDIENTE_URL}\nGracias.` },
    { id: 'classroom', titulo: 'Acceso a clase de Classroom', campos: ['materia', 'enlace'],
      texto: (d, c) => `Hola ${d.nombre}, te saludamos de ${INST}. Te compartimos el enlace para ingresar a la clase de Classroom${c.materia ? ` de ${c.materia}` : ''}:\n${c.enlace || '[enlace de la clase]'}\n\nIngresa con tu cuenta de Google. Gracias.` },
    { id: 'grupo', titulo: 'Grupo de WhatsApp', campos: ['grupo', 'enlace'],
      texto: (d, c) => `Hola ${d.nombre}, te saludamos de ${INST}. Te compartimos el enlace para unirte al grupo de WhatsApp${c.grupo ? ` ${c.grupo}` : ''}, donde se compartirán avisos importantes:\n${c.enlace || '[enlace del grupo]'}\n\nGracias.` },
  ];

  const CAMPOS = {
    documentos: { etiqueta: 'Documentos que faltan', tipo: 'text' },
    materia: { etiqueta: 'Materia', tipo: 'text', lista: 'materias' },
    fecha: { etiqueta: 'Fecha de la sesión', tipo: 'date' },
    concepto: { etiqueta: 'Concepto del pago', tipo: 'text', lista: 'pagos' },
    enlace: { etiqueta: 'Enlace', tipo: 'url' },
    grupo: { etiqueta: 'Nombre del grupo', tipo: 'text' },
  };

  function fechaLarga(iso) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function nombrePropio(t) {
    return String(t || '').toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).trim();
  }
  function listaNatural(xs) {
    return xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
  }
  // 10 dígitos de México → 52XXXXXXXXXX
  function numeroWa(tel) {
    let n = String(tel || '').replace(/\D/g, '');
    if (n.length === 13 && n.startsWith('521')) n = '52' + n.slice(3);
    if (n.length === 10) n = '52' + n;
    return n.length >= 11 && n.length <= 15 ? n : null;
  }
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const guardado = (k) => { try { return localStorage.getItem('wa_' + k) || ''; } catch (e) { return ''; } };
  const guardar = (k, v) => { try { localStorage.setItem('wa_' + k, v); } catch (e) { /* sin almacenamiento */ } };

  function estilos() {
    if (document.getElementById('waEstilos')) return;
    const s = document.createElement('style');
    s.id = 'waEstilos';
    s.textContent = `
.wa-btn{display:inline-flex;align-items:center;gap:5px;background:#1f8f4e;color:#fff;border:0;border-radius:8px;padding:3px 9px;font:700 .78rem/1.4 inherit;cursor:pointer;margin-left:8px;vertical-align:middle}
.wa-btn:hover{background:#17733e}.wa-btn svg{width:13px;height:13px;fill:#fff}
.wa-fondo{position:fixed;inset:0;background:rgba(11,21,32,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
.wa-caja{background:#fff;color:#0b1520;border-radius:14px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:20px 22px;box-shadow:0 12px 36px rgba(0,0,0,.3);font-family:inherit}
.wa-caja h2{margin:0 0 2px;font-size:1.15rem}.wa-caja .wa-sub{margin:0 0 12px;color:#4a5866;font-size:.86rem}
.wa-caja label{display:block;font-size:.8rem;font-weight:700;color:#26333f;margin:10px 0 4px}
.wa-caja select,.wa-caja input,.wa-caja textarea{width:100%;box-sizing:border-box;border:1px solid #c3ccd6;border-radius:8px;padding:8px 9px;font:inherit;font-size:.88rem;color:#0b1520;background:#fff}
.wa-caja textarea{min-height:150px;resize:vertical}
.wa-campos{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.wa-campos .wa-ancho{grid-column:1/-1}
.wa-acc{display:flex;justify-content:flex-end;gap:10px;margin-top:14px;flex-wrap:wrap}
.wa-acc button{border-radius:8px;padding:8px 14px;font:700 .88rem inherit;cursor:pointer}
.wa-cancelar{background:#fff;border:1px solid #c3ccd6;color:#26333f}.wa-abrir{background:#1f8f4e;border:0;color:#fff}
.wa-abrir:disabled{opacity:.5;cursor:not-allowed}.wa-nota{font-size:.78rem;color:#4a5866;margin:8px 0 0}.wa-error{color:#a0242f}
@media (max-width:560px){.wa-campos{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  const ICONO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.2.3-.1.5.5.8 1 1.4 1.7 2 .8.6 1.5.9 1.8 1 .2.1.4.1.5-.1l.8-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.2z"/></svg>';

  // Botón verde listo para insertar en HTML; usa data-wa con un índice de registro.
  function boton(clave) {
    estilos();
    return `<button type="button" class="wa-btn" data-wa="${esc(clave)}" title="Enviar mensaje por WhatsApp">${ICONO}WhatsApp</button>`;
  }

  function abrir(datos) {
    estilos();
    const numero = numeroWa(datos.telefono);
    const nombre = nombrePropio(datos.nombres || datos.nombre || '');
    const d = { ...datos, nombre };
    const fondo = document.createElement('div');
    fondo.className = 'wa-fondo';
    fondo.innerHTML = `
      <div class="wa-caja" role="dialog" aria-modal="true" aria-labelledby="waTitulo">
        <h2 id="waTitulo">Enviar mensaje por WhatsApp</h2>
        <p class="wa-sub">${esc(datos.nombreCompleto || nombre)} · ${numero ? '+' + esc(numero.replace(/^52(\d{3})(\d{3})(\d{4})$/, '52 $1 $2 $3')) : '<span class="wa-error">teléfono no válido</span>'}</p>
        <label for="waPlantilla">Mensaje predefinido</label>
        <select id="waPlantilla">${PLANTILLAS.map((p) => `<option value="${p.id}">${esc(p.titulo)}</option>`).join('')}</select>
        <div class="wa-campos" id="waCampos"></div>
        <label for="waTexto">Texto (puedes editarlo)</label>
        <textarea id="waTexto"></textarea>
        <p class="wa-nota">Se abrirá WhatsApp (Web o la app) con el mensaje escrito; revísalo y da Enviar.${numero ? '' : ' <b class="wa-error">Corrige el teléfono del estudiante (10 dígitos) para poder enviar.</b>'}</p>
        <div class="wa-acc"><button type="button" class="wa-cancelar">Cancelar</button><button type="button" class="wa-abrir" ${numero ? '' : 'disabled'}>Abrir WhatsApp</button></div>
      </div>`;
    document.body.appendChild(fondo);
    const $ = (s) => fondo.querySelector(s);
    const sel = $('#waPlantilla');
    const texto = $('#waTexto');
    const valores = { ...(datos.valores || {}) };

    const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', teclas); };
    const teclas = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', teclas);
    fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
    $('.wa-cancelar').addEventListener('click', cerrar);

    const plantilla = () => PLANTILLAS.find((p) => p.id === sel.value);
    const redactar = () => { texto.value = plantilla().texto(d, valores); };

    function pintarCampos() {
      const p = plantilla();
      const cont = $('#waCampos');
      cont.innerHTML = '';
      p.campos.forEach((c) => {
        const def = CAMPOS[c];
        if (valores[c] === undefined) {
          valores[c] = c === 'documentos' ? listaNatural(datos.faltantes || [])
            : c === 'enlace' ? (guardado(p.id + '_enlace') || p.enlacePorDefecto || '')
            : c === 'fecha' ? new Date().toISOString().slice(0, 10) : '';
        } else if (c === 'enlace') {
          valores[c] = guardado(p.id + '_enlace') || p.enlacePorDefecto || '';
        }
        const opciones = def.lista ? (datos[def.lista] || []) : [];
        const div = document.createElement('div');
        if (c === 'enlace' || c === 'documentos') div.className = 'wa-ancho';
        div.innerHTML = `<label>${esc(def.etiqueta)}</label><input type="${def.tipo}" ${opciones.length ? `list="waLista_${c}"` : ''} ${c === 'enlace' ? 'placeholder="https://..."' : ''}>
          ${opciones.length ? `<datalist id="waLista_${c}">${[...new Set(opciones)].map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}`;
        const input = div.querySelector('input');
        input.value = valores[c];
        input.addEventListener('input', () => {
          valores[c] = input.value.trim();
          if (c === 'enlace') guardar(p.id + '_enlace', valores[c]);
          redactar();
        });
        cont.appendChild(div);
      });
      redactar();
    }

    sel.addEventListener('change', pintarCampos);
    if (datos.plantilla) sel.value = datos.plantilla;
    pintarCampos();
    $('.wa-abrir').addEventListener('click', () => {
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto.value.trim())}`, '_blank', 'noopener');
      cerrar();
    });
    sel.focus();
  }

  if (document.head) estilos(); else document.addEventListener('DOMContentLoaded', estilos);
  window.WhatsApp = { abrir, boton, numeroWa, icono: ICONO };
})();
