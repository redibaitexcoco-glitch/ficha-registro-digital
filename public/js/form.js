(() => {
  const form = document.getElementById('formFicha');
  const mensaje = document.getElementById('mensaje');
  const btnEnviar = document.getElementById('btnEnviar');
  const chipGroup = document.getElementById('capturadoPorGroup');
  const seccionTutor = document.getElementById('seccionTutor');
  const fechaNacimientoInput = document.getElementById('fecha_nacimiento');
  const edadInput = document.getElementById('edad');
  const fechaFirmaTexto = document.getElementById('fechaFirmaTexto');

  let capturadoPor = 'estudiante';

  const hoy = new Date();
  fechaFirmaTexto.textContent = `Texcoco, México a ${hoy.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`;

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

  async function solicitarAutorizacionAdmin() {
    const usuario = prompt('Usuario de administrador:');
    if (!usuario) return false;
    const clave = prompt('Contraseña de administrador:');
    if (clave === null) return false;
    try {
      const resp = await fetch('/api/admin/verificar', {
        headers: { Authorization: 'Basic ' + btoa(`${usuario}:${clave}`) },
      });
      return resp.ok;
    } catch (err) {
      return false;
    }
  }

  chipGroup.addEventListener('click', async (e) => {
    const btn = e.target.closest('.chip');
    if (!btn || btn.classList.contains('active')) return;

    if (btn.dataset.valor === 'personal') {
      const autorizado = await solicitarAutorizacionAdmin();
      if (!autorizado) return;
    }

    capturadoPor = btn.dataset.valor;
    [...chipGroup.querySelectorAll('.chip')].forEach((c) => c.classList.toggle('active', c === btn));
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.hidden = true;

    if (!form.reportValidity()) return;

    const datos = Object.fromEntries(new FormData(form).entries());
    datos.acepto_conformidad = document.getElementById('acepto_conformidad').checked;
    datos.capturado_por = capturadoPor;
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

      mostrarMensaje('Ficha enviada correctamente. Servicios Escolares recibió tu registro.', 'ok');
      form.reset();
      actualizarSeccionTutor();
      [...chipGroup.querySelectorAll('.chip')].forEach((c) => c.classList.toggle('active', c.dataset.valor === 'estudiante'));
      capturadoPor = 'estudiante';
    } catch (err) {
      mostrarMensaje('No se pudo conectar con el servidor. Intenta de nuevo.', 'error');
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar ficha de registro';
    }
  });
})();
