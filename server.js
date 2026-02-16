import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MCP_TOKEN = process.env.MCP_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

// -------------------------
// CONEXÃO POSTGRES
// -------------------------
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// -------------------------
// CRIAR TABELAS AUTOMATICAMENTE
// -------------------------
async function bootstrapDatabase() {
  try {
    const client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS legal_cases (
        id SERIAL PRIMARY KEY,
        case_number TEXT,
        client_name TEXT,
        status TEXT,
        next_deadline DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS deadlines (
        id SERIAL PRIMARY KEY,
        case_id INTEGER,
        description TEXT,
        due_date DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hearings (
        id SERIAL PRIMARY KEY,
        case_id INTEGER,
        date TIMESTAMP,
        location TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS kpis (
        id SERIAL PRIMARY KEY,
        name TEXT,
        value NUMERIC,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ Banco inicializado com sucesso");
    client.release();
  } catch (err) {
    console.error("❌ Erro bootstrap DB:", err);
  }
}

// roda ao iniciar
bootstrapDatabase();

// -------------------------
// AUTH TOKEN
// -------------------------
function validateToken(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || auth !== `Bearer ${MCP_TOKEN}`) {
    return res.status(401).json({ error: "Token inválido" });
  }

  next();
}

// -------------------------
// HEALTH CHECK
// -------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, db: !!DATABASE_URL });
});

// -------------------------
// MCP GET
// -------------------------
app.get("/mcp", validateToken, (req, res) => {
  res.json({
    ok: true,
    message: "MCP endpoint ativo",
    tools: ["legal_cases", "deadlines", "hearings", "kpis"]
  });
});

// -------------------------
// MCP POST
// -------------------------
app.post("/mcp", validateToken, async (req, res) => {
  res.json({
    ok: true,
    message: "MCP Gateway D&R conectado ao banco",
    received: req.body
  });
});

app.listen(PORT, () => {
  console.log(`🚀 MCP rodando na porta ${PORT}`);
});

