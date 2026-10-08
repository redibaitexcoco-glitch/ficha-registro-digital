const multer = require('multer');

const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB por documento

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANO_MAXIMO, files: 15 } });

// Recibe archivos con cualquier nombre de campo (se validan contra la configuración del trámite)
function recibirArchivos(req, res, next) {
  upload.any()(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Uno de los archivos supera el límite de 5 MB permitido.' });
    console.error('Error de Multer en trámites:', err.message);
    return res.status(400).json({ error: 'No se pudo procesar alguno de los archivos adjuntos.' });
  });
}

// Un PDF real empieza con "%PDF". Así se rechazan imágenes renombradas como .pdf.
function esPdf(archivo) {
  return archivo && archivo.buffer && archivo.buffer.length > 4 && archivo.buffer.slice(0, 5).toString('latin1').startsWith('%PDF');
}

function limpiar(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function aMayusculasSinAcentos(valor) {
  const t = limpiar(valor);
  if (!t) return t;
  return t.replace(/[ñÑ]/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\u0001/g, 'Ñ');
}

// Estado general del trámite a partir del estado de sus documentos
async function recalcularEstado(db, tramiteId) {
  const { rows } = await db.query('SELECT interno, estado FROM tramite_documentos WHERE tramite_id = $1', [tramiteId]);
  const { rows: t } = await db.query('SELECT estado FROM tramites WHERE id = $1', [tramiteId]);
  if (!t[0] || t[0].estado === 'concluido') return t[0] && t[0].estado;
  let estado = 'en_revision';
  if (rows.some((d) => !d.interno && d.estado === 'no_cumple')) estado = 'con_observaciones';
  else if (rows.length && rows.every((d) => (d.interno ? d.estado === 'listo' : d.estado === 'verificado'))) estado = 'expediente_completo';
  await db.query('UPDATE tramites SET estado = $1, actualizado_en = now() WHERE id = $2', [estado, tramiteId]);
  return estado;
}

module.exports = { recibirArchivos, esPdf, limpiar, aMayusculasSinAcentos, recalcularEstado };
