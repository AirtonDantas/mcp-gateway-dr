import express from "express";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const MCP_TOKEN = process.env.MCP_TOKEN;

// -------------------------
// CONEXÃO POSTGRES
// -------------------------
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

// -------------------------
// BOOTSTRAP DO BANCO
// cria tabelas automaticamente
// -------------------------
async function bootstrapDatabase() {
  if (!pool) {
    console.error("❌ DATABASE_URL não configurado.");
    return;
  }

  try {
    const client = await pool.connect();

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS legal_case (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source TEXT NOT NULL DEFAULT 'ASTREA',
        case_number TEXT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        matter TEXT NULL,
        case_action TEXT NULL,
        forum TEXT NULL,
        court_unit TEXT NULL,
        responsible_name_raw TEXT NULL,
        distributed_at DATE NULL,
        closed_at DATE NULL,
        confidentiality TEXT NOT NULL DEFAULT 'CONFIDENTIAL',
        tags TEXT[] NOT NULL DEFAULT '{}'::text[],
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_case_source_case_number
      ON legal_case(source, case_number)
      WHERE case_number IS NOT NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS legal_event (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NULL REFERENCES legal_case(id),
        event_type TEXT NOT NULL,
        event_date TIMESTAMPTZ NOT NULL,
        title TEXT NOT NULL,
        description TEXT NULL,
        responsible_name_raw TEXT NULL,
        tags TEXT[] NOT NULL DEFAULT '{}'::text[],
        raw_case_title TEXT NULL,
        court_raw TEXT NULL,
        source TEXT NOT NULL DEFAULT 'ASTREA_EXPORT_AGENDA',
        source_ref TEXT NULL,
        event_nk TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_event_source_nk
      ON legal_event(source, event_nk);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lead (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NULL,
        phone TEXT NULL,
        company TEXT NULL,
        interest_area TEXT NULL,
        urgency TEXT NULL,
        status TEXT NOT NULL DEFAULT 'NEW',
        occurred_at TIMESTAMPTZ NOT NULL,
        source TEXT NOT NULL DEFAULT 'NEWSLETTER_CSV',
        source_ref TEXT NULL,
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lead_occurred_at
      ON lead(occurred_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lead_email
      ON lead(email);
    `);

    client.release();
    console.log("✅ Banco inicializado com sucesso");

  } catch (err) {
    console.error("❌ Erro bootstrap DB:", err);
  }
}

// roda bootstrap ao iniciar
bootstrapDatabase().catch((e) =>
  console.error("❌ Falha bootstrap:", e)
);

// -------------------------
// VALIDA TOKEN MCP
// -------------------------
function validateToken(req, res, next) {
  const auth = req.headers.authorization;

  if (!MCP_TOKEN) {
    console.warn("⚠ MCP_TOKEN não definido no ambiente.");
    return next();
  }

  if (!auth || auth !== `Bearer ${MCP_TOKEN}`) {
    return res.status(401).json({ error: "Token inválido" });
  }

  next();
}

// -------------------------
// HEALTH CHECK (testa banco)
// -------------------------
app.get("/health", async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        ok: true,
        db: false,
        reason: "DATABASE_URL ausente"
      });
    }

    await pool.query("SELECT 1");

    res.json({
      ok: true,
      db: true
    });

  } catch (err) {
    res.json({
      ok: true,
      db: false,
      error: err.message
    });
  }
});

// -------------------------
// MCP GET
// -------------------------
app.get("/mcp", validateToken, (req, res) => {
  res.json({
    ok: true,
    message: "MCP Gateway D&R ativo",
    tools: [
      "legal_cases",
      "legal_events",
      "leads"
    ]
  });
});

// -------------------------
// MCP POST
// -------------------------
app.post("/mcp", validateToken, async (req, res) => {
  res.json({
    ok: true,
    message: "MCP Gateway conectado ao banco",
    received: req.body
  });
});

// -------------------------
app.listen(PORT, () => {
  console.log(`🚀 MCP rodando na porta ${PORT}`);
});

