"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.askTool = void 0;
var _ask = require("../../lib/ai/ask");

const askTool = exports.askTool = {
  name: "ask.generate",
  desc: "structured QA + flashcards; input: { q: string, ns?: string, k?: number }",
  schema: {},
  run: async (i, c) => {
    const ns = i?.ns || c?.ns;
    const k = Number(i?.k || 6);
    const o = await (0, _ask.handleAsk)(i.q, ns, k);
    return o;
  }
};