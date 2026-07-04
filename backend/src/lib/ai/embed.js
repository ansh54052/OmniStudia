"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.embedTextFromFile = embedTextFromFile;var _fs = _interopRequireDefault(require("fs"));
var _textsplitters = require("@langchain/textsplitters");

var _llm = require("../../utils/llm/llm");
var _db = require("../../utils/database/db");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

async function embedTextFromFile(filePath, namespace) {
  const raw = _fs.default.readFileSync(filePath, 'utf-8');
  const splitter = new _textsplitters.RecursiveCharacterTextSplitter({ chunkSize: 512, chunkOverlap: 30 });
  const docs = await splitter.createDocuments([raw]);

  await (0, _db.saveDocuments)(namespace, docs, _llm.embeddings);
  return 'Uploaded successfully.';
}