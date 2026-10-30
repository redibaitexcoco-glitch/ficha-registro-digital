// Integración con el Expediente Electrónico (Servicios Escolares).
// El estudiante egresado ve y llena su trámite de titulación desde su Expediente; los
// documentos llegan aquí, a la misma carpeta de Drive y al mismo panel de Trámites.
// Solo responde a peticiones que traen la clave compartida (variable INTEGRACION_CLAVE,
// igual en ambas aplicaciones) en el encabezado X-Integracion-Clave.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db/pool');
const { TIPOS } = require('../tramites/config');
const { recibirArchivos, esPdf, limpiar, aMayusculasSinAcentos, recalcularEstado } = require('../tramites/comun');
const { obtenerOCrearCarpetaEstudiante, subirArchivo, nombreSeguro } = require('../services/googleDrive');

const ETIQUETA_TIPO = { licenciatura: 'TitulacionLicenciatura', maestria: 'GradoMaestria', doctorado: 'GradoDoctorado' };
const PLANTEL = 'Red IBAI Texcoco';

function verificarClave(req, res, next) {
  const esperada = process.env.INTEGRACION_CLAVE || '';
  const recibida = String(req.get('x-integracion-clave') || '');
  const ok = esperada.length >= 16 && recibida.length === esperada.length &&
    crypto.timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada));
  if (!ok) return res.status(401).json({ error: 'No autorizado.' });
  next();
}
router.use(verificarClave);

const curpLimpia = (v) => (limpiar(v) || '').toUpperCase().replace(/\s/g, '');

async function tramiteConDocumentos(t) {
  const { rows: docs } = await pool.query(
    'SELECT clave, etiqueta, interno, estado, motivo, version, actualizado_en FROM tramite_documentos WHERE tramite_id = $1 ORDER BY interno, orden', [t.id]);
  const cfg = TIPOS[t.tipo] || { documentos: [], internos: [] };
  const grupoDe = Object.fromEntries(cfg.documentos.map((d) => [d.clave, d.grupo]));
  const opcional = new Set(cfg.documentos.filter((d) => d.opcional).map((d) => d.clave));
  const ayudaDe = Object.fromEntries(cfg.internos.map((d) => [d.clave, d.ayuda]));
  return {
    id: t.id, folio: t.folio, tipo: t.tipo, nombre_tramite: cfg.nombre || t.tipo, estado: t.estado,
    programa: t.programa, periodo_ingreso: t.periodo_ingreso, periodo_egreso: t.periodo_egreso, modalidad_fija: cfg.modalidadFija || null, modalidad: t.modalidad, titulo_trabajo: t.titulo_trabajo,
    tel_celular: t.tel_celular, correo_electronico: t.correo_electronico, observaciones: t.observaciones, creado: t.created_at,
    documentos: docs.map((d) => ({ ...d, grupo: grupoDe[d.clave] || null, ayuda: ayudaDe[d.clave] || null, opcional: opcional.has(d.clave) })),
  };
}

