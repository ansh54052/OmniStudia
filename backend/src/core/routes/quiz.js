"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.quizRoutes = quizRoutes;var _quiz = require("../../services/quiz");
var _ws = require("../../utils/chat/ws");
var _promise = require("../../utils/quiz/promise");
var _crypto = _interopRequireDefault(require("crypto"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const qs = new Map();
const qlog = (...a) => console.log("[quiz]", ...a);

function quizRoutes(app) {
  app.ws("/ws/quiz", (ws, req) => {
    const u = new URL(req.url, "http://localhost");
    const id = u.searchParams.get("quizId");
    if (!id) return ws.close(1008, "quizId required");

    let s = qs.get(id);
    if (!s) {
      s = new Set();
      qs.set(id, s);
    }
    s.add(ws);

    qlog("ws open", id, "clients:", s.size);
    ws.send(JSON.stringify({ type: "ready", quizId: id }));

    ws.on("error", (e) => qlog("ws err", id, e?.message || e));
    ws.on("close", () => {
      s.delete(ws);
      if (s.size === 0) qs.delete(id);
      qlog("ws close", id, "left:", s.size);
    });

    const iv = setInterval(() => {
      try {
        if (ws.readyState === 1)
        ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      } catch {}
    }, 15000);
    ws.on("close", () => clearInterval(iv));
  });

  app.post("/quiz", async (req, res) => {
    try {
      const topic = String(req.body?.topic || "").trim();
      if (!topic)
      return res.status(400).send({ ok: false, error: "topic required" });

      const quizId = _crypto.default.randomUUID();
      qlog("start", quizId, "topic:", topic);

      res.
      status(202).
      send({ ok: true, quizId, stream: `/ws/quiz?quizId=${quizId}` });

      setImmediate(async () => {
        try {
          (0, _ws.emitToAll)(qs.get(quizId), { type: "phase", value: "generating" });
          const qz = await (0, _promise.withTimeout)((0, _quiz.handleQuiz)(topic), 60000, "handleQuiz");
          qlog("generated", quizId, Array.isArray(qz) ? qz.length : "n/a");
          (0, _ws.emitToAll)(qs.get(quizId), { type: "quiz", quiz: qz });
          (0, _ws.emitToAll)(qs.get(quizId), { type: "done" });
          qlog("done", quizId);
        } catch (e) {
          qlog("error", quizId, e?.message || e);
          (0, _ws.emitToAll)(qs.get(quizId), {
            type: "error",
            error: e?.message || "failed"
          });
        }
      });
    } catch (e) {
      qlog("500 route err", e?.message || e);
      res.status(500).send({ ok: false, error: e?.message || "internal" });
    }
  });
}