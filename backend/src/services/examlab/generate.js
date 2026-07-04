"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.handleExam = handleExam;var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _crypto = _interopRequireDefault(require("crypto"));
var _langgraph = require("@langchain/langgraph");
var _loader = require("./loader");

var _generator = require("./generator");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const cacheDir = _path.default.join(process.cwd(), "storage", "cache", "exam");
if (!_fs.default.existsSync(cacheDir)) _fs.default.mkdirSync(cacheDir, { recursive: true });
const keyOf = (x) => _crypto.default.createHash("sha256").update(x).digest("hex");
const readCache = (k) => {
  const f = _path.default.join(cacheDir, k + ".json");
  return _fs.default.existsSync(f) ? JSON.parse(_fs.default.readFileSync(f, "utf8")) : null;
};
const writeCache = (k, v) => _fs.default.writeFileSync(_path.default.join(cacheDir, k + ".json"), JSON.stringify(v));

const log = (...a) => console.log("[examlab/generate]", new Date().toISOString(), ...a);







const S = _langgraph.Annotation.Root({
  examId: (0, _langgraph.Annotation)(),
  spec: (0, _langgraph.Annotation)(),
  payload: (0, _langgraph.Annotation)()
});

const nLoad = async (s) => {
  log("nLoad:start", { examId: s.examId });
  const spec = (0, _loader.loadExam)(s.examId);
  if (!spec) {
    log("nLoad:error", "exam not found");
    throw new Error("exam not found");
  }
  log("nLoad:ok", { sections: spec.sections.length });
  return { ...s, spec };
};

const nCache = async (s) => {
  log("nCache:start");
  const k = keyOf(s.examId);
  const c = readCache(k);
  if (c) {
    log("nCache:hit", { bytes: JSON.stringify(c).length });
    return { ...s, payload: c };
  }
  log("nCache:miss");
  return s;
};

const nGen = async (s) => {
  if (s.payload) {
    log("nGen:skip:already-have-payload");
    return s;
  }
  const spec = s.spec;
  log("nGen:start", { sections: spec.sections.length });
  const sections = [];
  for (const sec of spec.sections) {
    const t0 = Date.now();
    const seed = `${spec.id}:${sec.id}:${t0}`;
    log("nGen:sec:start", { sectionId: sec.id, genType: sec.gen?.type });
    const items = await (0, _generator.generateSectionItems)(sec.gen, seed);
    log("nGen:sec:ok", { sectionId: sec.id, items: items.length, ms: Date.now() - t0 });
    sections.push({ id: sec.id, title: sec.title, durationSec: sec.durationSec, items });
  }
  const payload = { examId: spec.id, name: spec.name, sections };
  log("nGen:ok", { totalItems: sections.reduce((s, x) => s + x.items.length, 0) });
  return { ...s, payload };
};

const nValidate = async (s) => {
  log("nValidate:start");
  if (!s.payload) throw new Error("no payload");
  for (const sec of s.payload.sections) {
    if (!Array.isArray(sec.items) || sec.items.length === 0) throw new Error(`empty section ${sec.id}`);
    for (const it of sec.items) {
      if (typeof it.id !== "number") throw new Error(`bad id in ${sec.id}`);
      if (!it.question || !Array.isArray(it.options) || it.options.length !== 4) throw new Error(`bad item in ${sec.id}`);
      if (typeof it.correct !== "number" || it.correct < 1 || it.correct > 4) throw new Error(`bad correct in ${sec.id}`);
      if (!it.hint || !it.explanation) throw new Error(`bad meta in ${sec.id}`);
    }
  }
  log("nValidate:ok");
  return s;
};

const nSave = async (s) => {
  log("nSave:start");
  const k = keyOf(s.examId);
  writeCache(k, s.payload);
  log("nSave:ok", { bytes: JSON.stringify(s.payload).length });
  return s;
};

const g = new _langgraph.StateGraph(S);
g.addNode("load", nLoad);
g.addNode("cache", nCache);
g.addNode("gen", nGen);
g.addNode("validate", nValidate);
g.addNode("save", nSave);

const edge = (a, b) => g.addEdge(a, b);
edge("__start__", "load");
edge("load", "cache");
edge("cache", "gen");
edge("gen", "validate");
edge("validate", "save");
edge("save", "__end__");

const compiled = g.compile();

async function handleExam(examId) {
  log("handleExam:invoke", { examId });
  const s = await compiled.invoke({ examId, spec: null, payload: null });
  log("handleExam:done", { sections: s.payload?.sections?.length });
  return s.payload;
}