// GET /api/integracion/tramites?curp= — trámite más reciente de esa CURP (o null)
router.get('/tramites', async (req, res) => {
  const curp = curpLimpia(req.query.curp);
  if (!curp) return res.status(400).json({ error: 'Falta la CURP.' });
  try {
    const { rows } = await pool.query('SELECT * FROM tramites WHERE curp = $1 ORDER BY created_at DESC LIMIT 1', [curp]);
    res.json({ tramite: rows[0] ? await tramiteConDocumentos(rows[0]) : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo consultar el trámite.' });
  }
});

// POST /api/integracion/tramites — crea el trámite sin documentos (se suben uno por uno)
router.post('/tramites', async (req, res) => {
  const b = req.body || {};
  const cfg = TIPOS[b.tipo];
  if (!cfg) return res.status(400).json({ error: 'El tipo de trámite no es válido.' });
  const curp = curpLimpia(b.curp);
  const requeridos = { curp: 'CURP', primer_apellido: 'Primer apellido', nombres: 'Nombre(s)', tel_celular: 'Tel. celular', correo_electronico: 'Correo electrónico', programa: 'Programa', periodo_egreso: 'Periodo de egreso' };
  for (const [campo, nombre] of Object.entries(requeridos)) {
    if (!limpiar(b[campo])) return res.status(400).json({ error: `El campo "${nombre}" es obligatorio.` });
  }
  if (cfg.modalidadFija) { b.modalidad = cfg.modalidadFija; b.titulo_trabajo = ''; }
  if (!['con_tesis', 'sin_tesis'].includes(b.modalidad)) return res.status(400).json({ error: 'Selecciona la modalidad.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const anio = new Date().getFullYear();
    await client.query('SELECT pg_advisory_xact_lock(424242, $1)', [anio]);
    const { rows: abierto } = await client.query("SELECT * FROM tramites WHERE curp = $1 AND estado <> 'concluido' ORDER BY created_at DESC LIMIT 1", [curp]);
    if (abierto[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Ya tienes un trámite abierto (${abierto[0].folio}).`, tramite: await tramiteConDocumentos(abierto[0]) });
    }
    const { rows: c } = await client.query('SELECT COALESCE(MAX(consecutivo), 0) + 1 AS n FROM tramites WHERE anio = $1', [anio]);
    const consecutivo = c[0].n;
    const folio = `TRM-${String(consecutivo).padStart(4, '0')}/${anio}`;
    const { rows } = await client.query(
      `INSERT INTO tramites (anio, consecutivo, folio, tipo, plantel, primer_apellido, segundo_apellido, nombres, curp, matricula,
         tel_celular, correo_electronico, programa, periodo_egreso, modalidad, titulo_trabajo, periodo_ingreso)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [anio, consecutivo, folio, b.tipo, PLANTEL, aMayusculasSinAcentos(b.primer_apellido), aMayusculasSinAcentos(b.segundo_apellido),
        aMayusculasSinAcentos(b.nombres), curp, (limpiar(b.matricula) || '').toUpperCase() || null, limpiar(b.tel_celular),
        limpiar(b.correo_electronico), aMayusculasSinAcentos(b.programa), limpiar(b.periodo_egreso), b.modalidad, aMayusculasSinAcentos(b.titulo_trabajo), limpiar(b.periodo_ingreso)]);
    let orden = 0;
    for (const doc of cfg.documentos) {
      await client.query(`INSERT INTO tramite_documentos (tramite_id, clave, etiqueta, interno, orden, estado) VALUES ($1,$2,$3,false,$4,'sin_cargar')`,
        [rows[0].id, doc.clave, doc.etiqueta, orden++]);
    }
    for (const doc of cfg.internos) {
      await client.query(`INSERT INTO tramite_documentos (tramite_id, clave, etiqueta, interno, orden, estado) VALUES ($1,$2,$3,true,$4,'pendiente')`,
        [rows[0].id, doc.clave, doc.etiqueta, orden++]);
    }
    await client.query('COMMIT');
    res.status(201).json({ tramite: await tramiteConDocumentos(rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al registrar el trámite desde el Expediente:', err);
    res.status(500).json({ error: 'No se pudo registrar el trámite. Intenta nuevamente.' });
  } finally {
    client.release();
  }
});

// PATCH /api/integracion/tramites/:id — corrige datos generales (mientras no esté concluido)
router.patch('/tramites/:id(\\d+)', async (req, res) => {
  const b = req.body || {};
  try {
    const { rows } = await pool.query('SELECT * FROM tramites WHERE id = $1 AND curp = $2', [req.params.id, curpLimpia(b.curp)]);
    const t = rows[0];
    if (!t) return res.status(404).json({ error: 'Trámite no encontrado.' });
    if (t.estado === 'concluido') return res.status(409).json({ error: 'El trámite ya está concluido.' });
    const cfgT = TIPOS[t.tipo] || {};
    if (cfgT.modalidadFija) { b.modalidad = cfgT.modalidadFija; b.titulo_trabajo = null; }
    if (b.modalidad && !['con_tesis', 'sin_tesis'].includes(b.modalidad)) return res.status(400).json({ error: 'Modalidad no válida.' });
    const { rows: act } = await pool.query(
      `UPDATE tramites SET tel_celular = COALESCE($1, tel_celular), correo_electronico = COALESCE($2, correo_electronico),
         periodo_egreso = COALESCE($3, periodo_egreso), modalidad = COALESCE($4, modalidad), titulo_trabajo = COALESCE($5, titulo_trabajo),
         actualizado_en = now() WHERE id = $6 RETURNING *`,
      [limpiar(b.tel_celular), limpiar(b.correo_electronico), limpiar(b.periodo_egreso), b.modalidad || null, aMayusculasSinAcentos(b.titulo_trabajo), t.id]);
    res.json({ tramite: await tramiteConDocumentos(act[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron guardar los datos.' });
  }
});

// POST /api/integracion/tramites/:id/documentos/:clave — sube (o reemplaza) un documento.
// Se permite si está sin cargar, en revisión o marcado como "No cumple"; no si ya se verificó.
router.post('/tramites/:id(\\d+)/documentos/:clave', recibirArchivos, async (req, res) => {
  const archivo = (req.files || [])[0];
  if (!archivo) return res.status(400).json({ error: 'No se recibió el documento.' });
  if (!esPdf(archivo)) return res.status(400).json({ error: 'El documento debe ser un PDF escaneado. No se aceptan fotografías.' });
  try {
    const { rows } = await pool.query('SELECT * FROM tramites WHERE id = $1 AND curp = $2', [req.params.id, curpLimpia(req.body.curp)]);
    const t = rows[0];
    if (!t) return res.status(404).json({ error: 'Trámite no encontrado.' });
    if (t.estado === 'concluido') return res.status(409).json({ error: 'El trámite ya está concluido.' });
    const { rows: d } = await pool.query(
      'SELECT id, version, estado FROM tramite_documentos WHERE tramite_id = $1 AND clave = $2 AND interno = false', [t.id, req.params.clave]);
    const doc = d[0];
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
    if (doc.estado === 'verificado') return res.status(409).json({ error: 'Este documento ya fue verificado; no es necesario volver a subirlo.' });
    let carpetaId = t.drive_folder_id;
    if (!carpetaId) {
      carpetaId = await obtenerOCrearCarpetaEstudiante({ curp: t.curp, primerApellido: t.primer_apellido, segundoApellido: t.segundo_apellido, nombres: t.nombres });
      await pool.query('UPDATE tramites SET drive_folder_id = $1 WHERE id = $2', [carpetaId, t.id]);
    }
    const version = doc.estado === 'sin_cargar' ? 1 : doc.version + 1;
    const nombreArchivo = `${nombreSeguro(t.curp)}_${ETIQUETA_TIPO[t.tipo]}_${req.params.clave}${version > 1 ? `_v${version}` : ''}.pdf`;
    const subido = await subirArchivo({ buffer: archivo.buffer, nombreArchivo, mimeType: 'application/pdf', carpetaId });
    await pool.query(
      `UPDATE tramite_documentos SET drive_file_id = $1, nombre_archivo = $2, version = $3, estado = 'en_revision', motivo = NULL,
         revisado_por = NULL, revisado_en = NULL, actualizado_en = now() WHERE id = $4`,
      [subido.fileId, nombreArchivo, version, doc.id]);
    await recalcularEstado(pool, t.id);
    const { rows: act } = await pool.query('SELECT * FROM tramites WHERE id = $1', [t.id]);
    res.json({ tramite: await tramiteConDocumentos(act[0]) });
  } catch (err) {
    console.error('Error al subir documento desde el Expediente:', err.message);
    res.status(503).json({ error: 'No se pudo guardar el documento en este momento. Intenta de nuevo en unos minutos.' });
  }
});

// ===== Documentos de inscripción (Expediente Electrónico de Servicios Escolares) =====
// Servicios Escolares lleva el control de qué documentos faltan y su revisión; aquí solo
// se guardan los archivos en la carpeta de Drive del estudiante (la misma de su ficha).

// GET /api/integracion/ficha-documentos?curp=&matricula= — documentos que el estudiante ya
// entregó con su ficha de registro (la más reciente que coincida por CURP o matrícula).
router.get('/ficha-documentos', async (req, res) => {
  const curp = curpLimpia(req.query.curp);
  const matricula = (limpiar(req.query.matricula) || '').toUpperCase();
  if (!curp && !matricula) return res.status(400).json({ error: 'Falta la CURP o la matrícula.' });
  try {
    const { rows } = await pool.query(
      `SELECT drive_folder_id, doc_acta_nacimiento_id, doc_curp_id, doc_ine_id, doc_certificado_id, doc_titulo_id, doc_cedula_id, doc_fotografia_id
       FROM fichas_registro WHERE ($1 <> '' AND upper(curp) = $1) OR ($2 <> '' AND upper(matricula_asignada) = $2)
       ORDER BY (drive_folder_id IS NOT NULL) DESC, created_at DESC LIMIT 1`, [curp, matricula]);
    const f = rows[0];
    if (!f) return res.json({ ficha: null });
    res.json({ ficha: { carpeta_id: f.drive_folder_id, documentos: {
      acta: f.doc_acta_nacimiento_id, curp: f.doc_curp_id, ine: f.doc_ine_id, certificado: f.doc_certificado_id,
      titulo: f.doc_titulo_id, cedula: f.doc_cedula_id, foto: f.doc_fotografia_id } } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo consultar la ficha.' });
  }
});

// POST /api/integracion/archivos — guarda un archivo en la carpeta de Drive del estudiante.
// Campos: archivo, nombre_archivo, carpeta_id (opcional), curp, matricula, primer_apellido, segundo_apellido, nombres
const TIPOS_ARCHIVO = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
function tipoReal(archivo) {
  const b = archivo && archivo.buffer;
  if (!b || b.length < 8) return null;
  if (b.slice(0, 5).toString('latin1').startsWith('%PDF')) return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}
router.post('/archivos', recibirArchivos, async (req, res) => {
  const archivo = (req.files || [])[0];
  if (!archivo) return res.status(400).json({ error: 'No se recibió el archivo.' });
  const tipo = tipoReal(archivo);
  if (!tipo) return res.status(400).json({ error: 'El archivo debe ser PDF, JPG o PNG.' });
  const b = req.body || {};
  try {
    let carpetaId = limpiar(b.carpeta_id);
    if (!carpetaId) {
      const curp = curpLimpia(b.curp);
      if (curp) {
        const { rows } = await pool.query('SELECT drive_folder_id FROM fichas_registro WHERE upper(curp) = $1 AND drive_folder_id IS NOT NULL ORDER BY created_at DESC LIMIT 1', [curp]);
        if (rows[0]) carpetaId = rows[0].drive_folder_id;
      }
    }
    if (!carpetaId) {
      carpetaId = await obtenerOCrearCarpetaEstudiante({
        curp: curpLimpia(b.curp) || (limpiar(b.matricula) || '').toUpperCase(),
        primerApellido: aMayusculasSinAcentos(b.primer_apellido), segundoApellido: aMayusculasSinAcentos(b.segundo_apellido), nombres: aMayusculasSinAcentos(b.nombres),
      });
    }
    const base = nombreSeguro(limpiar(b.nombre_archivo) || 'Documento').replace(/\s+/g, '_') || 'Documento';
    const subido = await subirArchivo({ buffer: archivo.buffer, nombreArchivo: `${base}.${TIPOS_ARCHIVO[tipo]}`, mimeType: tipo, carpetaId });
    res.status(201).json({ file_id: subido.fileId, carpeta_id: carpetaId, nombre_archivo: `${base}.${TIPOS_ARCHIVO[tipo]}`, tipo });
  } catch (err) {
    console.error('Error al guardar archivo desde Servicios Escolares:', err.message);
    res.status(503).json({ error: 'No se pudo guardar el documento en este momento. Intenta de nuevo en unos minutos.' });
  }
});

module.exports = router;
