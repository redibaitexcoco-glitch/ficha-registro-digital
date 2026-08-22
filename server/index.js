require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const basicAuth = require('express-basic-auth');

const registroPublico = require('./routes/registroPublico');
const registroAdmin = require('./routes/registroAdmin');
const documentos = require('./routes/documentos');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Protege el panel administrativo, el módulo de captura del personal, y la API de consulta.
// Define ADMIN_USER y ADMIN_PASSWORD en las variables de entorno.
const proteger = basicAuth({
  users: { [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASSWORD || 'cambia-esta-clave' },
  challenge: true,
  realm: 'Ficha de Registro - Servicios Escolares',
});

// API pública: alta de una nueva ficha y subida de sus documentos (sin autenticación,
// para que el estudiante pueda llenarla desde el enlace compartido por WhatsApp)
app.use('/api/fichas', registroPublico);
app.use('/api/fichas', documentos);

// API administrativa: listar, ver detalle, marcar revisada, editar, eliminar (protegida)
app.use('/api/fichas', proteger, registroAdmin);

// Panel administrativo (HTML) protegido
app.use('/admin', proteger, express.static(path.join(__dirname, '..', 'public', 'admin'), { index: 'index.html' }));

// Módulo de captura para personal autorizado (HTML) protegido — URL que NO se comparte
// públicamente; el estudiante solo conoce y usa el formulario en la raíz del sitio.
app.use('/personal', proteger, express.static(path.join(__dirname, '..', 'public', 'personal'), { index: 'index.html' }));

// Formulario público del estudiante
app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html' }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Ficha de Registro Digital escuchando en el puerto ${PORT}`);
});
