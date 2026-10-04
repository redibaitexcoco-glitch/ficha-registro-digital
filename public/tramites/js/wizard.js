(() => {
  const form = document.getElementById('formFicha');
  const zonaFormulario = document.getElementById('zonaFormulario');
  const exito = document.getElementById('exito');
  const mensaje = document.getElementById('mensaje');
  const btnAtras = document.getElementById('btnAtras');
  const btnSiguiente = document.getElementById('btnSiguiente');
  const btnEnviar = document.getElementById('btnEnviar');
  const listaPasos = document.getElementById('listaPasos');
  const tituloPaso = document.getElementById('tituloPaso');
  const descripcionPaso = document.getElementById('descripcionPaso');
  const eyebrow = document.getElementById('eyebrow');
  const edadInput = document.getElementById('edad');
  const fechaInput = document.getElementById('fecha_nacimiento');
  const curpInput = document.getElementById('curp');
  const fechaFirmaTexto = document.getElementById('fechaFirmaTexto');

  const secciones = Array.from(form.querySelectorAll('.paso'));
  const completados = new Set(); // ids de pasos ya validados
  let actual = secciones[0];
  let fichaId = null; // se guarda al crear la ficha, para no duplicarla si falla la subida de documentos
  let firmaIniciada = false;
  let fechaAutomatica = false; // true mientras la fecha de nacimiento la haya propuesto la CURP

  // ---------- Utilidades ----------
  function aMayusculasSinAcentos(str) {
    if (!str) return str;
    return str
      .replace(/[ñÑ]/g, '\u0001')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\u0001/g, 'Ñ');
  }

  function calcularEdad(fechaStr) {
    if (!fechaStr) return '';
    const nacimiento = new Date(fechaStr);
    if (isNaN(nacimiento.getTime())) return '';
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad;
  }

  // Mismos criterios que el formulario actual: el tutor aplica si la edad es desconocida o menor de 21.
  function tutorVisible() {
    return edadInput.value === '' || Number(edadInput.value) < 21;
  }
  function esMenorConfirmado() {
    return edadInput.value !== '' && Number(edadInput.value) < 21;
  }

  function pasosActivos() {
    return secciones.filter((s) => s.dataset.paso !== 'tutor' || tutorVisible());
  }

  function etiquetaDe(control) {
    const lab = control.labels && control.labels[0];
    if (!lab) return control.name;
    return lab.textContent.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  }

  // ---------- Texto en mayúsculas sin acentos (todos los text/tel, como antes) ----------
  form.querySelectorAll('input[type="text"], input[type="tel"]').forEach((input) => {
    input.addEventListener('input', () => {
      const inicio = input.selectionStart;
      const fin = input.selectionEnd;
      input.value = aMayusculasSinAcentos(input.value);
      if (inicio !== null && fin !== null) {
        try { input.setSelectionRange(inicio, fin); } catch (e) { /* tipos sin selección */ }
      }
    });
  });

  // ---------- CURP: validación suave y fecha de nacimiento propuesta ----------
  const CURP_FORMATO = /^[A-Z]{4}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;

  function fechaDesdeCurp(curp) {
    if (curp.length !== 18) return '';
    const aa = curp.slice(4, 6);
    const mm = curp.slice(6, 8);
    const dd = curp.slice(8, 10);
    const siglo = /\d/.test(curp[16]) ? '19' : '20'; // 17.º carácter: dígito => 1900s, letra => 2000s
    const iso = `${siglo}${aa}-${mm}-${dd}`;
    const f = new Date(`${iso}T00:00:00`);
    if (isNaN(f.getTime())) return '';
    const igual = f.getFullYear() === Number(siglo + aa) && f.getMonth() + 1 === Number(mm) && f.getDate() === Number(dd);
    return igual ? iso : '';
  }

  function actualizarEdad() {
    edadInput.value = calcularEdad(fechaInput.value);
    renderNav();
    actualizarTextoBotones();
  }

  curpInput.addEventListener('input', () => {
    curpInput.value = curpInput.value.replace(/\s/g, '');
    const v = curpInput.value;
    const aviso = document.getElementById('avisoCurp');
    aviso.hidden = !(v.length === 18 && !CURP_FORMATO.test(v));
    if (v.length === 18 && (fechaInput.value === '' || fechaAutomatica)) {
      const propuesta = fechaDesdeCurp(v);
      if (propuesta) {
        fechaInput.value = propuesta;
        fechaAutomatica = true;
        actualizarEdad();
      }
    }
  });

  fechaInput.addEventListener('change', () => {
    fechaAutomatica = false;
    actualizarEdad();
  });

  // ---------- Errores por campo ----------
  function campoDe(control) {
    return control.closest('.campo') || control.closest('.documento');
  }

  function limpiarError(control) {
    const campo = campoDe(control);
    if (!campo) return;
    campo.removeAttribute('data-invalido');
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-describedby');
    const p = campo.querySelector('.error-campo');
    if (p) p.hidden = true;
  }

  function ponerError(control, texto) {
    const campo = campoDe(control);
    if (!campo) return;
    let p = campo.querySelector('.error-campo');
    if (!p) {
      p = document.createElement('p');
      p.className = 'error-campo';
      p.id = `err-${control.id}`;
      campo.appendChild(p);
    }
    p.textContent = texto;
    p.hidden = false;
    campo.setAttribute('data-invalido', '');
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', p.id);
  }

  form.addEventListener('input', (e) => {
    if (e.target.matches('input, select')) limpiarError(e.target);
  });
  form.addEventListener('change', (e) => {
    if (e.target.matches('select')) limpiarError(e.target);
  });

  // ---------- Documentos ----------
  const CAMPOS_DOCUMENTO = [
    { inputId: 'doc_acta', campo: 'acta_nacimiento' },
    { inputId: 'doc_curp_archivo', campo: 'curp' },
    { inputId: 'doc_ine', campo: 'ine' },
    { inputId: 'doc_certificado', campo: 'certificado' },
    { inputId: 'doc_titulo', campo: 'titulo' },
    { inputId: 'doc_cedula', campo: 'cedula' },
    { inputId: 'doc_foto', campo: 'fotografia' },
  ];
  const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB
  const TIPOS_PDF = ['application/pdf'];
  const TIPOS_FOTO = ['application/pdf', 'image/jpeg', 'image/png'];

  function errorDeArchivo(input, campo) {
    if (!input.files.length) return null;
    const archivo = input.files[0];
    const permitidos = campo === 'fotografia' ? TIPOS_FOTO : TIPOS_PDF;
    if (!permitidos.includes(archivo.type)) {
      return campo === 'fotografia'
        ? 'El archivo debe ser PDF, JPG o PNG.'
        : 'El archivo debe ser un PDF.';
    }
    if (archivo.size > TAMANO_MAXIMO) return 'El archivo supera los 5 MB permitidos.';
    return null;
  }

  function tamanoLegible(bytes) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  CAMPOS_DOCUMENTO.forEach(({ inputId, campo }) => {
    const input = document.getElementById(inputId);
    const caja = input.closest('.documento');
    const estado = caja.querySelector('.estado-archivo');
    input.addEventListener('change', () => {
      limpiarError(input);
      caja.classList.remove('con-archivo', 'con-error');
      if (!input.files.length) {
        estado.textContent = 'Ningún archivo seleccionado';
        return;
      }
      const err = errorDeArchivo(input, campo);
      if (err) {
        ponerError(input, err);
        caja.classList.add('con-error');
        estado.textContent = 'Archivo no válido';
        return;
      }
      caja.classList.add('con-archivo');
      estado.textContent = `${input.files[0].name} · ${tamanoLegible(input.files[0].size)}`;
    });
  });

  // ---------- Validación por paso ----------
  function validarPaso(seccion) {
    let primerInvalido = null;
    const marcar = (control, texto) => {
      ponerError(control, texto);
      if (!primerInvalido) primerInvalido = control;
    };

    seccion.querySelectorAll('input, select').forEach((control) => {
      if (control.type === 'hidden' || control.type === 'file' || control.type === 'checkbox') return;
      limpiarError(control);
      const valor = control.value.trim();

      const requeridoTutor = esMenorConfirmado() && (control.id === 'tutor_primer_apellido' || control.id === 'tutor_nombres');
      if ((control.required || requeridoTutor) && valor === '') {
        marcar(control, control.tagName === 'SELECT' ? 'Selecciona una opción.' : 'Este campo es obligatorio.');
        return;
      }
      if (valor === '') return;

      if (control.id === 'curp' && valor.length !== 18) {
        marcar(control, 'La CURP debe tener 18 caracteres.');
        return;
      }
      if (control.type === 'email' && control.validity.typeMismatch) {
        marcar(control, 'Escribe un correo válido, por ejemplo nombre@dominio.com.');
        return;
      }
      if (control.type === 'number' && (control.validity.rangeUnderflow || control.validity.rangeOverflow || control.validity.badInput)) {
        marcar(control, `El valor debe estar entre ${control.min} y ${control.max}.`);
      }
    });

    if (seccion.dataset.paso === 'documentos') {
      CAMPOS_DOCUMENTO.forEach(({ inputId, campo }) => {
        const input = document.getElementById(inputId);
        const err = errorDeArchivo(input, campo);
        if (err) marcar(input, err);
      });
    }

    if (primerInvalido) primerInvalido.focus();
    return !primerInvalido;
  }

  // ---------- Navegación ----------
  function renderNav() {
    const activos = pasosActivos();
    const idx = Math.max(0, activos.indexOf(actual));
    listaPasos.textContent = '';
    activos.forEach((s, i) => {
      const li = document.createElement('li');
      const hecho = completados.has(s.dataset.paso) && s !== actual;
      li.className = s === actual ? 'actual' : hecho ? 'hecho' : '';
      const b = document.createElement('button');
      b.type = 'button';
      b.disabled = !hecho;
      if (s === actual) b.setAttribute('aria-current', 'step');
      const num = document.createElement('span');
      num.className = 'paso-num';
      if (hecho) {
        num.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      } else {
        num.textContent = String(i + 1);
      }
      const txt = document.createElement('span');
      txt.textContent = s.dataset.titulo;
      if (s.dataset.nota) {
        const nota = document.createElement('span');
        nota.className = 'paso-nota';
        nota.textContent = s.dataset.nota;
        txt.appendChild(nota);
      }
      b.append(num, txt);
      b.addEventListener('click', () => irA(s));
      li.appendChild(b);
      listaPasos.appendChild(li);
    });
    eyebrow.textContent = `Paso ${idx + 1} de ${activos.length}`;
    document.querySelectorAll('[data-obligatorio-menor]').forEach((el) => { el.hidden = !esMenorConfirmado(); });
    actualizarProgreso(idx, activos.length);
  }

  function actualizarProgreso(idx, total, completo) {
    const pct = completo ? 100 : Math.round(((idx + 1) / total) * 100);
    const conteo = completo ? `${total} de ${total}` : `${idx + 1} de ${total}`;
    document.getElementById('avanceConteo').textContent = conteo;
    document.getElementById('avanceBarra').style.width = `${pct}%`;
    const cont = document.getElementById('avanceContenedor');
    cont.setAttribute('aria-valuenow', String(pct));
    document.getElementById('movilConteo').textContent = `Paso ${conteo}`;
    document.getElementById('movilBarra').style.width = `${pct}%`;
    document.getElementById('movilTitulo').textContent = actual.dataset.titulo;
  }

  function actualizarTextoBotones() {
    const activos = pasosActivos();
    const esUltimo = activos[activos.length - 1] === actual;
    const esPrimero = activos[0] === actual;
    btnAtras.style.visibility = esPrimero ? 'hidden' : 'visible';
    btnSiguiente.hidden = esUltimo;
    btnEnviar.hidden = !esUltimo;
  }

  function mostrar(seccion, { enfocar = true } = {}) {
    actual = seccion;
    secciones.forEach((s) => { s.hidden = s !== seccion; });
    const activos = pasosActivos();
    const idx = activos.indexOf(seccion);
    eyebrow.textContent = `Paso ${idx + 1} de ${activos.length}`;
    tituloPaso.textContent = seccion.dataset.titulo;
    descripcionPaso.textContent = seccion.dataset.descripcion || '';
    mensaje.hidden = true;
    renderNav();
    actualizarTextoBotones();

    if (seccion.dataset.paso === 'revision') {
      construirResumen();
      iniciarFirma();
    }
    if (enfocar) {
      tituloPaso.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function irA(seccion) {
    mostrar(seccion);
  }

  function siguiente() {
    if (!validarPaso(actual)) return;
    completados.add(actual.dataset.paso);
    const activos = pasosActivos();
    const i = activos.indexOf(actual);
    if (i < activos.length - 1) mostrar(activos[i + 1]);
  }

  function atras() {
    const activos = pasosActivos();
    const i = activos.indexOf(actual);
    if (i > 0) mostrar(activos[i - 1]);
  }

  btnSiguiente.addEventListener('click', siguiente);
  btnAtras.addEventListener('click', atras);

  // ---------- Resumen ----------
  function construirResumen() {
    const cont = document.getElementById('resumen');
    cont.textContent = '';
    pasosActivos().forEach((s) => {
      if (s.dataset.paso === 'revision') return;
      const filas = [];
      s.querySelectorAll('.campo, .documento').forEach((caja) => {
        const control = caja.querySelector('input, select');
        if (!control || control.type === 'hidden') return;
        if (control.type === 'file') {
          if (control.files.length) filas.push([etiquetaDe(control), control.files[0].name]);
          return;
        }
        const valor = control.tagName === 'SELECT'
          ? (control.selectedOptions[0] && control.value ? control.selectedOptions[0].text : '')
          : control.value.trim();
        if (valor !== '') filas.push([etiquetaDe(control), valor]);
      });

      const bloque = document.createElement('div');
      bloque.className = 'resumen-bloque';
      const cab = document.createElement('header');
      const h3 = document.createElement('h3');
      h3.textContent = s.dataset.titulo;
      const editar = document.createElement('button');
      editar.type = 'button';
      editar.className = 'btn-enlace';
      editar.textContent = 'Editar';
      editar.addEventListener('click', () => irA(s));
      cab.append(h3, editar);
      bloque.appendChild(cab);

      if (filas.length) {
        const dl = document.createElement('dl');
        filas.forEach(([k, v]) => {
          const dt = document.createElement('dt');
          dt.textContent = k;
          const dd = document.createElement('dd');
          dd.textContent = v;
          dl.append(dt, dd);
        });
        bloque.appendChild(dl);
      } else {
        const p = document.createElement('p');
        p.className = 'resumen-vacio';
        p.textContent = s.dataset.paso === 'documentos' ? 'No adjuntaste documentos.' : 'Sin datos capturados.';
        bloque.appendChild(p);
      }
      cont.appendChild(bloque);
    });
  }

  // ---------- Fecha de firma (con municipio y estado si hay permiso de ubicación) ----------
  function iniciarFirma() {
    if (firmaIniciada) return;
    firmaIniciada = true;
    const hoy = new Date();
    const fechaTexto = hoy.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    fechaFirmaTexto.textContent = fechaTexto;

    if (!navigator.geolocation) {
      console.warn('Geolocalización no disponible en este navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (posicion) => {
        try {
          const { latitude, longitude } = posicion.coords;
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
            { headers: { Accept: 'application/json' } }
          );
          if (!resp.ok) {
            console.warn('Nominatim respondió con error HTTP:', resp.status);
            return;
          }
          const datos = await resp.json();
          const direccion = datos.address || {};
          const municipio =
            direccion.municipality || direccion.city || direccion.town ||
            direccion.county || direccion.village || direccion.suburb;
          const estado = direccion.state || direccion.state_district || direccion.region;
          if (municipio && estado) {
            fechaFirmaTexto.textContent = `${municipio}, ${estado} a ${fechaTexto}`;
          } else {
            console.warn('No se encontró municipio/estado en la respuesta de Nominatim:', direccion);
          }
        } catch (err) {
          console.warn('Error al consultar el servicio de ubicación:', err);
        }
      },
      (err) => { console.warn('Geolocalización denegada o falló:', err && err.message); },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }

  // ---------- Envío ----------
  function mostrarMensaje(texto) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje error';
    mensaje.hidden = false;
    mensaje.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function subirDocumentos(id) {
    const formData = new FormData();
    let hayArchivos = false;
    for (const { inputId, campo } of CAMPOS_DOCUMENTO) {
      const input = document.getElementById(inputId);
      if (input && input.files.length) {
        formData.append(campo, input.files[0]);
        hayArchivos = true;
      }
    }
    if (!hayArchivos) return { ok: true };
    try {
      const resp = await fetch(`/api/fichas/${id}/documentos`, { method: 'POST', body: formData });
      const data = await resp.json().catch(() => ({}));
      return { ok: resp.ok, error: data.error };
    } catch (err) {
      return { ok: false, error: 'No se pudo conectar con el servidor para subir los documentos.' };
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.hidden = true;

    // Enter en un campo de un paso intermedio equivale a "continuar".
    const activos = pasosActivos();
    if (actual !== activos[activos.length - 1]) {
      siguiente();
      return;
    }

    // Revalida todos los pasos por si se corrigió algo desde el resumen.
    for (const s of activos) {
      if (s.dataset.paso === 'revision') continue;
      if (!validarPaso(s)) {
        mostrar(s, { enfocar: false });
        validarPaso(s);
        return;
      }
    }

    const acepto = document.getElementById('acepto_conformidad');
    const errorConformidad = document.getElementById('errorConformidad');
    if (!acepto.checked) {
      errorConformidad.hidden = false;
      acepto.focus();
      return;
    }
    errorConformidad.hidden = true;

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';

    try {
      if (!fichaId) {
        const datos = {};
        for (const [nombre, valor] of new FormData(form).entries()) {
          if (valor instanceof File) continue; // los documentos se suben aparte
          datos[nombre] = valor;
        }
        datos.acepto_conformidad = acepto.checked;
        datos.fecha_firma = new Date().toISOString().slice(0, 10);

        const resp = await fetch('/api/fichas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          mostrarMensaje(data.error || 'Ocurrió un error al enviar la ficha.');
          return;
        }
        fichaId = data.id;
      }

      const resultadoDocs = await subirDocumentos(fichaId);
      if (!resultadoDocs.ok) {
        mostrarMensaje(
          'Tus datos se registraron correctamente, pero no se pudieron subir los documentos adjuntos. ' +
          'Puedes volver a intentarlo con el botón, o enviarlos por correo a serviciosescolares@redibaiconnect.org.'
        );
        btnEnviar.textContent = 'Reintentar subida de documentos';
        return;
      }

      // Éxito
      zonaFormulario.style.display = 'none';
      exito.hidden = false;
      completados.add(actual.dataset.paso);
      actualizarProgreso(0, activos.length, true);
      listaPasos.querySelectorAll('li').forEach((li) => { li.className = 'hecho'; });
      document.getElementById('tituloExito').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      mostrarMensaje('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      btnEnviar.disabled = false;
      if (!fichaId) btnEnviar.textContent = 'Enviar ficha de registro';
    }
  });

  // ---------- Inicio ----------
  mostrar(secciones[0], { enfocar: false });
})();
