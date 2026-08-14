require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const basicAuth = require('express-basic-auth');

const registroPublico = require('./routes/registroPublico');
const registroAdmin = require('./routes/registroAdmin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// La consulta administrativa (listar, ver, marcar revisado) requiere autenticación básica.
// Define ADMIN_USER y ADMIN_PASSWORD en las variables de entorno.
const proteger = basicAuth({
  users: { [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASSWORD || 'cambia-esta-clave' },
  challenge: true,
  realm: 'Ficha de Registro - Servicios Escolares',
});

// API pública: alta de una nueva ficha (sin autenticación)
app.use('/api/fichas', registroPublico);

// Verifica credenciales de administrador (usadas por el botón "Administrador" del formulario público,
// para impedir que un estudiante pueda marcarse como personal de atención).
app.get('/api/admin/verificar', proteger, (req, res) => res.json({ ok: true }));

// API administrativa: listar, ver detalle, marcar revisada (protegida)
app.use('/api/fichas', proteger, registroAdmin);

// Panel administrativo (HTML) protegido
app.use('/admin', proteger, express.static(path.join(__dirname, '..', 'public', 'admin'), { index: 'index.html' }));

// Formulario público
app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html' }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Ficha de Registro Digital escuchando en el puerto ${PORT}`);
});
