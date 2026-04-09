const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'debate_studio',
    waitForConnections: true,
    connectionLimit: 5
  });
  return pool;
}

async function insertResult({ topic, positionA, positionB, geminiSide, novaSide, userChoice, winnerModel, turnCount }) {
  const [r] = await getPool().execute(
    `INSERT INTO debate_results
     (topic, position_a, position_b, gemini_side, nova_side, user_choice, winner_model, turn_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [topic, positionA, positionB, geminiSide, novaSide, userChoice, winnerModel, turnCount]
  );
  return r.insertId;
}

async function getStats() {
  const [rows] = await getPool().execute(
    `SELECT winner_model, COUNT(*) AS wins FROM debate_results GROUP BY winner_model`
  );
  const stats = { gemini: 0, nova: 0 };
  for (const row of rows) stats[row.winner_model] = row.wins;
  const total = stats.gemini + stats.nova;
  return {
    geminiWins: stats.gemini,
    novaWins: stats.nova,
    totalDebates: total,
    geminiWinRate: total ? stats.gemini / total : 0,
    novaWinRate: total ? stats.nova / total : 0
  };
}

async function getRecentResults(limit = 20) {
  const [rows] = await getPool().execute(
    `SELECT id, topic, position_a, position_b, gemini_side, nova_side,
            user_choice, winner_model, turn_count, created_at
     FROM debate_results ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = { getPool, insertResult, getStats, getRecentResults };
