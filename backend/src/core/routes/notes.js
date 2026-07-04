"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.smartnotesRoutes = smartnotesRoutes;var _smartnotes = require("../../services/smartnotes");
var _ws = require("../../utils/chat/ws");
var _promise = require("../../utils/quiz/promise");
var _env = require("../../config/env");
var _crypto = _interopRequireDefault(require("crypto"));
var _path = _interopRequireDefault(require("path"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const ns = new Map();
const nlog = (...a) => console.log("[smartnotes]", ...a);

function smartnotesRoutes(app) {
  app.ws("/ws/smartnotes", (ws, req) => {
    const u = new URL(req.url, "http://localhost");
    const id = u.searchParams.get("noteId");
    if (!id) return ws.close(1008, "noteId required");

    let s = ns.get(id);
    if (!s) {
      s = new Set();
      ns.set(id, s);
    }
    s.add(ws);

    nlog("ws open", id, "clients:", s.size);
    ws.send(JSON.stringify({ type: "ready", noteId: id }));

    ws.on("error", (e) => nlog("ws err", id, e?.message || e));
    ws.on("close", () => {
      s.delete(ws);
      if (s.size === 0) ns.delete(id);
      nlog("ws close", id, "left:", s.size);
    });

    const iv = setInterval(() => {
      try {
        if (ws.readyState === 1)
        ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      } catch {}
    }, 15000);
    ws.on("close", () => clearInterval(iv));
  });

  app.post("/smartnotes", async (req, res) => {
    try {
      const { topic, notes, filePath } = req.body || {};
      if (!topic && !notes && !filePath) {
        return res.
        status(400).
        send({ ok: false, error: "Provide topic, notes, or filePath" });
      }

      const noteId = _crypto.default.randomUUID();
      nlog("start", noteId, "input:", { topic, notes, filePath });

      res.
      status(202).
      send({ ok: true, noteId, stream: `/ws/smartnotes?noteId=${noteId}` });

      setImmediate(async () => {
        try {
          (0, _ws.emitToAll)(ns.get(noteId), { type: "phase", value: "generating" });
          const result = await (0, _promise.withTimeout)(
            (0, _smartnotes.handleSmartNotes)({ topic, notes, filePath }),
            120000,
            "handleSmartNotes"
          );
          nlog("generated", noteId, result.file);
          (0, _ws.emitToAll)(ns.get(noteId), {
            type: "file",
            file: `${_env.config.url}/storage/smartnotes/${_path.default.basename(
              result.file
            )}`
          });
          (0, _ws.emitToAll)(ns.get(noteId), { type: "done" });
          nlog("done", noteId);
        } catch (e) {
          nlog("error", noteId, e?.message || e);
          (0, _ws.emitToAll)(ns.get(noteId), {
            type: "error",
            error: e?.message || "failed"
          });
        }
      });
    } catch (e) {
      nlog("500 route err", e?.message || e);
      res.status(500).send({ ok: false, error: e?.message || "internal" });
    }
  });
}