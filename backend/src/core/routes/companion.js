"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.companionRoutes = companionRoutes;var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _ask = require("../../lib/ai/ask");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const allowedRoots = [
_path.default.resolve(process.cwd(), "storage"),
_path.default.resolve(process.cwd(), "assets")];


const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5MB guardrail for text reads



function normalizePathInput(input) {
  let trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    trimmed = url.pathname || "";
  } catch {


    // not a URL, continue with raw string
  }return trimmed.replace(/\\/g, "/");}

function resolveDocumentPath(input) {
  if (!input) return null;
  const normalized = normalizePathInput(input);
  if (!normalized) return null;

  const cleaned = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  const candidates = [];

  if (_path.default.isAbsolute(normalized)) {
    candidates.push(_path.default.normalize(normalized));
  } else {
    for (const root of allowedRoots) {
      candidates.push(_path.default.resolve(root, cleaned));
    }
  }

  for (const candidate of candidates) {
    for (const root of allowedRoots) {
      const resolvedRoot = _path.default.resolve(root);
      const prefix = resolvedRoot.endsWith(_path.default.sep) ? resolvedRoot : resolvedRoot + _path.default.sep;
      if (candidate === resolvedRoot || candidate.startsWith(prefix)) {
        if (_fs.default.existsSync(candidate) && _fs.default.statSync(candidate).isFile()) {
          return candidate;
        }
      }
    }
  }
  return null;
}

async function readDocumentText(filePath) {
  const stats = await _fs.default.promises.stat(filePath);
  if (!stats.isFile()) throw new Error("document is not a file");
  if (stats.size > MAX_BYTES) throw new Error("document too large for companion (limit 1.5MB)");
  return _fs.default.promises.readFile(filePath, "utf8");
}

function buildCompanionPrompt(label) {
  const focus = label ? ` for the document "${label}"` : " for this document";
  const extra = `
CONTEXT FOCUS
You are an AI companion${focus}. Use ONLY the supplied context to respond.
If the context is insufficient, say so clearly rather than guessing.
Favor concise, actionable study guidance grounded in the provided material.
`;
  return `${_ask.BASE_SYSTEM_PROMPT}\n\n${extra.trim()}`;
}

function companionRoutes(app) {
  app.post("/api/companion/ask", async (req, res) => {
    try {
      const body = req.body || {};
      const question = typeof body.question === "string" ? body.question.trim() : "";
      if (!question) return res.status(400).send({ error: "question required" });

      const history = Array.isArray(body.history) ? body.history : undefined;
      const documentTitle = typeof body.documentTitle === "string" ? body.documentTitle.trim() : "";

      let contextText = "";
      let filename;

      if (typeof body.documentText === "string" && body.documentText.trim()) {
        contextText = body.documentText;
      } else if (typeof body.filePath === "string" && body.filePath.trim()) {
        const resolved = resolveDocumentPath(body.filePath);
        if (!resolved) return res.status(404).send({ error: "document not found or not accessible" });
        filename = _path.default.basename(resolved);
        try {
          contextText = await readDocumentText(resolved);
        } catch (err) {
          const msg = err?.message || "unable to read document";
          return res.status(400).send({ error: msg });
        }
      } else {
        return res.status(400).send({ error: "documentText or filePath required" });
      }

      if (!contextText.trim()) {
        return res.status(400).send({ error: "document is empty" });
      }

      const prompt = buildCompanionPrompt(filename || documentTitle);
      const answer = await (0, _ask.askWithContext)({
        question,
        context: contextText,
        topic: typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : undefined,
        history,
        systemPrompt: prompt,
        cacheScope: "companion"
      });

      res.send({ ok: true, companion: answer });
    } catch (err) {
      console.error("[companion] ask failed", err?.message || err);
      res.status(500).send({ error: "failed to run companion request" });
    }
  });
}