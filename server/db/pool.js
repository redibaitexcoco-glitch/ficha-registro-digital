const { Pool } = require('pg');

// Usa DATABASE_URL (Render/Supabase la proveen automáticamente).
// Si tu proveedor requiere SSL (Render Postgres, Supabase), se activa
// automáticamente salvo que definas PGSSL=disable en las variables de entorno.
const useSSL = process.env.PGSSL !== 'disable';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
