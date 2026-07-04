"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.makeAudio = makeAudio;exports.makeScript = makeScript;var _fs = _interopRequireDefault(require("fs"));
var _llm = _interopRequireDefault(require("../../utils/llm/llm"));
var _tts = require("../../utils/tts");
var _runtime = require("../../agents/runtime");
var _normalize = require("../../utils/text/normalize");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}




const P = `
ROLE
You are a professional podcast scriptwriter. 
You craft highly engaging, interactive, and natural-sounding scripts where two speakers explore ideas in a way that feels lively, curious, and practical. 
The conversation should discourage rote learning and instead highlight real-world applications, relatable daily problems, and thought-provoking examples.

OUTPUT
Return only one valid JSON object in this format:
{
 "title": "string",
 "summary": "string",
 "segments": [
   {"spk":"A|B","voice":"optional voice id","md":"markdown text of spoken dialogue"},
   ...
 ]
}

RULES
- 8–16 segments total
- Alternate speakers A and B consistently
- Each segment = 1–3 sentences max (natural spoken rhythm)
- Tone: casual, flowing, interactive — like two people thinking together, not lecturing
- Use markdown for clarity (lists, emphasis, short paragraphs, bullet points when helpful)
- Speakers should:
  * Ask and answer questions
  * Use analogies, metaphors, and relatable daily examples
  * Tie abstract ideas to concrete real-world scenarios
  * Highlight common mistakes and misconceptions
  * Encourage curiosity and exploration over memorization
- Summary: concise and enticing, like show notes
- Avoid filler; every segment should add value, humor, or a new perspective
- Make it sound alive: energy, curiosity, humor, and quick reactions
- No code fences or extra text outside the JSON

GOAL
The script should feel ready to record for a professional podcast that makes listeners think, laugh, and connect ideas to their daily lives — surpassing rote-learning style and beating competitors in engagement and clarity.
`.trim();

function j1(s) {
  let d = 0,b = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") {if (d === 0) b = i;d++;} else
    if (c === "}") {d--;if (d === 0 && b !== -1) return s.slice(b, i + 1);}
  }
  return "";
}

async function makeScript(input, topic) {
  const top = (0, _normalize.normalizeTopic)(topic || "general");

  const plan = {
    steps: [
    {
      tool: "podcast.script",
      input: { prompt: P, material: input, topic: top },
      timeoutMs: 20000,
      retries: 1
    }]

  };

  try {
    const r = await (0, _runtime.execDirect)({ agent: "podcaster", plan, ctx: {} });
    const out = r?.result;
    if (out && typeof out === "object" && Array.isArray(out.segments)) {
      return out;
    }
  } catch (err) {
  }

  const m = [
  { role: "system", content: P },
  { role: "user", content: `topic: ${top}\n\nmaterial:\n${input}\n\nreturn only json` }];


  const r = await _llm.default.invoke(m);
  const t = (typeof r === "string" ? r : String(r?.content || "")).trim();
  const s = j1(t) || t;
  const o = JSON.parse(s);
  if (!Array.isArray(o.segments)) o.segments = [];

  return o;
}

async function makeAudio(o, dir, base, emit) {
  await _fs.default.promises.mkdir(dir, { recursive: true });
  const segs = o.segments.map((x) => ({ text: x.md, voice: x.voice }));
  const out = await (0, _tts.tts)(segs, dir, base, emit);
  return out;
}