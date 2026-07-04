"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.makeLLM = exports.makeEmbeddings = void 0;var _googleGenai = require("@langchain/google-genai");
var _util = require("./util");


const makeLLM = (cfg) => {
  const m = new _googleGenai.ChatGoogleGenerativeAI({
    model: cfg.gemini_model || 'gemini-1.5-pro',
    apiKey: cfg.gemini || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    temperature: cfg.temp ?? 1,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: cfg.max_tokens || 16384
  });
  return (0, _util.wrapChat)(m);
};exports.makeLLM = makeLLM;

const makeEmbeddings = (cfg) => {
  return new _googleGenai.GoogleGenerativeAIEmbeddings({
    model: cfg.gemini_embed_model || 'gemini-embedding-2',
    apiKey: cfg.gemini || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
  });
};exports.makeEmbeddings = makeEmbeddings;