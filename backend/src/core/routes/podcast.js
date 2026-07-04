"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.podcastRoutes = podcastRoutes;var _path = _interopRequireDefault(require("path"));
var _fs = _interopRequireDefault(require("fs"));
var _podcast = require("../../services/podcast");
var _ws = require("../../utils/chat/ws");
var _env = require("../../config/env");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const sockets = new Map();
const pendingJobs = new Map();

function emit(id, msg) {
  const s = sockets.get(id);
  (0, _ws.emitToAll)(s, msg);
}

async function startJobIfReady(pid) {
  const job = pendingJobs.get(pid);
  const hasSockets = sockets.has(pid) && sockets.get(pid).size > 0;

  if (job && hasSockets) {
    pendingJobs.delete(pid);
    try {
      await job();
    } catch (err) {
      emit(pid, { type: "error", error: String(err) });
    }
  }
}

function podcastRoutes(app) {
  app.ws("/ws/podcast", (ws, req) => {
    const u = new URL(req.url, _env.config.baseUrl || "http://dummy");
    const pid = u.searchParams.get("pid");

    if (!pid) {
      return ws.close(1008, "pid required");
    }

    let set = sockets.get(pid);
    if (!set) {
      set = new Set();
      sockets.set(pid, set);
    }
    set.add(ws);

    ws.on("close", () => {
      set.delete(ws);
      if (set.size === 0) {
        sockets.delete(pid);
      }
    });

    const readyMsg = JSON.stringify({ type: "ready", pid });
    ws.send(readyMsg);

    setTimeout(() => {
      startJobIfReady(pid).catch((err) => {
        console.error(`[Podcast WS] Error starting job:`, err);
      });
    }, 100);
  });

  app.post("/podcast", async (req, res, next) => {
    try {
      const topic = String(req.body?.topic || req.body?.title || "").trim();

      if (!topic) {
        return res.status(400).send({ error: "topic required" });
      }

      const pid = cryptoRandom();
      const dir = _path.default.join(process.cwd(), "storage", "podcasts", pid);
      const base = topic.replace(/[^a-z0-9]/gi, "_").slice(0, 50) || "podcast";

      res.status(202).send({ ok: true, pid, stream: `/ws/podcast?pid=${pid}` });

      const job = async () => {
        try {
          const script = await (0, _podcast.makeScript)(topic, topic);
          emit(pid, { type: "script", data: script });

          const outPath = await (0, _podcast.makeAudio)(script, dir, base, (m) => {
            emit(pid, m);
          });
          if (!_fs.default.existsSync(outPath)) {
            throw new Error(`Audio file not created at ${outPath}`);
          }
          const filename = _path.default.basename(outPath);
          const downloadUrl = `${_env.config.baseUrl}/podcast/download/${pid}/${filename}`;
          const rel = _path.default.relative(process.cwd(), outPath).split(_path.default.sep).join("/");
          const staticUrl = `${_env.config.baseUrl}/${rel}`;

          const audioMessage = {
            type: "audio",
            file: downloadUrl,
            staticUrl: staticUrl,
            filename: filename
          };
          emit(pid, audioMessage);

          emit(pid, { type: "done" });
        } catch (e) {
          emit(pid, { type: "error", error: e?.message || "failed" });
        }
      };

      pendingJobs.set(pid, job);

      startJobIfReady(pid).catch((err) => {
        console.error(`[Podcast POST] Error starting job:`, err);
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/podcast/download/:pid/:filename", async (req, res, next) => {
    try {
      const { pid, filename } = req.params;
      const dirPath = _path.default.join(process.cwd(), "storage", "podcasts", pid);
      if (_fs.default.existsSync(dirPath)) {
        const filesInDir = _fs.default.readdirSync(dirPath);
        const actualFilename = filesInDir.find((f) => f.toLowerCase() === filename.toLowerCase());
        if (actualFilename) {
          const filePath = _path.default.join(dirPath, actualFilename);
          const fileStats = _fs.default.statSync(filePath);

          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Content-Disposition', `attachment; filename="${actualFilename}"`);
          res.setHeader('Content-Length', fileStats.size);

          const fileStream = _fs.default.createReadStream(filePath);
          fileStream.pipe(res);
          fileStream.on('error', (err) => {
            if (!res.headersSent) {
              res.status(500).send({ error: 'Download failed' });
            }
          });
          return;
        }
      }

      return res.status(404).send({ error: "File not found" });
    } catch (e) {
      next(e);
    }
  });
}

function cryptoRandom() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 0x3 | 0x8;
    return v.toString(16);
  });
}