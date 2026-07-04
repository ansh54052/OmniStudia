"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.examRoutes = examRoutes;var _crypto = _interopRequireDefault(require("crypto"));
var _ws = require("../../utils/chat/ws");
var _promise = require("../../utils/quiz/promise");
var _generate = require("../../services/examlab/generate");
var _loader = require("../../services/examlab/loader");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const streams = new Map();
const log = (...a) => console.log("[exam]", ...a);

function okSpec(x) {
  return x && typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.sections) && x.sections.every((s) => s?.gen?.type);
}

function examRoutes(app) {
  app.ws("/ws/exams", (ws, req) => {
    const u = new URL(req.url, "http://localhost");
    const runId = u.searchParams.get("runId");
    if (!runId) return ws.close(1008, "runId required");

    let s = streams.get(runId);
    if (!s) {s = new Set();streams.set(runId, s);}
    s.add(ws);

    log("ws open", runId, "clients:", s.size);
    try {ws.send(JSON.stringify({ type: "ready", runId }));} catch {}

    ws.on("error", (e) => log("ws err", runId, e?.message || e));
    ws.on("close", () => {
      s.delete(ws);
      if (s.size === 0) streams.delete(runId);
      log("ws close", runId, "left:", s.size);
    });

    const iv = setInterval(() => {
      try {if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping", t: Date.now() }));} catch {}
    }, 15000);
    ws.on("close", () => clearInterval(iv));
  });

  app.get("/exams", (_req, res) => {
    try {
      const all = (0, _loader.loadAllExams)().filter(okSpec);
      const list = all.map((e) => ({
        id: e.id,
        name: e.name,
        sections: e.sections.map((s) => ({
          id: s.id,
          title: s.title,
          durationSec: s.durationSec,
          gen: { type: s.gen?.type, count: s.gen?.count ?? (s.gen?.tasks?.length || 0) }
        }))
      }));
      res.send({ ok: true, exams: list });
    } catch (e) {
      log("list err", e?.message || e);
      res.status(500).send({ ok: false, error: e?.message || "internal" });
    }
  });

  app.post("/exam", async (req, res) => {
    try {
      const examId = String(req.body?.examId || "").trim();
      if (!examId) return res.status(400).send({ ok: false, error: "examId required" });

      const runId = _crypto.default.randomUUID();
      res.status(202).send({ ok: true, runId, stream: `/ws/exams?runId=${runId}` });

      setImmediate(async () => {
        const s = streams.get(runId);
        try {
          (0, _ws.emitToAll)(s, { type: "phase", value: "generating", examId });
          const payload = await (0, _promise.withTimeout)((0, _generate.handleExam)(examId), 180000, "handleExam");
          await (0, _ws.emitLarge)(s, "exam", { examId, payload }, { id: runId, chunkBytes: 128 * 1024, gzip: false });
          (0, _ws.emitToAll)(s, { type: "done" });
          log("single done", runId, examId);
        } catch (e) {
          log("single err", runId, e?.message || e);
          (0, _ws.emitToAll)(s, { type: "error", examId, error: e?.message || "failed" });
        }
      });
    } catch (e) {
      log("500 single err", e?.message || e);
      res.status(500).send({ ok: false, error: e?.message || "internal" });
    }
  });

  app.post("/exams", async (_req, res) => {
    try {
      const runId = _crypto.default.randomUUID();
      res.status(202).send({ ok: true, runId, stream: `/ws/exams?runId=${runId}` });

      setImmediate(async () => {
        const s = streams.get(runId);
        try {
          const all = (0, _loader.loadAllExams)().filter(okSpec);
          if (!all.length) {
            (0, _ws.emitToAll)(s, { type: "error", error: "no exams found" });
            return;
          }
          (0, _ws.emitToAll)(s, { type: "phase", value: "generating_all", count: all.length });
          for (const ex of all) {
            try {
              (0, _ws.emitToAll)(s, { type: "phase", value: "generating", examId: ex.id });
              const payload = await (0, _promise.withTimeout)((0, _generate.handleExam)(ex.id), 180000, `handleExam:${ex.id}`);
              await (0, _ws.emitLarge)(s, "exam", { examId: ex.id, payload }, { id: runId, chunkBytes: 128 * 1024, gzip: false });
            } catch (e) {
              log("batch item err", ex.id, e?.message || e);
              (0, _ws.emitToAll)(s, { type: "error", examId: ex.id, error: e?.message || "failed" });
            }
          }
          (0, _ws.emitToAll)(s, { type: "done" });
          log("batch done", runId);
        } catch (e) {
          log("batch err", runId, e?.message || e);
          (0, _ws.emitToAll)(s, { type: "error", error: e?.message || "failed" });
        }
      });
    } catch (e) {
      log("500 batch err", e?.message || e);
      res.status(500).send({ ok: false, error: e?.message || "internal" });
    }
  });
}