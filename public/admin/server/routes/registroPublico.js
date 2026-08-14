const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

const CAMPOS_REQUERIDOS = ['primer_apellido', 'nombres', 'plantel'];

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

function limpiar(valor) {
  if (typeof valor !== 'string') return valor;
  const v = valor.trim();
  return v === '' ? null : v;
}

// Respaldo del lado servidor: por si el formulario se envía sin JavaScript,
// los campos de texto (nombres, domicilio, tutor, etc.) igual quedan en
// mayúsculas y sin acentos, como exige la ficha oficial.
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

// POST /api/fichas - crear un nuevo registro (autoservicio de estudiante o personal)
router.post('/', async (req, res) => {
  const b = req.body || {};

  for (const campo of CAMPOS_REQUERIDOS) {
    if (!limpiar(b[campo])) {
      return res.status(400).json({ error: `El campo "${campo}" es obligatorio.` });
    }
  }

  if (!b.acepto_conformidad) {
    return res.status(400).json({ error: 'Debe aceptar la conformidad para poder enviar la ficha.' });
  }

  if (limpiar(b.programa_educativo) && !PROGRAMAS_VALIDOS.includes(b.programa_educativo)) {
    return res.status(400).json({ error: 'El programa educativo seleccionado no es válido.' });
  }

  if (!PLANTELES_VALIDOS.includes(b.plantel)) {
    return res.status(400).json({ error: 'El plantel seleccionado no es válido.' });
  }

  const edad = b.edad ? Number(b.edad) : calcularEdad(b.fecha_nacimiento);
  const esMenor = edad !== null && edad < 21;

  if (esMenor) {
    if (!limpiar(b.tutor_primer_apellido) || !limpiar(b.tutor_nombres)) {
      return res.status(400).json({
        error: 'Los datos del padre o tutor son obligatorios para estudiantes menores de 21 años.',
      });
    }
  }

  const capturadoPor = b.capturado_por === 'personal' ? 'personal' : 'estudiante';

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

    esMenor ? aMayusculasSinAcentos(b.tutor_primer_apellido) : null,
    esMenor ? aMayusculasSinAcentos(b.tutor_segundo_apellido) : null,
    esMenor ? aMayusculasSinAcentos(b.tutor_nombres) : null,
    esMenor ? aMayusculasSinAcentos(b.tutor_ocupacion) : null,
    esMenor ? limpiar(b.tutor_telefono) : null,

    true,
    b.fecha_firma || new Date().toISOString().slice(0, 10),
    capturadoPor,
  ];

  const sql = `
    INSERT INTO fichas_registro (
      plantel, programa_educativo,
      primer_apellido, segundo_apellido, nombres, curp, fecha_nacimiento, edad,
      institucion_procedencia, promedio_ultimo_grado,
      calle, no_ext, no_int, colonia, cp, localidad, municipio, entidad_federativa,
      tel_casa, tel_celular, correo_electronico,
      tutor_primer_apellido, tutor_segundo_apellido, tutor_nombres, tutor_ocupacion, tutor_telefono,
      acepto_conformidad, fecha_firma, capturado_por
    ) VALUES (
      $1,$2, $3,$4,$5,$6,$7,$8, $9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18, $19,$20,$21,
      $22,$23,$24,$25,$26, $27,$28,$29
    )
    RETURNING id, created_at;
  `;

  try {
    const result = await pool.query(sql, valores);
    return res.status(201).json({ ok: true, id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (err) {
    console.error('Error al guardar la ficha:', err);
    return res.status(500).json({ error: 'No se pudo guardar el registro. Intenta nuevamente.' });
  }
});

module.exports = router;
