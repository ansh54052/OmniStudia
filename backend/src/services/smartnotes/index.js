"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.handleSmartNotes = handleSmartNotes;var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));

var _pdfLib = require("pdf-lib");
var _fontkit = _interopRequireDefault(require("@pdf-lib/fontkit"));
var _llm = _interopRequireDefault(require("../../utils/llm/llm"));
var _normalize = require("../../utils/text/normalize");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };} // @ts-ignore




function sanitizeText(s) {
  if (!s) return "";
  return s.
  replace(/\u2192/g, "->").
  replace(/\u00b2/g, "^2").
  replace(/\u00b3/g, "^3").
  replace(/[^\x00-\x7F]/g, "");
}

function wrap(s, max = 90) {
  return s.
  split("\n").
  map((line) => {
    const out = [];
    let cur = "";
    for (const w of line.split(/\s+/)) {
      if ((cur + " " + w).trim().length > max) {
        out.push(cur);
        cur = w;
      } else {
        cur = (cur ? cur + " " : "") + w;
      }
    }
    if (cur) out.push(cur);
    return out.join("\n");
  }).
  join("\n");
}

async function readInput(opts) {
  if (opts.notes) return opts.notes;
  if (opts.filePath) return await _fs.default.promises.readFile(opts.filePath, "utf8");
  if (opts.topic) return `Generate detailed Cornell notes on: ${(0, _normalize.normalizeTopic)(opts.topic)}`;
  throw new Error("No input");
}

function extractFirstJsonObject(s) {
  let depth = 0,start = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") {if (depth === 0) start = i;depth++;} else
    if (ch === "}") {depth--;if (depth === 0 && start !== -1) return s.slice(start, i + 1);}
  }
  return "";
}

function safeParse(raw) {
  try {return JSON.parse(raw);} catch {return null;}
}

async function generateNotes(text) {
  const prompt = `
ROLE
You are a note generator producing Cornell-style notes.

OBJECTIVE
Generate maximum detailed study notes from the input.

OUTPUT
Return ONLY a valid JSON object, no markdown, no prose.

SCHEMA
{
  "title": string,
  "notes": string,
  "summary": string,
  "questions": string[],
  "answers": string[]
}

RULES
- Do not wrap with code fences.
- Do not add commentary.
- Use plain text only.
- If a field has no content, return "" or [].
- For each question, the corresponding answer must be in the same index in answers.
`.trim();

  const r1 = await _llm.default.invoke([{ role: "user", content: prompt + "\n\nINPUT:\n" + text }]);
  const raw1 = typeof r1 === "string" ? r1 : String(r1?.content ?? "");
  const parsed1 = safeParse(extractFirstJsonObject(raw1) || raw1);
  if (parsed1 && typeof parsed1 === "object") return parsed1;

  const retrySys = `Return only a JSON object matching the schema. No markdown. No extra text.`;
  const r2 = await _llm.default.invoke([
  { role: "system", content: retrySys },
  { role: "user", content: prompt + "\n\nINPUT:\n" + text }]
  );
  const raw2 = typeof r2 === "string" ? r2 : String(r2?.content ?? "");
  const parsed2 = safeParse(extractFirstJsonObject(raw2) || raw2);
  if (parsed2 && typeof parsed2 === "object") return parsed2;

  const fallback = {
    title: "Notes",
    notes: sanitizeText(text).slice(0, 4000),
    summary: "",
    questions: [],
    answers: []
  };
  return fallback;
}

