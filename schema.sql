-- Esquema de base de datos para la app "Ficha de Registro Digital"
-- IES Red IBAI Connect - Servicios Escolares

CREATE TABLE IF NOT EXISTS fichas_registro (
    id                      SERIAL PRIMARY KEY,

    -- Plantel y programa
    plantel                 VARCHAR(100),
    programa_educativo      VARCHAR(150),

    -- I. Datos de identificación del alumno
    primer_apellido         VARCHAR(100) NOT NULL,
    segundo_apellido        VARCHAR(100),
    nombres                 VARCHAR(150) NOT NULL,
    curp                    VARCHAR(18),
    fecha_nacimiento        DATE,
    edad                    SMALLINT,
    institucion_procedencia VARCHAR(200),
    promedio_ultimo_grado   NUMERIC(4,2),

    -- II. Datos de domicilio del alumno
    calle                   VARCHAR(150),
    no_ext                  VARCHAR(20),
    no_int                  VARCHAR(20),
    colonia                 VARCHAR(150),
    cp                      VARCHAR(10),
    localidad               VARCHAR(150),
    municipio               VARCHAR(150),
    entidad_federativa      VARCHAR(100),
    tel_casa                VARCHAR(20),
    tel_celular             VARCHAR(20),
    correo_electronico      VARCHAR(150),

    -- III. Datos del padre o tutor (exclusivo para menores de 21 años)
    tutor_primer_apellido   VARCHAR(100),
    tutor_segundo_apellido  VARCHAR(100),
    tutor_nombres           VARCHAR(150),
    tutor_ocupacion         VARCHAR(150),
    tutor_telefono          VARCHAR(20),

    -- Conformidad y control
    acepto_conformidad      BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_firma             DATE,
    capturado_por           VARCHAR(20) NOT NULL DEFAULT 'estudiante', -- 'estudiante' | 'personal'
    situacion                VARCHAR(50) NOT NULL DEFAULT 'Inscrito', -- 'Inscrito' | 'Baja' | 'Baja temporal' | 'Concluido [Programa Académico]' | 'En Proceso [Título o Grado]' | 'Entregado [Título o Grado]'
    revisado                BOOLEAN NOT NULL DEFAULT FALSE,
    revisado_por            VARCHAR(150),
    revisado_en             TIMESTAMPTZ,

    -- Documentos (Google Drive): cada columna guarda el file id de Drive si ya se subió, o NULL si falta
    drive_folder_id           VARCHAR(100),
    doc_acta_nacimiento_id    VARCHAR(100),
    doc_curp_id               VARCHAR(100),
    doc_ine_id                VARCHAR(100),
    doc_certificado_id        VARCHAR(100),
    doc_titulo_id              VARCHAR(100),
    doc_cedula_id              VARCHAR(100),
    doc_fotografia_id         VARCHAR(100),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migración para una base de datos ya existente (agrega columnas nuevas sin perder datos).
-- Debe ir ANTES de los índices, para que las columnas ya existan cuando se indexan.
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS situacion VARCHAR(50) NOT NULL DEFAULT 'Inscrito';
ALTER TABLE fichas_registro ALTER COLUMN situacion TYPE VARCHAR(50);
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(100);
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS doc_acta_nacimiento_id VARCHAR(100);
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS doc_curp_id VARCHAR(100);
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS doc_ine_id VARCHAR(100);
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS doc_certificado_id VARCHAR(100);
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS doc_titulo_id VARCHAR(100);
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS doc_cedula_id VARCHAR(100);
ALTER TABLE fichas_registro DROP COLUMN IF EXISTS doc_ultimo_grado_id;
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS doc_fotografia_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_fichas_curp ON fichas_registro (curp);
CREATE INDEX IF NOT EXISTS idx_fichas_created_at ON fichas_registro (created_at);
CREATE INDEX IF NOT EXISTS idx_fichas_programa ON fichas_registro (programa_educativo);
CREATE INDEX IF NOT EXISTS idx_fichas_plantel ON fichas_registro (plantel);
CREATE INDEX IF NOT EXISTS idx_fichas_situacion ON fichas_registro (situacion);

-- Si la tabla ya existía de una versión anterior, ajusta las columnas así:
-- ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS plantel VARCHAR(100);
-- ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS institucion_procedencia VARCHAR(200);
-- ALTER TABLE fichas_registro DROP COLUMN IF EXISTS promocion;
-- ALTER TABLE fichas_registro DROP COLUMN IF EXISTS matricula;
-- ALTER TABLE fichas_registro DROP COLUMN IF EXISTS periodo_por_cursar;
-- ALTER TABLE fichas_registro DROP COLUMN IF EXISTS identificacion_oficial;

-- Matriculación: guarda la matrícula asignada en Servicios Escolares (si ya se matriculó).
ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS matricula_asignada VARCHAR(20);

-- ==========================================================
-- Trámites del Departamento de Titulación y Posgrados
-- (Titulación Licenciatura, Grado Maestría, Grado Doctorado)
-- ==========================================================
CREATE TABLE IF NOT EXISTS tramites (
    id                 SERIAL PRIMARY KEY,
    anio               SMALLINT NOT NULL,
    consecutivo        INTEGER NOT NULL,
    folio              VARCHAR(20) NOT NULL UNIQUE,      -- TRM-0001/2026
    tipo               VARCHAR(20) NOT NULL,             -- licenciatura | maestria | doctorado
    estado             VARCHAR(30) NOT NULL DEFAULT 'en_revision', -- en_revision | con_observaciones | expediente_completo | concluido
    plantel            VARCHAR(100),
    primer_apellido    VARCHAR(100) NOT NULL,
    segundo_apellido   VARCHAR(100),
    nombres            VARCHAR(150) NOT NULL,
    curp               VARCHAR(18) NOT NULL,
    matricula          VARCHAR(20),
    tel_celular        VARCHAR(20),
    correo_electronico VARCHAR(150),
    programa           VARCHAR(200),
    periodo_egreso     VARCHAR(30),
    modalidad          VARCHAR(20),                      -- con_tesis | sin_tesis
    titulo_trabajo     TEXT,
    drive_folder_id    VARCHAR(100),
    observaciones      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (anio, consecutivo)
);
CREATE INDEX IF NOT EXISTS idx_tramites_curp ON tramites (curp);
CREATE INDEX IF NOT EXISTS idx_tramites_estado ON tramites (estado);

CREATE TABLE IF NOT EXISTS tramite_documentos (
    id             SERIAL PRIMARY KEY,
    tramite_id     INTEGER NOT NULL REFERENCES tramites(id) ON DELETE CASCADE,
    clave          VARCHAR(40) NOT NULL,
    etiqueta       VARCHAR(200) NOT NULL,
    interno        BOOLEAN NOT NULL DEFAULT FALSE,   -- true = lo gestiona Servicios Escolares
    orden          SMALLINT NOT NULL DEFAULT 0,
    estado         VARCHAR(20) NOT NULL,             -- estudiante: en_revision|verificado|no_cumple · interno: pendiente|en_proceso|listo
    motivo         TEXT,                             -- por qué no cumple
    drive_file_id  VARCHAR(100),
    nombre_archivo VARCHAR(250),
    version        SMALLINT NOT NULL DEFAULT 1,
    revisado_por   VARCHAR(150),
    revisado_en    TIMESTAMPTZ,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tramite_id, clave)
);
