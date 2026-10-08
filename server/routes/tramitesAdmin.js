// Trámites de Titulación y Posgrados — rutas administrativas (protegidas con la
// misma autenticación del panel). Montadas en /api/fichas/tramites para que el
// portal SIASE las reenvíe igual que el resto de la API de fichas.
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { TIPOS, ESTADOS_ESTUDIANTE, ESTADOS_INTERNO } = require('../tramites/config');
const { limpiar, recalcularEstado } = require('../tramites/comun');

const ESTADOS_TRAMITE = ['en_revision', 'con_observaciones', 'expediente_completo', 'concluido'];

// GET /api/fichas/tramites?tipo=&estado=&q=
router.get('/', async (req, res) => {
  const cond = [];
  const vals = [];
  if (TIPOS[req.query.tipo]) { vals.push(req.query.tipo); cond.push(`t.tipo = $${vals.length}`); }
  if (ESTADOS_TRAMITE.includes(req.query.estado)) { vals.push(req.query.estado); cond.push(`t.estado = $${vals.length}`); }
  const q = limpiar(req.query.q);
  if (q) {
    vals.push(`%${q.toUpperCase()}%`);
    cond.push(`(t.folio ILIKE $${vals.length} OR t.curp ILIKE $${vals.length} OR t.matricula ILIKE $${vals.length}
      OR (t.primer_apellido || ' ' || COALESCE(t.segundo_apellido, '') || ' ' || t.nombres) ILIKE $${vals.length})`);
  }
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.folio, t.tipo, t.estado, t.plantel, t.primer_apellido, t.segundo_apellido, t.nombres, t.curp, t.matricula, t.created_at,
         COUNT(*) FILTER (WHERE NOT d.interno AND d.estado = 'en_revision')::int AS por_revisar,
         COUNT(*) FILTER (WHERE NOT d.interno AND d.estado = 'no_cumple')::int AS no_cumplen,
         COUNT(*) FILTER (WHERE d.interno AND d.estado <> 'listo')::int AS internos_pendientes
       FROM tramites t LEFT JOIN tramite_documentos d ON d.tramite_id = t.id
       ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
       GROUP BY t.id ORDER BY t.created_at DESC LIMIT 500`, vals);
    res.json(rows.map((r) => ({ ...r, nombre_tramite: TIPOS[r.tipo] ? TIPOS[r.tipo].nombre : r.tipo })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron consultar los trámites.' });
  }
});

// GET /api/fichas/tramites/:id — detalle con documentos y enlaces a Drive
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tramites WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Trámite no encontrado.' });
    const { rows: docs } = await pool.query('SELECT * FROM tramite_documentos WHERE tramite_id = $1 ORDER BY interno, orden', [req.params.id]);
    const t = rows[0];
    res.json({
      ...t, nombre_tramite: TIPOS[t.tipo] ? TIPOS[t.tipo].nombre : t.tipo,
      documentos: docs.map((d) => ({ ...d, url: d.drive_file_id ? `https://drive.google.com/file/d/${d.drive_file_id}/view` : null })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo consultar el trámite.' });
  }
});

// PATCH /api/fichas/tramites/:id/documentos/:docId — { estado, motivo }
router.patch('/:id(\\d+)/documentos/:docId(\\d+)', async (req, res) => {
  const { estado } = req.body || {};
  const motivo = limpiar(req.body && req.body.motivo);
  try {
    const { rows } = await pool.query('SELECT id, interno FROM tramite_documentos WHERE id = $1 AND tramite_id = $2', [req.params.docId, req.params.id]);
    const doc = rows[0];
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
    const validos = doc.interno ? ESTADOS_INTERNO : ESTADOS_ESTUDIANTE;
    if (!validos.includes(estado)) return res.status(400).json({ error: 'Estado no válido.' });
    if (estado === 'no_cumple' && !motivo) return res.status(400).json({ error: 'Indica el motivo para que el estudiante sepa qué corregir.' });
    await pool.query(
      `UPDATE tramite_documentos SET estado = $1, motivo = $2, revisado_por = $3, revisado_en = now(), actualizado_en = now() WHERE id = $4`,
      [estado, estado === 'no_cumple' ? motivo : null, (req.auth && req.auth.user) || null, doc.id]);
    const estadoTramite = await recalcularEstado(pool, req.params.id);
    res.json({ ok: true, estado_tramite: estadoTramite });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo actualizar el documento.' });
  }
});

// PATCH /api/fichas/tramites/:id — { concluido: true|false, observaciones }
router.patch('/:id(\\d+)', async (req, res) => {
  const b = req.body || {};
  try {
    if (typeof b.observaciones === 'string') {
      await pool.query('UPDATE tramites SET observaciones = $1, actualizado_en = now() WHERE id = $2', [limpiar(b.observaciones), req.params.id]);
    }
    if (b.concluido === true) {
      const { rows } = await pool.query('SELECT estado FROM tramites WHERE id = $1', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Trámite no encontrado.' });
      if (rows[0].estado !== 'expediente_completo') return res.status(409).json({ error: 'Solo se puede concluir un trámite con el expediente completo.' });
      await pool.query(`UPDATE tramites SET estado = 'concluido', actualizado_en = now() WHERE id = $1`, [req.params.id]);
    } else if (b.concluido === false) {
      await pool.query(`UPDATE tramites SET estado = 'en_revision' WHERE id = $1`, [req.params.id]);
      await recalcularEstado(pool, req.params.id);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo actualizar el trámite.' });
  }
});

// DELETE /api/fichas/tramites/:id — elimina el registro (los PDF permanecen en Drive)
router.delete('/:id(\\d+)', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tramites WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Trámite no encontrado.' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo eliminar el trámite.' });
  }
});

module.exports = router;
