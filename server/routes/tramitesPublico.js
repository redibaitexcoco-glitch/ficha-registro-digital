// Trámites de Titulación y Posgrados — rutas públicas del estudiante
// (sin cuenta: se identifica con el folio del trámite y su CURP).
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { TIPOS } = require('../tramites/config');
const { recibirArchivos, esPdf, limpiar, aMayusculasSinAcentos, recalcularEstado } = require('../tramites/comun');
const { obtenerOCrearCarpetaEstudiante, subirArchivo, nombreSeguro } = require('../services/googleDrive');

const PLANTELES_VALIDOS = [
  'Red IBAI Texcoco', 'Módulo Ecatepec', 'Módulo San Felipe del Progreso', 'Red IBAI Tapachula',
  'Red IBAI Cacahoatán', 'Red IBAI Comitán', 'Red IBAI Mazatán', 'Red IBAI Motozintla',
  'Red IBAI Pijijiapan', 'Red IBAI Tapachula Ciencias de la Educación',
];
const CURP_FORMATO = /^[A-Z]{4}\d{6}[HMX][A-Z]{2}[A-Z]{3}[A-Z0-9]\d$/;
const ETIQUETA_TIPO = { licenciatura: 'TitulacionLicenciatura', maestria: 'GradoMaestria', doctorado: 'GradoDoctorado' };

// GET /api/tramites/config/:tipo — documentos que pide el formulario
router.get('/config/:tipo', (req, res) => {
  const cfg = TIPOS[req.params.tipo];
  if (!cfg) return res.status(404).json({ error: 'Trámite no disponible.' });
  res.json({ tipo: req.params.tipo, ...cfg, planteles: PLANTELES_VALIDOS });
});

async function subirDocumentoDrive({ archivo, carpetaId, curp, tipo, clave, version }) {
  const nombreArchivo = `${nombreSeguro(curp)}_${ETIQUETA_TIPO[tipo]}_${clave}${version > 1 ? `_v${version}` : ''}.pdf`;
  const subido = await subirArchivo({ buffer: archivo.buffer, nombreArchivo, mimeType: 'application/pdf', carpetaId });
  return { fileId: subido.fileId, nombreArchivo };
}

