const express = require('express');
const multer = require('multer');
const router = express.Router();
const pool = require('../db/pool');
const { obtenerOCrearCarpetaEstudiante, subirArchivo, nombreSeguro } = require('../services/googleDrive');

const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

// Campo del formulario -> { columna en la BD, etiqueta para el nombre del archivo en Drive, tipos permitidos }
const CAMPOS_DOCUMENTO = {
  acta_nacimiento: { columna: 'doc_acta_nacimiento_id', etiqueta: 'ActaNacimiento', tipos: ['application/pdf'] },
  curp: { columna: 'doc_curp_id', etiqueta: 'CURP', tipos: ['application/pdf'] },
  ine: { columna: 'doc_ine_id', etiqueta: 'INE', tipos: ['application/pdf'] },
  ultimo_grado: { columna: 'doc_ultimo_grado_id', etiqueta: 'UltimoGrado', tipos: ['application/pdf'] },
  fotografia: { columna: 'doc_fotografia_id', etiqueta: 'Fotografia', tipos: ['application/pdf', 'image/jpeg', 'image/png'] },
};

const upload = multer({
  storage: multer.memoryStorage(), // los archivos se procesan en memoria y se envían a Drive; no se guardan en disco
  limits: { fileSize: TAMANO_MAXIMO },
});

const camposUpload = Object.keys(CAMPOS_DOCUMENTO).map((campo) => ({ name: campo, maxCount: 1 }));

// Envuelve upload.fields para responder con un JSON claro si Multer falla
// (archivo demasiado grande, campo inesperado, etc.) en vez de un error genérico.
function manejarSubidaArchivos(req, res, next) {
  upload.fields(camposUpload)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Uno de los archivos supera el límite de 5 MB permitido.' });
    }
    console.error('Error de Multer al recibir documentos:', err.message);
    return res.status(400).json({ error: 'No se pudo procesar alguno de los archivos adjuntos.' });
  });
}

function extensionPara(mimeType) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  return 'bin';
}

// POST /api/fichas/:id/documentos - sube uno o más documentos de una ficha ya creada.
// Público a propósito (igual que el alta de la ficha): el estudiante lo llama justo
// después de enviar el formulario, sin necesidad de una cuenta.
router.post(
  '/:id/documentos',
  manejarSubidaArchivos,
  async (req, res) => {
    const { id } = req.params;

    // Confirma que la ficha exista y obtiene los datos para nombrar la carpeta/archivos.
    let ficha;
    try {
      const resultado = await pool.query(
        'SELECT id, curp, primer_apellido, segundo_apellido, nombres, drive_folder_id FROM fichas_registro WHERE id = $1',
        [id]
      );
      if (!resultado.rows.length) return res.status(404).json({ error: 'Ficha no encontrada.' });
      ficha = resultado.rows[0];
    } catch (err) {
      console.error('Error al buscar la ficha para subir documentos:', err);
      return res.status(500).json({ error: 'No se pudo verificar la ficha.' });
    }

    const archivos = req.files || {};
    const camposRecibidos = Object.keys(archivos).filter((campo) => archivos[campo]?.length);

    if (!camposRecibidos.length) {
      return res.status(400).json({ error: 'No se recibió ningún documento.' });
    }

    let carpetaId = ficha.drive_folder_id;

    try {
      if (!carpetaId) {
        carpetaId = await obtenerOCrearCarpetaEstudiante({
          curp: ficha.curp,
          primerApellido: ficha.primer_apellido,
          segundoApellido: ficha.segundo_apellido,
          nombres: ficha.nombres,
        });
        await pool.query('UPDATE fichas_registro SET drive_folder_id = $1 WHERE id = $2', [carpetaId, id]);
      }
    } catch (err) {
      console.error('Error al preparar la carpeta de Drive:', err.message);
      return res.status(503).json({
        error: 'El almacenamiento de documentos no está disponible en este momento. Intente más tarde o envíelos por correo.',
      });
    }

    const actualizaciones = [];
    const errores = [];

    for (const campo of camposRecibidos) {
      const archivo = archivos[campo][0];
      const config = CAMPOS_DOCUMENTO[campo];

      if (!config.tipos.includes(archivo.mimetype)) {
        errores.push(`El documento "${campo}" no tiene un formato permitido.`);
        continue;
      }

      const curpONombre = nombreSeguro(ficha.curp) || nombreSeguro(`${ficha.primer_apellido}_${ficha.nombres}`);
      const nombreArchivo = `${curpONombre}_${config.etiqueta}.${extensionPara(archivo.mimetype)}`;

      try {
        const subido = await subirArchivo({
          buffer: archivo.buffer,
          nombreArchivo,
          mimeType: archivo.mimetype,
          carpetaId,
        });
        actualizaciones.push({ columna: config.columna, valor: subido.fileId });
      } catch (err) {
        console.error(`Error al subir el documento "${campo}" a Drive:`, err.message);
        errores.push(`No se pudo subir el documento "${campo}".`);
      }
    }

    if (actualizaciones.length) {
      const sets = actualizaciones.map((a, i) => `${a.columna} = $${i + 1}`).join(', ');
      const valores = actualizaciones.map((a) => a.valor);
      valores.push(id);
      try {
        await pool.query(`UPDATE fichas_registro SET ${sets} WHERE id = $${valores.length}`, valores);
      } catch (err) {
        console.error('Error al guardar los identificadores de documentos:', err);
        return res.status(500).json({ error: 'Los documentos se subieron, pero no se pudo guardar la referencia.' });
      }
    }

    if (errores.length && !actualizaciones.length) {
      return res.status(502).json({ error: errores.join(' ') });
    }

    return res.status(errores.length ? 207 : 200).json({
      ok: true,
      subidos: actualizaciones.length,
      errores: errores.length ? errores : undefined,
    });
  }
);

module.exports = router;
