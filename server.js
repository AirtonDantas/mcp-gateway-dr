import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const MCP_TOKEN = process.env.MCP_TOKEN;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---------------- TOKEN ----------------
function validateToken(req, res, next) {
  if (!MCP_TOKEN) return next();

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${MCP_TOKEN}`) {
    return res.status(401).json({ error: "Token inválido" });
  }
  next();
}

// ---------------- HEALTH ----------------
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: true });
  } catch (err) {
    res.json({ ok: true, db: false, error: err.message });
  }
});

// ---------------- MCP GET ----------------
app.get("/mcp", validateToken, (req, res) => {
  res.json({
    ok: true,
    tools: [
      "list_cases",
      "list_events",
      "list_leads",
      "add_case",
      "search_case"
    ]
  });
});

// ---------------- MCP POST ----------------
app.post("/mcp", validateToken, async (req, res) => {
  const { tool, args } = req.body;

  try {

    // 1️⃣ LISTAR PROCESSOS
    if (tool === "list_cases") {
      const r = await pool.query(`
        SELECT case_number, title, status
        FROM legal_case
        ORDER BY created_at DESC
        LIMIT 50
      `);
      return res.json({ ok: true, data: r.rows });
    }

    // 2️⃣ LISTAR EVENTOS
    if (tool === "list_events") {
      const r = await pool.query(`
        SELECT title, event_date, event_type
        FROM legal_event
        ORDER BY event_date ASC
        LIMIT 50
      `);
      return res.json({ ok: true, data: r.rows });
    }

    // 3️⃣ LISTAR LEADS
    if (tool === "list_leads") {
      const r = await pool.query(`
        SELECT name, email, occurred_at
        FROM lead
        ORDER BY occurred_at DESC
        LIMIT 50
      `);
      return res.json({ ok: true, data: r.rows });
    }

    // 4️⃣ INSERIR PROCESSO
    if (tool === "add_case") {
      const { case_number, title } = args;

      await pool.query(`
        INSERT INTO legal_case(case_number, title)
        VALUES ($1,$2)
      `,[case_number,title]);

      return res.json({ ok: true });
    }

    // 5️⃣ BUSCAR PROCESSO
    if (tool === "search_case") {
      const { term } = args;

      const r = await pool.query(`
        SELECT case_number, title, status
        FROM legal_case
        WHERE case_number ILIKE $1 OR title ILIKE $1
        LIMIT 20
      `,[`%${term}%`]);

      return res.json({ ok: true, data: r.rows });
    }

    return res.json({ ok:false, error:"tool desconhecida" });

  } catch(err){
    return res.json({ ok:false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log("🚀 MCP jurídico ativo");
});


