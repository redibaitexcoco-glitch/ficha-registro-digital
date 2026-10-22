// Configuración de los trámites del Departamento de Titulación y Posgrados.
// Es la única fuente de verdad: el formulario público la pide al servidor
// (GET /api/tramites/config/:tipo), así que para agregar o renombrar un
// documento basta con cambiarlo aquí.

const IDENTIFICACION = [
  { clave: 'acta_nacimiento', etiqueta: 'Acta de nacimiento', grupo: 'Identificación (por separado)' },
  { clave: 'curp', etiqueta: 'CURP', grupo: 'Identificación (por separado)' },
];

const TIPOS = {
  licenciatura: {
    nombre: 'Titulación Licenciatura',
    nivel: 'Licenciatura',
    programaSugerido: '',
    documentos: [
      ...IDENTIFICACION,
      { clave: 'cert_bachillerato', etiqueta: 'Certificado de estudios de bachillerato', grupo: 'Antecedentes académicos' },
      { clave: 'comprobante_pago', etiqueta: 'Comprobante de pago de derechos de titulación', grupo: 'Obtención del título', opcional: true, ayuda: 'Opcional: puedes enviarlo después' },
    ],
    internos: [
      { clave: 'tesis', etiqueta: 'Tesis o documento de Titulación sin Tesis', ayuda: 'Se integra desde el registro de tu modalidad de titulación' },
      { clave: 'no_adeudo', etiqueta: 'Constancia de no adeudo', ayuda: 'Se verifica con tu estado de cuenta' },
    ],
  },
  maestria: {
    nombre: 'Grado Maestría',
    nivel: 'Maestría',
    programaSugerido: 'Maestría en Educación',
    modalidadFija: 'sin_tesis', // Maestría y Doctorado se obtienen sin tesis
    programas: ['Maestría en Educación'],
    documentos: [
      ...IDENTIFICACION,
      { clave: 'cert_licenciatura', etiqueta: 'Certificado de estudios de licenciatura', grupo: 'Antecedentes académicos' },
      { clave: 'titulo_licenciatura', etiqueta: 'Título de licenciatura', grupo: 'Antecedentes académicos' },
      { clave: 'cedula_licenciatura', etiqueta: 'Cédula profesional de licenciatura', grupo: 'Antecedentes académicos' },
      { clave: 'comprobante_pago', etiqueta: 'Comprobante de pago de derechos de grado', grupo: 'Obtención del grado', opcional: true, ayuda: 'Opcional: puedes enviarlo después' },
    ],
    internos: [
      { clave: 'tesis', etiqueta: 'Tesis o documento de Grado sin Tesis', ayuda: 'Se integra desde el registro de tu modalidad de grado' },
      { clave: 'no_adeudo', etiqueta: 'Constancia de no adeudo', ayuda: 'Se verifica con tu estado de cuenta' },
    ],
  },
  doctorado: {
    nombre: 'Grado Doctorado',
    nivel: 'Doctorado',
    programaSugerido: 'Doctorado en Educación',
    modalidadFija: 'sin_tesis',
    programas: ['Doctorado en Educación'],
    documentos: [
      ...IDENTIFICACION,
      { clave: 'cert_maestria', etiqueta: 'Certificado de estudios de maestría', grupo: 'Antecedentes académicos' },
      { clave: 'grado_maestria', etiqueta: 'Grado de maestría', grupo: 'Antecedentes académicos' },
      { clave: 'cedula_maestria', etiqueta: 'Cédula de maestría', grupo: 'Antecedentes académicos' },
      { clave: 'comprobante_pago', etiqueta: 'Comprobante de pago de derechos de grado', grupo: 'Obtención del grado', opcional: true, ayuda: 'Opcional: puedes enviarlo después' },
    ],
    internos: [
      { clave: 'tesis', etiqueta: 'Tesis o documento de Grado sin Tesis', ayuda: 'Se integra desde el registro de tu modalidad de grado' },
      { clave: 'no_adeudo', etiqueta: 'Constancia de no adeudo', ayuda: 'Se verifica con tu estado de cuenta' },
    ],
  },
};

// Estados de cada documento
// - Los que sube el estudiante: en_revision -> verificado | no_cumple (y vuelve a en_revision al resubirlo)
// - Los que gestiona Servicios Escolares: pendiente -> en_proceso -> listo
const ESTADOS_ESTUDIANTE = ['en_revision', 'verificado', 'no_cumple'];
const ESTADOS_INTERNO = ['pendiente', 'en_proceso', 'listo'];

module.exports = { TIPOS, ESTADOS_ESTUDIANTE, ESTADOS_INTERNO };
