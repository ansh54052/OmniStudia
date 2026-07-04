"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.debateRoutes = debateRoutes;var _debate = require("../../services/debate");











const debateSockets = new Map();
const analysisSockets = new Map();

function debateRoutes(app) {
  app.ws("/ws/debate", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const debateId = url.searchParams.get("debateId");
    if (!debateId) {
      return ws.close(1008, "debateId required");
    }

    let set = debateSockets.get(debateId);
    if (!set) {
      set = new Set();
      debateSockets.set(debateId, set);
    }
    set.add(ws);

    ws.on("close", () => {
      set.delete(ws);
      if (set.size === 0) debateSockets.delete(debateId);
    });

    ws.send(JSON.stringify({ type: "ready", debateId }));
  });

  app.ws("/ws/debate/analyze", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const debateId = url.searchParams.get("debateId");
    if (!debateId) {
      return ws.close(1008, "debateId required");
    }

    let set = analysisSockets.get(debateId);
    if (!set) {
      set = new Set();
      analysisSockets.set(debateId, set);
    }
    set.add(ws);

    ws.on("close", () => {
      set.delete(ws);
      if (set.size === 0) analysisSockets.delete(debateId);
    });

    ws.send(JSON.stringify({ type: "ready", debateId }));
  });

  app.post("/debate/start", async (req, res) => {
    try {
      const { topic, position } = req.body;

      if (!topic || !topic.trim()) {
        return res.status(400).json({
          ok: false,
          error: "Topic is required"
        });
      }

      if (!position || !["for", "against"].includes(position)) {
        return res.status(400).json({
          ok: false,
          error: "Position must be 'for' or 'against'"
        });
      }

      const session = await (0, _debate.createDebateSession)(topic.trim(), position);

      res.json({
        ok: true,
        debateId: session.id,
        session: {
          id: session.id,
          topic: session.topic,
          position: session.position,
          createdAt: session.createdAt
        },
        stream: `/ws/debate?debateId=${session.id}`
      });
    } catch (error) {
      console.error("Error starting debate:", error);
      res.status(500).json({
        ok: false,
        error: error.message || "Failed to start debate"
      });
    }
  });

  app.post("/debate/:debateId/argue", async (req, res) => {
    try {
      const { debateId } = req.params;
      const { argument } = req.body;

      if (!argument || !argument.trim()) {
        return res.status(400).json({
          ok: false,
          error: "Argument is required"
        });
      }

      const session = await (0, _debate.getDebateSession)(debateId);
      if (!session) {
        return res.status(404).json({
          ok: false,
          error: "Debate session not found"
        });
      }

      res.status(202).json({
        ok: true,
        message: "Argument received, streaming response"
      });

      const sockets = debateSockets.get(debateId);
      if (!sockets || sockets.size === 0) {
        console.warn(`No active WebSocket connections for debate ${debateId}`);
        return;
      }

      const emitToDebate = (data) => {
        sockets.forEach((ws) => {
          try {
            ws.send(JSON.stringify(data));
          } catch (err) {
            console.error("Error sending to WebSocket:", err);
          }
        });
      };

      emitToDebate({ type: "user_argument", content: argument.trim() });
      emitToDebate({ type: "ai_thinking" });

      try {
        let fullResponse = "";
        for await (const token of (0, _debate.streamDebateResponse)(
          debateId,
          argument.trim()
        )) {
          // Check if AI is conceding
          if (typeof token === "object" && token.type === "concede") {
            emitToDebate({
              type: "ai_concede",
              reason: token.reason
            });
            return;
          }

          fullResponse += token;
          emitToDebate({ type: "ai_token", token });
        }

        emitToDebate({ type: "ai_complete", content: fullResponse });
      } catch (error) {
        console.error("Error streaming debate response:", error);
        emitToDebate({
          type: "error",
          error: error.message || "Failed to generate response"
        });
      }
    } catch (error) {
      console.error("Error in debate argue:", error);
      res.status(500).json({
        ok: false,
        error: error.message || "Failed to process argument"
      });
    }
  });

  app.get("/debate/:debateId", async (req, res) => {
    try {
      const { debateId } = req.params;
      const session = await (0, _debate.getDebateSession)(debateId);

      if (!session) {
        return res.status(404).json({
          ok: false,
          error: "Debate session not found"
        });
      }

      res.json({
        ok: true,
        session
      });
    } catch (error) {
      console.error("Error getting debate:", error);
      res.status(500).json({
        ok: false,
        error: error.message || "Failed to get debate"
      });
    }
  });

  app.get("/debates", async (req, res) => {
    try {
      const sessions = await (0, _debate.listDebateSessions)();
      res.json({
        ok: true,
        debates: sessions.map((s) => ({
          id: s.id,
          topic: s.topic,
          position: s.position,
          messageCount: s.messages.length,
          createdAt: s.createdAt
        }))
      });
    } catch (error) {
      console.error("Error listing debates:", error);
      res.status(500).json({
        ok: false,
        error: error.message || "Failed to list debates"
      });
    }
  });

  app.delete("/debate/:debateId", async (req, res) => {
    try {
      const { debateId } = req.params;
      const deleted = await (0, _debate.deleteDebateSession)(debateId);

      if (!deleted) {
        return res.status(404).json({
          ok: false,
          error: "Debate session not found"
        });
      }

      res.json({
        ok: true,
        message: "Debate session deleted"
      });
    } catch (error) {
      console.error("Error deleting debate:", error);
      res.status(500).json({
        ok: false,
        error: error.message || "Failed to delete debate"
      });
    }
  });

  app.post("/debate/:debateId/surrender", async (req, res) => {
    try {
      const { debateId } = req.params;
      const session = await (0, _debate.getDebateSession)(debateId);

      if (!session) {
        return res.status(404).json({
          ok: false,
          error: "Debate session not found"
        });
      }

      await (0, _debate.surrenderDebate)(debateId);

      res.json({
        ok: true,
        message: "Debate surrendered"
      });
    } catch (error) {
      console.error("Error surrendering debate:", error);
      res.status(500).json({
        ok: false,
        error: error.message || "Failed to surrender debate"
      });
    }
  });

  app.post("/debate/:debateId/analyze", async (req, res) => {
    try {
      const { debateId } = req.params;
      const session = await (0, _debate.getDebateSession)(debateId);

      if (!session) {
        return res.status(404).json({
          ok: false,
          error: "Debate session not found"
        });
      }

      console.log("[Debate Routes] Starting analysis for:", debateId);

      // Send immediate response, actual analysis happens via WebSocket
      res.status(202).json({
        ok: true,
        message: "Analysis started",
        stream: `/ws/debate/analyze?debateId=${debateId}`
      });

      // Stream analysis via WebSocket
      const sockets = analysisSockets.get(debateId);
      if (!sockets || sockets.size === 0) {
        console.warn(`No active analysis WebSocket connections for debate ${debateId}`);
        return;
      }

      const emitToAnalysis = (data) => {
        sockets.forEach((ws) => {
          try {
            ws.send(JSON.stringify(data));
          } catch (err) {
            console.error("Error sending to analysis WebSocket:", err);
          }
        });
      };

      try {
        for await (const event of (0, _debate.streamDebateAnalysis)(debateId)) {
          if (event.type === "phase") {
            emitToAnalysis({ type: "phase", value: event.value });
          } else if (event.type === "analysis") {
            emitToAnalysis({
              type: "complete",
              analysis: event.data,
              session: {
                ...session,
                winner: event.data.winner,
                status: session.status || "completed"
              }
            });
          }
        }
      } catch (error) {
        console.error("Error streaming analysis:", error);
        emitToAnalysis({
          type: "error",
          error: error.message || "Failed to analyze debate"
        });
      }
    } catch (error) {
      console.error("Error analyzing debate:", error);
      res.status(500).json({
        ok: false,
        error: error.message || "Failed to analyze debate"
      });
    }
  });
}