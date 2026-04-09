// One-off script to apply init-db.sql to a MySQL server.
// Reads connection info from .env (server/.env) and executes every
// statement in scripts/init-db.sql.
//
// Usage:
//   cd 4.lambda/server && node scripts/run-init-db.js

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const sqlPath = path.join(__dirname, 'init-db.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  console.log(`[init-db] connected to ${process.env.DB_HOST}/${process.env.DB_NAME}`);

  try {
    await connection.query(sql);
    console.log('[init-db] SQL applied successfully.');

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'debate_results'`,
      [process.env.DB_NAME]
    );
    if (rows[0].c === 1) {
      console.log('[init-db] ✅ debate_results table exists.');
    } else {
      console.error('[init-db] ❌ debate_results table was NOT created.');
      process.exitCode = 1;
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('[init-db] error:', err.message);
  process.exit(1);
});
