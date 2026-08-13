# Ficha de Registro Digital — IES Red IBAI Texcoco

App independiente (Node.js + Express + PostgreSQL) que digitaliza la "Ficha de
Registro" en papel. Puede llenarla de forma autónoma el estudiante o el
personal de atención; los datos se guardan directamente en la base de datos.

## Estructura

```
ficha-registro-digital/
  server/
    index.js              servidor Express
    db/pool.js             conexión a PostgreSQL
    db/initdb.js            aplica schema.sql
    routes/registroPublico.js   POST /api/fichas (sin autenticación)
    routes/registroAdmin.js     GET/PATCH /api/fichas (con autenticación básica)
  public/
    index.html / css / js       formulario público
    admin/index.html            panel administrativo (listado, búsqueda, marcar revisado)
  schema.sql               esquema de la tabla fichas_registro
  .env.example
```

## Puesta en marcha local

```bash
npm install
cp .env.example .env      # y edita DATABASE_URL, ADMIN_USER, ADMIN_PASSWORD
npm run initdb             # crea la tabla fichas_registro
npm start                  # http://localhost:3000
```

- Formulario público: `http://localhost:3000/`
- Panel administrativo: `http://localhost:3000/admin` (pide usuario/contraseña)

## Despliegue en Render (mismo patrón que Control Escolar / Servicios Escolares)

1. Sube este proyecto a un repositorio de GitHub (puede ser privado).
2. En Render: **New > Web Service**, conecta el repositorio.
   - Build command: `npm install`
   - Start command: `npm start`
3. Crea una base de datos PostgreSQL (Render Postgres o Supabase) y copia su
   `DATABASE_URL` a las variables de entorno del servicio en Render.
4. Define también `ADMIN_USER` y `ADMIN_PASSWORD` en las variables de entorno
   de Render (no dejes la contraseña por defecto).
5. Una sola vez, ejecuta la inicialización de la base de datos. Opciones:
   - Desde el Shell de Render del servicio: `npm run initdb`
   - O ejecuta `schema.sql` manualmente contra tu base de datos (psql, panel
     de Supabase, etc.)
6. (Opcional) Asigna un subdominio propio, por ejemplo
   `registro.redibaitexcoco.org`, igual que se hizo con
   `servicios-escolares.redibaitexcoco.org`.

## Notas

- El campo **III. Datos del padre o tutor** se exige solo cuando la edad
  calculada a partir de la fecha de nacimiento es menor a 21 años (igual que
  en el documento original). Si no se captura fecha de nacimiento, la sección
  se muestra por precaución.
- El endpoint de alta (`POST /api/fichas`) es público a propósito, para que el
  estudiante pueda llenarlo sin necesidad de una cuenta. El listado y la
  consulta (`GET /api/fichas`) están protegidos con autenticación básica.
- Campos obligatorios: primer apellido, nombre(s) y plantel. El resto son
  opcionales salvo los datos del tutor cuando aplica.
- Este proyecto es independiente de la app "Servicios Escolares": tiene su
  propio código, repositorio y base de datos. Si más adelante decides fusionar
  los datos (por ejemplo, dar de alta automáticamente al estudiante en
  Servicios Escolares a partir de una ficha ya revisada), se puede construir
  una integración posterior sin tener que rehacer esta app.
