const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

function limpiar(valor) {
  if (typeof valor !== 'string') return valor;
  const v = valor.trim();
  return v === '' ? null : v;
}

// Construye el WHERE compartido por el listado y la exportación,
// a partir de los mismos filtros que usa el panel (búsqueda, fechas, programa, plantel, revisado).
function construirFiltro(query) {
  const { q, desde, hasta, revisado, programa, plantel } = query;
  const condiciones = [];
  const valores = [];

  if (q) {
    valores.push(`%${q}%`);
    condiciones.push(`(curp ILIKE $${valores.length}
      OR primer_apellido ILIKE $${valores.length} OR segundo_apellido ILIKE $${valores.length}
      OR nombres ILIKE $${valores.length})`);
  }
  if (desde) {
    valores.push(desde);
    condiciones.push(`created_at >= $${valores.length}`);
  }
  if (hasta) {
    valores.push(hasta);
    condiciones.push(`created_at <= $${valores.length}::date + interval '1 day'`);
  }
  if (revisado === 'true' || revisado === 'false') {
    valores.push(revisado === 'true');
    condiciones.push(`revisado = $${valores.length}`);
  }
  if (programa) {
    valores.push(programa);
    condiciones.push(`programa_educativo = $${valores.length}`);
  }
  if (plantel) {
    valores.push(plantel);
    condiciones.push(`plantel = $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  return { where, valores };
}

// GET /api/fichas - listado para el panel administrativo
router.get('/', async (req, res) => {
  const { where, valores } = construirFiltro(req.query);
  const sql = `SELECT * FROM fichas_registro ${where} ORDER BY created_at DESC LIMIT 500;`;

  try {
    const result = await pool.query(sql, valores);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al consultar fichas:', err);
    return res.status(500).json({ error: 'No se pudo consultar el listado.' });
  }
});

function celdaCSV(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function filasACSV(filas) {
  if (!filas.length) return '';
  const columnas = Object.keys(filas[0]);
  const lineas = [columnas.join(',')];
  for (const fila of filas) {
    lineas.push(columnas.map((c) => celdaCSV(fila[c])).join(','));
  }
  return lineas.join('\n');
}

// GET /api/fichas/exportar/csv - descarga de la base de datos (respeta los filtros activos)
// Autorizado solo para quien tenga las credenciales del panel administrativo (personal de atención).
router.get('/exportar/csv', async (req, res) => {
  const { where, valores } = construirFiltro(req.query);
  const sql = `SELECT * FROM fichas_registro ${where} ORDER BY created_at DESC;`;

  try {
    const result = await pool.query(sql, valores);
    const csv = '\uFEFF' + filasACSV(result.rows); // BOM para que Excel detecte UTF-8
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fichas_registro_${fecha}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error('Error al exportar CSV:', err);
    return res.status(500).json({ error: 'No se pudo generar el archivo de descarga.' });
  }
});

// GET /api/fichas/:id - detalle de una ficha
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fichas_registro WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener ficha:', err);
    return res.status(500).json({ error: 'No se pudo obtener el registro.' });
  }
});

// PATCH /api/fichas/:id/revisar - marcar como revisada por Servicios Escolares
router.patch('/:id/revisar', async (req, res) => {
  const { revisado_por } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE fichas_registro SET revisado = TRUE, revisado_por = $1, revisado_en = now()
       WHERE id = $2 RETURNING id`,
      [limpiar(revisado_por), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error al marcar como revisado:', err);
    return res.status(500).json({ error: 'No se pudo actualizar el registro.' });
  }
});

module.exports = router;
