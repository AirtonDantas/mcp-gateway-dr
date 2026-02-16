import express from "express";
import { randomUUID } from "crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "2mb" }));

/** ==========
 *  TOKEN
 *  ========== */
const MCP_TOKEN = process.env.MCP_TOKEN || "COLOQUE_UM_TOKEN_AQUI_PARA_TESTE_LOCAL";

function checkToken(req, res, next) {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${MCP_TOKEN}`) {
    return res.status(401).json({ error: "Token inválido" });
  }
  next();
}

/** ==========
 *  HEALTH
 *  ========== */
app.get("/health", (req, res) => res.json({ ok: true }));

/** ==========
 *  MCP SERVER FACTORY (define tools aqui)
 *  ========== */
function buildMcpServer() {
  const server = new McpServer(
    { name: "mcp-gateway-dr", version: "1.0.0" },
    { capabilities: { logging: {} } }
  );

  // Tool de teste: Base44 precisa conseguir listar tools para validar conexão
  server.tool(
    "ping",
    "Confirma que o MCP do Dantas e Rodrigues está respondendo.",
    { message: z.string().optional() },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              pong: true,
              echo: message || null,
              now: new Date().toISOString(),
            }),
          },
        ],
      };
    }
  );

  return server;
}

/** ==========
 *  SESSIONS (stateful, para o Base44 funcionar bem)
 *  ========== */
const sessions = new Map(); // sessionId -> { server, transport }

/** ==========
 *  GET /mcp
 *  (Base44 às vezes testa existência; pela spec, GET pode ser SSE ou 405)
 *  ========== */
app.get("/mcp", checkToken, (req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/event-stream")) {
    return res.status(405).send("SSE not enabled on GET /mcp");
  }
  return res.status(200).json({ ok: true, message: "MCP endpoint online. Use POST /mcp (JSON-RPC)." });
});

/** ==========
 *  POST /mcp (MCP real - JSON-RPC)
 *  ========== */
app.post("/mcp", checkToken, async (req, res) => {
  try {
    const body = req.body;

    // Base44/cliente manda Mcp-Session-Id nas requisições após initialize
    const headerSessionId =
      req.headers["mcp-session-id"] ||
      req.headers["Mcp-Session-Id"] ||
      req.headers["mcp-session-id".toLowerCase()];

    // Se é initialize, criamos sessão nova
    const isInitialize = body?.method === "initialize";

    let sessionId = headerSessionId;

    if (isInitialize || !sessionId) {
      sessionId = randomUUID();
      const server = buildMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
      });

      await server.connect(transport);
      sessions.set(sessionId, { server, transport });
    }

    const sess = sessions.get(sessionId);
    if (!sess) {
      return res.status(404).json({ error: "Sessão MCP não encontrada. Refaça initialize." });
    }

    // delega para o transport do SDK responder conforme MCP
    await sess.transport.handleRequest(req, res, body);

    // (opcional) limpeza quando o request fecha
    res.on("close", () => {
      // não fechamos a sessão aqui, para permitir múltiplas chamadas
    });
  } catch (err) {
    console.error("MCP error:", err);
    res.status(500).json({ error: "Erro interno no MCP" });
  }
});

/** ==========
 *  (Opcional) DELETE /mcp para encerrar sessão
 *  ========== */
app.delete("/mcp", checkToken, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && sessions.has(sessionId)) {
    const { server, transport } = sessions.get(sessionId);
    transport.close();
    server.close();
    sessions.delete(sessionId);
  }
  res.status(200).json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("MCP Gateway D&R rodando na porta", PORT));
