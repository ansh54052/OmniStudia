"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.chatRoutes = chatRoutes;var _ask = require("../../lib/ai/ask");
var _upload = require("../../lib/parser/upload");
var _chat = require("../../utils/chat/chat");






var _ws = require("../../utils/chat/ws");



const chatSockets = new Map();

function chatRoutes(app) {
  app.ws("/ws/chat", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const chatId = url.searchParams.get("chatId");
    if (!chatId) {
      return ws.close(1008, "chatId required");
    }

    let set = chatSockets.get(chatId);
    if (!set) {
      set = new Set();
      chatSockets.set(chatId, set);
    }
    set.add(ws);

    ws.on("close", (code, reason) => {
      set.delete(ws);
      if (set.size === 0) chatSockets.delete(chatId);
    });

    ws.send(JSON.stringify({ type: "ready", chatId }));
  });

  app.post("/chat", async (req, res, next) => {
    const t0 = Date.now();
    try {
      const ct = String(req.headers["content-type"] || "");
      const isMp = ct.includes("multipart/form-data");

      let q = "";
      let chatId;
      let files = [];

      if (isMp) {
        const tMp = Date.now();
        const { q: mq, chatId: mcid, files: mf } = await (0, _upload.parseMultipart)(req);
        q = mq;
        chatId = mcid;
        files = mf || [];
        if (!q)
        return res.status(400).send({ error: "q required for file uploads" });
      } else {
        q = req.body?.q || "";
        chatId = req.body?.chatId;
        if (!q) return res.status(400).send({ error: "q required" });
      }

      let chat = chatId ? await (0, _chat.getChat)(chatId) : undefined;
      if (!chat) chat = await (0, _chat.mkChat)(q);
      const id = chat.id;
      const ns = `chat:${id}`;

      res.
      status(202).
      send({ ok: true, chatId: id, stream: `/ws/chat?chatId=${id}` });
      (async () => {
        try {
          if (isMp) {
            (0, _ws.emitToAll)(chatSockets.get(id), {
              type: "phase",
              value: "upload_start"
            });
            const tUp = Date.now();
            for (const f of files) {
              (0, _ws.emitToAll)(chatSockets.get(id), {
                type: "file",
                filename: f.filename,
                mime: f.mimeType
              });
              await (0, _upload.handleUpload)({
                filePath: f.path,
                filename: f.filename,
                contentType: f.mimeType,
                namespace: ns
              });
            }
            (0, _ws.emitToAll)(chatSockets.get(id), {
              type: "phase",
              value: "upload_done"
            });
          }

          const tUser = Date.now();
          await (0, _chat.addMsg)(id, { role: "user", content: q, at: Date.now() });
          (0, _ws.emitToAll)(chatSockets.get(id), {
            type: "phase",
            value: "generating"
          });

          let answer = "";

          const msgHistory = await (0, _chat.getMsgs)(id);
          const relevantHistory = msgHistory.slice(-20);

          answer = await (0, _ask.handleAsk)({
            q,
            namespace: ns,
            history: relevantHistory
          });

          await (0, _chat.addMsg)(id, {
            role: "assistant",
            content: answer,
            at: Date.now()
          });
          (0, _ws.emitToAll)(chatSockets.get(id), { type: "answer", answer });
          (0, _ws.emitToAll)(chatSockets.get(id), { type: "done" });
        } catch (err) {
          const msg = err?.message || "failed";
          const stack = err?.stack || String(err);
          console.error("[chat] err inner", { chatId: id, msg, stack });
          (0, _ws.emitToAll)(chatSockets.get(id), { type: "error", error: msg });
        }
      })().catch((e) => {
        console.error("[chat] err runner", e?.message || e);
      });
    } catch (e) {
      console.error("[chat] err outer", e?.message || e);
      next(e);
    }
  });

  app.get("/chats", async (_, res) => {
    const t = Date.now();
    const chats = await (0, _chat.listChats)();
    res.send({ ok: true, chats });
  });

  app.get("/chats/:id", async (req, res) => {
    const t = Date.now();
    const id = req.params.id;
    const chat = await (0, _chat.getChat)(id);
    if (!chat) {
      return res.status(404).send({ error: "not found" });
    }
    const messages = await (0, _chat.getMsgs)(id);
    res.send({ ok: true, chat, messages });
  });
}