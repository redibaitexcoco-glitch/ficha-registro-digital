require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function initdb() {
  const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  try {
    await pool.query(schema);
    console.log('✅ Esquema aplicado correctamente (tabla fichas_registro lista).');
  } catch (err) {
    console.error('❌ Error aplicando el esquema:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

initdb();
