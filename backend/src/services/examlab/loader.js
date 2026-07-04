"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.loadAllExams = loadAllExams;exports.loadExam = loadExam;var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _jsYaml = _interopRequireDefault(require("js-yaml"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}


const modulesDir = _path.default.join(process.cwd(), "modules");

function loadExam(id) {
  const file = _path.default.join(modulesDir, `${id}.yml`);
  if (!_fs.default.existsSync(file)) return null;
  const raw = _fs.default.readFileSync(file, "utf8");
  const data = _jsYaml.default.load(raw);
  return normalizeExam(data);
}

function loadAllExams() {
  if (!_fs.default.existsSync(modulesDir)) return [];
  const files = _fs.default.readdirSync(modulesDir).filter((f) => f.endsWith(".yml"));
  return files.map((f) => {
    try {
      const raw = _fs.default.readFileSync(_path.default.join(modulesDir, f), "utf8");
      const data = _jsYaml.default.load(raw);
      return normalizeExam(data);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function normalizeExam(x) {
  if (!x?.id || !x?.name || !Array.isArray(x?.sections)) return null;
  return {
    id: String(x.id),
    name: String(x.name),
    scoring: x.scoring || "right-only",
    sections: x.sections.map((s) => ({
      id: String(s.id),
      title: String(s.title || s.id),
      durationSec: Number(s.durationSec || 0),
      instructions: typeof s.instructions === "string" ? s.instructions : undefined,
      gen: s.gen || undefined,
      items: Array.isArray(s.items) ? s.items : undefined
    })),
    rubrics: Array.isArray(x.rubrics) ? x.rubrics : []
  };
}