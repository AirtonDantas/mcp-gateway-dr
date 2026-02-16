import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

/* =========================
   CONFIGURAÇÕES
========================= */

// ✅ No Render, crie uma variável de ambiente chamada MCP_TOKEN
// Ex.: MCP_TOKEN=5a3c907006291c8749772e
const MCP_TOKEN = (process.env.MCP_TOKEN || "").trim();

/* =========================
   MIDDLEWARE DE TOKEN
   (Retorna 403 para evitar o Base44 sugerir OAuth)
========================= */
function checkToken(req, res, next) {
  const auth = (req.headers.authorization || "").trim();

  if (!MCP_TOKEN) {
    return res.status(500).json({
      error: "MCP_TOKEN não configurado no servidor (Render).",
      hint: "Defina MCP_TOKEN em Render > Environment e redeploy."
    });
  }

  if (auth !== `Bearer ${MCP_TOKEN}`) {
    return res.status(403).json({
      error: "Token inválido",
      hint: "Envie Authorization: Bearer <MCP_TOKEN>"
    });
  }

  next();
}

/* =========================
   ENDPOINT DE SAÚDE
========================= */
app.get("/health", (req, res) => {
  res.json({ ok: true, se

