const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

const PROGRAMAS_VALIDOS = [
  'Licenciatura en Pedagogía (No escolarizado)',
  'Licenciatura en Psicología (No escolarizado)',
  'Maestría en Educación (No escolarizado)',
  'Doctorado en Educación (No escolarizado)',
];

const PLANTELES_VALIDOS = [
  'Cacahoatán',
  'Comitán',
  'Mazatán',
  'Motozintla',
  'Pijijiapan',
  'Tapachula [Ciencias de la Educación]',
  'Tapachula [Sede]',
];

const SITUACIONES_VALIDAS = ['Inscrito', 'Baja', 'Baja temporal'];

function limpiar(valor) {
  if (typeof valor !== 'string') return valor;
  const v = valor.trim();
  return v === '' ? null : v;
}

// Misma normalización que usa el formulario público: mayúsculas sin acentos.
function aMayusculasSinAcentos(valor) {
  const limpio = limpiar(valor);
  if (!limpio) return limpio;
  return limpio
    .replace(/[ñÑ]/g, '\u0001')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\u0001/g, 'Ñ');
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  if (isNaN(nacimiento.getTime())) return null;
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

// Construye el WHERE compartido por el listado y la exportación,
// a partir de los mismos filtros que usa el panel (búsqueda, fechas, programa, plantel, revisado).
function construirFiltro(query) {
  const { q, desde, hasta, revisado, programa, plantel, situacion } = query;
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
  if (situacion) {
    valores.push(situacion);
    condiciones.push(`situacion = $${valores.length}`);
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

// PATCH /api/fichas/:id - editar los datos capturados (corrige errores antes o al momento de revisar)
router.patch('/:id', async (req, res) => {
  const b = req.body || {};

  if (b.programa_educativo && !PROGRAMAS_VALIDOS.includes(b.programa_educativo)) {
    return res.status(400).json({ error: 'El programa educativo seleccionado no es válido.' });
  }
  if (b.plantel && !PLANTELES_VALIDOS.includes(b.plantel)) {
    return res.status(400).json({ error: 'El plantel seleccionado no es válido.' });
  }
  if (!limpiar(b.primer_apellido) || !limpiar(b.nombres)) {
    return res.status(400).json({ error: 'Primer apellido y nombre(s) son obligatorios.' });
  }

  const edad = b.edad ? Number(b.edad) : calcularEdad(b.fecha_nacimiento);

  const sql = `
    UPDATE fichas_registro SET
      plantel = $1, programa_educativo = $2,
      primer_apellido = $3, segundo_apellido = $4, nombres = $5, curp = $6,
      fecha_nacimiento = $7, edad = $8, institucion_procedencia = $9, promedio_ultimo_grado = $10,
      calle = $11, no_ext = $12, no_int = $13, colonia = $14, cp = $15, localidad = $16,
      municipio = $17, entidad_federativa = $18, tel_casa = $19, tel_celular = $20, correo_electronico = $21,
      tutor_primer_apellido = $22, tutor_segundo_apellido = $23, tutor_nombres = $24,
      tutor_ocupacion = $25, tutor_telefono = $26
    WHERE id = $27
    RETURNING id;
  `;

  const valores = [
    limpiar(b.plantel),
    limpiar(b.programa_educativo),
    aMayusculasSinAcentos(b.primer_apellido),
    aMayusculasSinAcentos(b.segundo_apellido),
    aMayusculasSinAcentos(b.nombres),
    limpiar(b.curp) ? b.curp.trim().toUpperCase() : null,
    b.fecha_nacimiento || null,
    edad,
    aMayusculasSinAcentos(b.institucion_procedencia),
    b.promedio_ultimo_grado ? Number(b.promedio_ultimo_grado) : null,
    aMayusculasSinAcentos(b.calle),
    aMayusculasSinAcentos(b.no_ext),
    aMayusculasSinAcentos(b.no_int),
    aMayusculasSinAcentos(b.colonia),
    limpiar(b.cp),
    aMayusculasSinAcentos(b.localidad),
    aMayusculasSinAcentos(b.municipio),
    aMayusculasSinAcentos(b.entidad_federativa),
    limpiar(b.tel_casa),
    limpiar(b.tel_celular),
    limpiar(b.correo_electronico),
    aMayusculasSinAcentos(b.tutor_primer_apellido),
    aMayusculasSinAcentos(b.tutor_segundo_apellido),
    aMayusculasSinAcentos(b.tutor_nombres),
    aMayusculasSinAcentos(b.tutor_ocupacion),
    limpiar(b.tutor_telefono),
    req.params.id,
  ];

  try {
    const result = await pool.query(sql, valores);
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error al editar ficha:', err);
    return res.status(500).json({ error: 'No se pudo guardar la corrección.' });
  }
});

// PATCH /api/fichas/:id/situacion - registrar Inscrito/Baja/Baja temporal (antes de marcar revisado)
router.patch('/:id/situacion', async (req, res) => {
  const { situacion } = req.body || {};
  if (!SITUACIONES_VALIDAS.includes(situacion)) {
    return res.status(400).json({ error: 'La situación indicada no es válida.' });
  }
  try {
    const result = await pool.query(
      'UPDATE fichas_registro SET situacion = $1 WHERE id = $2 RETURNING id',
      [situacion, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error al actualizar situación:', err);
    return res.status(500).json({ error: 'No se pudo actualizar la situación.' });
  }
});

// DELETE /api/fichas/:id - eliminar un registro capturado
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM fichas_registro WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar ficha:', err);
    return res.status(500).json({ error: 'No se pudo eliminar el registro.' });
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