// POST /api/tramites — crea el trámite con todos sus documentos (multipart)
router.post('/', recibirArchivos, async (req, res) => {
  const b = req.body || {};
  const cfg = TIPOS[b.tipo];
  if (!cfg) return res.status(400).json({ error: 'El tipo de trámite no es válido.' });

  const curp = (limpiar(b.curp) || '').toUpperCase().replace(/\s/g, '');
  const requeridos = { primer_apellido: 'Primer apellido', nombres: 'Nombre(s)', tel_celular: 'Tel. celular', correo_electronico: 'Correo electrónico', programa: 'Programa cursado', periodo_egreso: 'Periodo de egreso', modalidad: 'Modalidad' };
  for (const [campo, nombre] of Object.entries(requeridos)) {
    if (!limpiar(b[campo])) return res.status(400).json({ error: `El campo "${nombre}" es obligatorio.` });
  }
  if (!CURP_FORMATO.test(curp)) return res.status(400).json({ error: 'La CURP no tiene un formato válido.' });
  if (!PLANTELES_VALIDOS.includes(b.plantel)) return res.status(400).json({ error: 'El plantel seleccionado no es válido.' });
  if (!['con_tesis', 'sin_tesis'].includes(b.modalidad)) return res.status(400).json({ error: 'Selecciona la modalidad.' });
  if (b.acepto !== 'true') return res.status(400).json({ error: 'Debes confirmar que la información y los documentos son verídicos.' });

  // Documentos: todos obligatorios, uno por campo, PDF real
  const archivos = {};
  for (const f of req.files || []) archivos[f.fieldname] = f;
  for (const doc of cfg.documentos) {
    const a = archivos[doc.clave];
    if (!a) return res.status(400).json({ error: `Falta el documento "${doc.etiqueta}".` });
    if (!esPdf(a)) return res.status(400).json({ error: `"${doc.etiqueta}" debe ser un PDF escaneado. No se aceptan fotografías.` });
  }

  // 1) Sube a Drive (si falla, no se guarda nada y el estudiante puede reintentar)
  let carpetaId;
  const subidos = {};
  try {
    carpetaId = await obtenerOCrearCarpetaEstudiante({
      curp, primerApellido: aMayusculasSinAcentos(b.primer_apellido), segundoApellido: aMayusculasSinAcentos(b.segundo_apellido), nombres: aMayusculasSinAcentos(b.nombres),
    });
    for (const doc of cfg.documentos) {
      subidos[doc.clave] = await subirDocumentoDrive({ archivo: archivos[doc.clave], carpetaId, curp, tipo: b.tipo, clave: doc.clave, version: 1 });
    }
  } catch (err) {
    console.error('Error al subir documentos del trámite a Drive:', err.message);
    return res.status(503).json({ error: 'No se pudieron guardar los documentos en este momento. Intenta de nuevo en unos minutos.' });
  }

  // 2) Registra el trámite y sus documentos
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const anio = new Date().getFullYear();
    await client.query('SELECT pg_advisory_xact_lock(424242, $1)', [anio]);
    const { rows: c } = await client.query('SELECT COALESCE(MAX(consecutivo), 0) + 1 AS n FROM tramites WHERE anio = $1', [anio]);
    const consecutivo = c[0].n;
    const folio = `TRM-${String(consecutivo).padStart(4, '0')}/${anio}`;
    const { rows } = await client.query(
      `INSERT INTO tramites (anio, consecutivo, folio, tipo, plantel, primer_apellido, segundo_apellido, nombres, curp, matricula,
         tel_celular, correo_electronico, programa, periodo_egreso, modalidad, titulo_trabajo, drive_folder_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [anio, consecutivo, folio, b.tipo, b.plantel, aMayusculasSinAcentos(b.primer_apellido), aMayusculasSinAcentos(b.segundo_apellido),
        aMayusculasSinAcentos(b.nombres), curp, (limpiar(b.matricula) || '').toUpperCase() || null, limpiar(b.tel_celular),
        limpiar(b.correo_electronico), aMayusculasSinAcentos(b.programa), limpiar(b.periodo_egreso), b.modalidad,
        aMayusculasSinAcentos(b.titulo_trabajo), carpetaId]);
    const id = rows[0].id;
    let orden = 0;
    for (const doc of cfg.documentos) {
      await client.query(
        `INSERT INTO tramite_documentos (tramite_id, clave, etiqueta, interno, orden, estado, drive_file_id, nombre_archivo)
         VALUES ($1,$2,$3,false,$4,'en_revision',$5,$6)`,
        [id, doc.clave, doc.etiqueta, orden++, subidos[doc.clave].fileId, subidos[doc.clave].nombreArchivo]);
    }
    for (const doc of cfg.internos) {
      await client.query(
        `INSERT INTO tramite_documentos (tramite_id, clave, etiqueta, interno, orden, estado) VALUES ($1,$2,$3,true,$4,'pendiente')`,
        [id, doc.clave, doc.etiqueta, orden++]);
    }
    await client.query('COMMIT');
    res.status(201).json({ ok: true, folio });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al registrar el trámite:', err);
    res.status(500).json({ error: 'No se pudo registrar el trámite. Intenta nuevamente.' });
  } finally {
    client.release();
  }
});

async function buscarPorFolioYCurp(db, folio, curp) {
  const f = (limpiar(folio) || '').toUpperCase().replace(/\s/g, '');
  const c = (limpiar(curp) || '').toUpperCase().replace(/\s/g, '');
  if (!f || !c) return null;
  const { rows } = await db.query('SELECT * FROM tramites WHERE folio = $1 AND curp = $2', [f, c]);
  return rows[0] || null;
}

// POST /api/tramites/seguimiento — { folio, curp } -> estado del trámite y de cada documento
router.post('/seguimiento', async (req, res) => {
  try {
    const t = await buscarPorFolioYCurp(pool, req.body.folio, req.body.curp);
    if (!t) return res.status(404).json({ error: 'No encontramos un trámite con ese folio y CURP. Revisa que estén escritos igual que en tu comprobante.' });
    const { rows: docs } = await pool.query(
      'SELECT clave, etiqueta, interno, estado, motivo FROM tramite_documentos WHERE tramite_id = $1 ORDER BY interno, orden', [t.id]);
    res.json({
      folio: t.folio, tipo: t.tipo, nombre_tramite: TIPOS[t.tipo] ? TIPOS[t.tipo].nombre : t.tipo, estado: t.estado,
      nombre: `${t.nombres} ${t.primer_apellido} ${t.segundo_apellido || ''}`.trim(), creado: t.created_at, documentos: docs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo consultar el trámite.' });
  }
});

// POST /api/tramites/reenviar — vuelve a subir un documento marcado como "No cumple"
router.post('/reenviar', recibirArchivos, async (req, res) => {
  const archivo = (req.files || [])[0];
  if (!archivo) return res.status(400).json({ error: 'No se recibió el documento.' });
  if (!esPdf(archivo)) return res.status(400).json({ error: 'El documento debe ser un PDF escaneado. No se aceptan fotografías.' });
  try {
    const t = await buscarPorFolioYCurp(pool, req.body.folio, req.body.curp);
    if (!t) return res.status(404).json({ error: 'Trámite no encontrado.' });
    const { rows } = await pool.query(
      'SELECT id, version, estado FROM tramite_documentos WHERE tramite_id = $1 AND clave = $2 AND interno = false', [t.id, req.body.clave]);
    const doc = rows[0];
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
    if (doc.estado !== 'no_cumple') return res.status(409).json({ error: 'Este documento no requiere corrección.' });
    let carpetaId = t.drive_folder_id;
    if (!carpetaId) {
      carpetaId = await obtenerOCrearCarpetaEstudiante({ curp: t.curp, primerApellido: t.primer_apellido, segundoApellido: t.segundo_apellido, nombres: t.nombres });
      await pool.query('UPDATE tramites SET drive_folder_id = $1 WHERE id = $2', [carpetaId, t.id]);
    }
    const version = doc.version + 1;
    const subido = await subirDocumentoDrive({ archivo, carpetaId, curp: t.curp, tipo: t.tipo, clave: req.body.clave, version });
    await pool.query(
      `UPDATE tramite_documentos SET drive_file_id = $1, nombre_archivo = $2, version = $3, estado = 'en_revision', motivo = NULL,
         revisado_por = NULL, revisado_en = NULL, actualizado_en = now() WHERE id = $4`,
      [subido.fileId, subido.nombreArchivo, version, doc.id]);
    await recalcularEstado(pool, t.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al reenviar documento:', err.message);
    res.status(503).json({ error: 'No se pudo guardar el documento en este momento. Intenta de nuevo en unos minutos.' });
  }
});

module.exports = router;
