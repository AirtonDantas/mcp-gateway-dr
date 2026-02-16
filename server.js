import express from "express";

const app = express();
app.use(express.json());

// 1) Endpoint de saúde (para testar se está vivo)
app.get("/health", (req, res) => res.json({ ok: true }));

// 2) Endpoint MCP (por enquanto, resposta simples)
// Depois você evolui com tools reais.
// GET /mcp -> só para o Base44 conseguir "ver" que o endpoint existe
app.get("/mcp", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "MCP endpoint existe. Use POST /mcp para chamadas MCP."
  });
});
app.post("/mcp", (req, res) => {
  // Aqui o Base44 vai mandar pedidos MCP.
  // No MVP, só respondemos: "estou aqui".
  res.json({
    ok: true,
    message: "MCP Gateway D&R está online",
    note: "Agora conecte esta URL no Base44 em Settings > MCP Connections"
  });
});

// Porta do servidor (Render define via env PORT)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
