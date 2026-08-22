(() => {
  const form = document.getElementById('formFicha');
  const mensaje = document.getElementById('mensaje');
  const btnEnviar = document.getElementById('btnEnviar');
  const seccionTutor = document.getElementById('seccionTutor');
  const fechaNacimientoInput = document.getElementById('fecha_nacimiento');
  const edadInput = document.getElementById('edad');
  const fechaFirmaTexto = document.getElementById('fechaFirmaTexto');

  const hoy = new Date();
  fechaFirmaTexto.textContent = `Texcoco, México a ${hoy.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`;

  // Campos de documento: id del <input type="file"> en el HTML -> nombre que espera el servidor.
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

  function aMayusculasSinAcentos(str) {
    if (!str) return str;
    return str
      .replace(/[ñÑ]/g, '\u0001')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\u0001/g, 'Ñ');
  }

  // Todos los campos de texto/tel del formulario (excepto correo electrónico) se
  // fuerzan a mayúsculas sin acentos, tal como debe capturarse la ficha oficial.
  const camposTexto = form.querySelectorAll('input[type="text"], input[type="tel"]');
  camposTexto.forEach((input) => {
    input.addEventListener('input', () => {
      const inicio = input.selectionStart;
      const fin = input.selectionEnd;
      input.value = aMayusculasSinAcentos(input.value);
      if (inicio !== null && fin !== null) input.setSelectionRange(inicio, fin);
    });
  });

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

  function actualizarSeccionTutor() {
    const edad = Number(edadInput.value);
    const mostrar = edadInput.value === '' || edad < 21;
    seccionTutor.style.display = mostrar ? '' : 'none';
  }

  fechaNacimientoInput.addEventListener('change', () => {
    edadInput.value = calcularEdad(fechaNacimientoInput.value);
    actualizarSeccionTutor();
  });

  actualizarSeccionTutor();

  function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = `mensaje ${tipo}`;
    mensaje.hidden = false;
    mensaje.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Valida tamaño y tipo de cada documento adjunto antes de enviar.
  function validarDocumentos() {
    for (const { inputId, campo } of CAMPOS_DOCUMENTO) {
      const input = document.getElementById(inputId);
      if (!input || !input.files.length) continue;
      const archivo = input.files[0];
      const tiposPermitidos = campo === 'fotografia' ? TIPOS_FOTO : TIPOS_PDF;
      if (!tiposPermitidos.includes(archivo.type)) {
        return `El archivo de "${input.labels[0]?.textContent || campo}" no tiene un formato válido.`;
      }
      if (archivo.size > TAMANO_MAXIMO) {
        return `El archivo de "${input.labels[0]?.textContent || campo}" supera los 5 MB permitidos.`;
      }
    }
    return null;
  }

  // Sube los documentos adjuntos (si los hay) a la ficha ya creada.
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

    if (!form.reportValidity()) return;

    const errorDocumentos = validarDocumentos();
    if (errorDocumentos) {
      mostrarMensaje(errorDocumentos, 'error');
      return;
    }

    const datos = {};
    for (const [nombre, valor] of new FormData(form).entries()) {
      if (valor instanceof File) continue; // los documentos se suben aparte
      datos[nombre] = valor;
    }
    datos.acepto_conformidad = document.getElementById('acepto_conformidad').checked;
    datos.fecha_firma = new Date().toISOString().slice(0, 10);

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';

    try {
      const resp = await fetch('/api/fichas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const data = await resp.json();

      if (!resp.ok) {
        mostrarMensaje(data.error || 'Ocurrió un error al enviar la ficha.', 'error');
        return;
      }

      const resultadoDocs = await subirDocumentos(data.id);

      if (!resultadoDocs.ok) {
        mostrarMensaje(
          'La ficha se registró correctamente, pero no se pudieron subir los documentos adjuntos. ' +
          'Por favor envíelos por correo a serviciosescolares@redibaiconnect.org.',
          'error'
        );
        return;
      }

      mostrarMensaje('Ficha y documentos enviados correctamente. Servicios Escolares recibió su registro.', 'ok');
      form.reset();
      actualizarSeccionTutor();
    } catch (err) {
      mostrarMensaje('No se pudo conectar con el servidor. Intenta de nuevo.', 'error');
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar ficha de registro';
    }
  });
})();
