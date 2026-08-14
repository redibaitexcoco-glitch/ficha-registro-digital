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
    revisado                BOOLEAN NOT NULL DEFAULT FALSE,
    revisado_por            VARCHAR(150),
    revisado_en             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fichas_curp ON fichas_registro (curp);
CREATE INDEX IF NOT EXISTS idx_fichas_created_at ON fichas_registro (created_at);
CREATE INDEX IF NOT EXISTS idx_fichas_programa ON fichas_registro (programa_educativo);
CREATE INDEX IF NOT EXISTS idx_fichas_plantel ON fichas_registro (plantel);

-- Si la tabla ya existía de una versión anterior, ajusta las columnas así:
-- ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS plantel VARCHAR(100);
-- ALTER TABLE fichas_registro ADD COLUMN IF NOT EXISTS institucion_procedencia VARCHAR(200);
-- ALTER TABLE fichas_registro DROP COLUMN IF EXISTS promocion;
-- ALTER TABLE fichas_registro DROP COLUMN IF EXISTS matricula;
-- ALTER TABLE fichas_registro DROP COLUMN IF EXISTS periodo_por_cursar;
-- ALTER TABLE fichas_registro DROP COLUMN IF EXISTS identificacion_oficial;
