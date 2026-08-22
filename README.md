# Ficha de Registro Digital — IES Red IBAI Connect

App independiente (Node.js + Express + PostgreSQL) que digitaliza la "Ficha de
Registro" en papel, con carga de documentos a Google Drive. El estudiante la
llena desde un enlace público (pensado para compartirse por WhatsApp); el
personal de atención tiene un módulo de captura aparte, en una URL protegida
y distinta, que nunca se comparte públicamente.

## Estructura

```
ficha-registro-digital/
  server/
    index.js                    servidor Express
    db/pool.js                  conexión a PostgreSQL
    db/initdb.js                aplica schema.sql
    services/googleDrive.js     integración con la API de Google Drive
    routes/registroPublico.js   POST /api/fichas (sin autenticación)
    routes/documentos.js        POST /api/fichas/:id/documentos (sin autenticación)
    routes/registroAdmin.js     GET/PATCH/DELETE /api/fichas (con autenticación básica)
  public/
    index.html / css / js       formulario del estudiante (público)
    personal/index.html         módulo de captura del personal (protegido, URL no pública)
    admin/index.html            panel administrativo (listado, filtros, edición, documentos)
  schema.sql                    esquema de la tabla fichas_registro
  .env.example
```

## Puesta en marcha local

```bash
npm install
cp .env.example .env      # y edita las variables (ver abajo)
npm run initdb             # crea/actualiza la tabla fichas_registro
npm start                  # http://localhost:3000
```

- Formulario del estudiante (público, para compartir por WhatsApp): `http://localhost:3000/`
- Módulo de captura del personal (protegido, **no compartir esta URL** con estudiantes): `http://localhost:3000/personal`
- Panel administrativo: `http://localhost:3000/admin` (pide usuario/contraseña)

## Configurar la integración con Google Drive

La carga de documentos (acta de nacimiento, CURP, INE, último grado de
estudios, fotografía) se sube automáticamente a una carpeta de Google Drive
por estudiante. Para habilitarlo:

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un
   proyecto (o usa uno existente) y habilita la **Google Drive API**.
2. Ve a **IAM y administración > Cuentas de servicio** y crea una cuenta de
   servicio (Service Account). Genera una clave en formato **JSON** y
   descárgala.
3. En Google Drive, crea la carpeta raíz donde se guardarán las carpetas de
   los estudiantes, y **compártela** con el correo de la cuenta de servicio
   (algo como `nombre@proyecto.iam.gserviceaccount.com`), con permiso de
   **Editor**.
4. Copia el ID de esa carpeta (el texto en la URL después de `/folders/`).
5. Define dos variables de entorno:
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: el contenido completo del archivo JSON
     descargado en el paso 2, como una sola línea de texto.
   - `GOOGLE_DRIVE_ROOT_FOLDER_ID`: el ID de la carpeta del paso 4.

Si estas variables no están configuradas, el resto de la app sigue
funcionando con normalidad (se puede seguir guardando la ficha); solo la
subida de documentos devolverá un error pidiendo intentar más tarde o enviar
los documentos por correo.

**Nota:** esta integración fue escrita siguiendo la documentación oficial de
la API de Google Drive, pero no pudo probarse de extremo a extremo durante el
desarrollo (no había credenciales reales disponibles). Antes de anunciarla a
los estudiantes, haz una prueba completa: sube un documento de prueba desde el
formulario y confirma que aparece en la carpeta de Drive y que el panel
administrativo lo marca como "cargado".

## Despliegue en Render (mismo patrón que Control Escolar / Servicios Escolares)

1. Sube este proyecto a un repositorio de GitHub (puede ser privado).
2. En Render: **New > Web Service**, conecta el repositorio.
   - Build command: `npm install`
   - Start command: `npm start`
3. Crea una base de datos PostgreSQL (Render Postgres o Supabase) y copia su
   `DATABASE_URL` a las variables de entorno del servicio en Render.
4. Define `ADMIN_USER` y `ADMIN_PASSWORD` en las variables de entorno de
   Render (no dejes la contraseña por defecto). Estas credenciales protegen
   `/admin`, `/personal`, y la consulta de la API.
5. Define `GOOGLE_SERVICE_ACCOUNT_JSON` y `GOOGLE_DRIVE_ROOT_FOLDER_ID` (ver
   sección anterior) si vas a usar la carga de documentos.
6. Una sola vez, ejecuta la inicialización de la base de datos. Opciones:
   - Desde el Shell de Render del servicio: `npm run initdb`
   - O ejecuta `schema.sql` manualmente contra tu base de datos (psql, panel
     de Supabase, etc.)
7. (Opcional) Asigna un subdominio propio, por ejemplo
   `registro.redibaiconnect.org`.

## Notas

- El campo **III. Datos del padre o tutor** se exige solo cuando la edad
  calculada a partir de la fecha de nacimiento es menor a 21 años. Si no se
  captura fecha de nacimiento, la sección se muestra por precaución.
- Los endpoints de alta (`POST /api/fichas`) y de subida de documentos
  (`POST /api/fichas/:id/documentos`) son públicos a propósito, para que el
  estudiante los use sin necesidad de una cuenta. El listado, la consulta,
  la edición y la eliminación (`/api/fichas` con otros métodos) están
  protegidos con autenticación básica.
- Campos obligatorios: primer apellido, nombre(s) y plantel. El resto son
  opcionales salvo los datos del tutor cuando aplica.
- El módulo `/personal` reutiliza el mismo formulario que el público, con la
  única diferencia de que fija `capturado_por = personal` y vive detrás de
  autenticación — no compartas esa URL con estudiantes.
- Este proyecto es independiente de la app "Servicios Escolares": tiene su
  propio código, repositorio y base de datos.
