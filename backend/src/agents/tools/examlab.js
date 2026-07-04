"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.examTool = void 0;
var _generator = require("../../services/examlab/generator");
var _crypto = _interopRequireDefault(require("crypto"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const examTool = exports.examTool = {
  name: "exam.generate",
  desc: "exam section generator; input: { type:'mcq'|'short', count?: number, style?: string, difficulty?: string, topic?: string, prompt: string }",
  schema: {},
  run: async (i) => {
    const seed = _crypto.default.randomBytes(8).toString("hex");
    const out = await (0, _generator.generateSectionItems)(i, seed);
    return out;
  }
};