async function fillTemplateFormPDF(data) {
  const dir = _path.default.join(process.cwd(), "assets", "smartnotes");
  const hasDir = _fs.default.existsSync(dir);
  if (!hasDir) return null;
  const files = (await _fs.default.promises.readdir(dir)).filter((f) => f.endsWith(".pdf"));
  if (!files.length) return null;

  const chosen = files[Math.floor(Math.random() * files.length)];
  const pdfBytes = await _fs.default.promises.readFile(_path.default.join(dir, chosen));
  const pdfDoc = await _pdfLib.PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(_fontkit.default);

  const form = pdfDoc.getForm();
  try {
    const fontPath = _path.default.join(process.cwd(), "assets", "fonts", "Lexend.ttf");
    if (_fs.default.existsSync(fontPath)) {
      const fontBytes = await _fs.default.promises.readFile(fontPath);
      const font = await pdfDoc.embedFont(fontBytes, { subset: true });
      try {form.updateFieldAppearances(font);} catch {}
    }
  } catch {}

  try {form.getTextField("topic").setText(sanitizeText(data.title || ""));} catch {}
  try {form.getTextField("notes").setText(wrap(sanitizeText(data.notes || "")));} catch {}
  try {form.getTextField("summary").setText(wrap(sanitizeText(data.summary || "")));} catch {}
  try {
    const qna = (data.questions || []).
    map((q, i) => {
      const a = data.answers && data.answers[i] ? `\nAnswer: ${data.answers[i]}` : "";
      return `• ${q}${a}`;
    }).
    join("\n\n");
    form.getTextField("questions").setText(sanitizeText(qna));
  } catch {}

  const outDir = _path.default.join(process.cwd(), "storage", "smartnotes");
  await _fs.default.promises.mkdir(outDir, { recursive: true });
  const safeTitle = sanitizeText(data.title || "notes").replace(/[^a-z0-9]/gi, "_").slice(0, 50);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = _path.default.join(outDir, `${safeTitle || "notes"}_${ts}.pdf`);
  const outBytes = await pdfDoc.save();
  await _fs.default.promises.writeFile(outPath, outBytes);
  return outPath;
}

async function createSimplePDF(data) {
  const pdfDoc = await _pdfLib.PDFDocument.create();
  const font = await pdfDoc.embedStandardFont(_pdfLib.StandardFonts.Helvetica);
  const page = pdfDoc.addPage([612, 792]);

  const margin = 48;
  const width = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  const title = sanitizeText(data.title || "Notes");
  page.drawText(title, { x: margin, y, size: 20, font, color: (0, _pdfLib.rgb)(0, 0, 0) });
  y -= 28;

  const sections = [
  { h: "Notes", t: sanitizeText(data.notes || "") },
  { h: "Summary", t: sanitizeText(data.summary || "") },
  {
    h: "Questions",
    t: (data.questions || []).
    map((q, i) => {
      const a = data.answers && data.answers[i] ? `\nAnswer: ${data.answers[i]}` : "";
      return `• ${q}${a}`;
    }).
    join("\n\n")
  }];


  for (const sec of sections) {
    if (!sec.t) continue;
    page.drawText(sec.h, { x: margin, y, size: 14, font, color: (0, _pdfLib.rgb)(0, 0, 0) });
    y -= 18;

    const lines = wrap(sec.t, 90).split("\n");
    for (const line of lines) {
      if (y < margin + 24) {
        y = page.getHeight() - margin;
        const p = pdfDoc.addPage([612, 792]);
        p.drawText(title, { x: margin, y, size: 12, font, color: (0, _pdfLib.rgb)(0, 0, 0) });
        y -= 20;
      }
      page.drawText(line, { x: margin, y, size: 11, font, color: (0, _pdfLib.rgb)(0, 0, 0) });
      y -= 14;
    }
    y -= 12;
  }

  const outDir = _path.default.join(process.cwd(), "storage", "smartnotes");
  await _fs.default.promises.mkdir(outDir, { recursive: true });
  const safeTitle = sanitizeText(data.title || "notes").replace(/[^a-z0-9]/gi, "_").slice(0, 50);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = _path.default.join(outDir, `${safeTitle || "notes"}_${ts}.pdf`);
  const outBytes = await pdfDoc.save();
  await _fs.default.promises.writeFile(outPath, outBytes);
  return outPath;
}

async function handleSmartNotes(opts) {
  const input = await readInput(opts);
  const data = await generateNotes(input);

  const filled = await fillTemplateFormPDF(data);
  if (filled) return { ok: true, file: filled };

  const simple = await createSimplePDF(data);
  return { ok: true, file: simple };
}