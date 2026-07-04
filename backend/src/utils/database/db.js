"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.getRetriever = getRetriever;exports.saveDocuments = saveDocuments;var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _chroma = require("@langchain/community/vectorstores/chroma");
var _documents = require("@langchain/core/documents");

var _env = require("../../config/env");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const memoryStores = {};
const retrieverCache = {};

async function saveDocuments(
collection,
docs,
embeddings)
{
  if (_env.config.db_mode === "json") {
    const file = _path.default.join(process.cwd(), "storage", "json", `${collection}.json`);
    const dir = _path.default.dirname(file);
    if (!_fs.default.existsSync(dir)) _fs.default.mkdirSync(dir, { recursive: true });
    _fs.default.writeFileSync(
      file,
      JSON.stringify(
        docs.map((d) => ({
          pageContent: typeof d.pageContent === "string" ? d.pageContent : String(d.pageContent ?? ""),
          metadata: d.metadata || {}
        })),
        null,
        2
      )
    );
    delete memoryStores[collection];
    delete retrieverCache[collection];
  } else {
    const store = new _chroma.Chroma(embeddings, {
      collectionName: collection,
      collectionMetadata: { "hnsw:space": "cosine" },
      url: "http://localhost:8000"
    });
    await store.addDocuments(docs);
    retrieverCache[collection] = store.asRetriever({ k: 4 });
  }
}

async function getRetriever(
collection,
embeddings)
{
  if (retrieverCache[collection]) return retrieverCache[collection];

  if (_env.config.db_mode === "json") {
    const file = _path.default.join(process.cwd(), "storage", "json", `${collection}.json`);
    const docsRaw = _fs.default.existsSync(file) ? JSON.parse(_fs.default.readFileSync(file, "utf-8")) : [];
    const docs = docsRaw.map((d) => new _documents.Document({
      pageContent: typeof d.pageContent === "string" ? d.pageContent : String(d.pageContent ?? ""),
      metadata: d.metadata || {}
    }));
    if (!memoryStores[collection]) {
      const { MemoryVectorStore } = await import("@langchain/classic/vectorstores/memory");
      memoryStores[collection] = await MemoryVectorStore.fromDocuments(docs, embeddings);
    }
    retrieverCache[collection] = memoryStores[collection].asRetriever({ k: 4 });
    return retrieverCache[collection];
  } else {
    const store = new _chroma.Chroma(embeddings, {
      collectionName: collection,
      url: "http://localhost:8000"
    });
    retrieverCache[collection] = store.asRetriever({ k: 4 });
    return retrieverCache[collection];
  }
}