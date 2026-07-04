"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.handleUpload = handleUpload;exports.parseMultipart = parseMultipart;var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _mammoth = _interopRequireDefault(require("mammoth"));
var _pdfParse = _interopRequireDefault(require("pdf-parse"));
var _busboy = _interopRequireDefault(require("busboy"));
var _marked = require("marked");
var _embed = require("../ai/embed");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const str = _path.default.join(process.cwd(), 'storage', 'uploads');
if (!_fs.default.existsSync(str)) _fs.default.mkdirSync(str, { recursive: true });



function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = (0, _busboy.default)({ headers: req.headers });
    let q = '';
    let chatId = '';
    const files = [];
    let pending = 0;
    let ended = false;
    let failed = false;
    const done = () => {if (!failed && ended && pending === 0) resolve({ q, chatId: chatId || undefined, files });};

    bb.on('field', (n, v) => {if (n === 'q') q = v;if (n === 'chatId') chatId = v;});
    bb.on('file', (_n, file, info) => {
      pending++;
      const filename = info?.filename || 'file';
      const mimeType = info?.mimeType || info?.mime || 'application/octet-stream';
      const fp = _path.default.join(str, `${Date.now()}-${filename}`);
      const ws = _fs.default.createWriteStream(fp);
      file.on('error', (e) => {failed = true;reject(e);});
      ws.on('error', (e) => {failed = true;reject(e);});
      ws.on('finish', () => {files.push({ path: fp, filename, mimeType });pending--;done();});
      file.pipe(ws);
    });
    bb.on('error', (e) => {failed = true;reject(e);});
    bb.on('finish', () => {ended = true;done();});
    req.pipe(bb);
  });
}

async function handleUpload(a) {
  const fp = a.filePath;
  const mime = a.contentType || '';
  const ns = a.namespace || 'omnistudia';
  const txt = await extractText(fp, mime);
  if (!txt?.trim()) throw new Error('No valid content extracted from file.');
  const out = `${fp}.txt`;
  _fs.default.writeFileSync(out, txt);
  await (0, _embed.embedTextFromFile)(out, ns);
  return { stored: out };
}

async function extractText(filePath, mime) {
  const raw = _fs.default.readFileSync(filePath);
  if (mime.includes('pdf')) {
    const data = await (0, _pdfParse.default)(raw);
    return data.text;
  }
  if (mime.includes('markdown')) {
    return _marked.marked.parse(raw.toString());
  }
  if (mime.includes('plain')) {
    return raw.toString();
  }
  if (mime.includes('wordprocessingml') || mime.includes('msword') || mime.includes('vnd.oasis.opendocument.text')) {
    const r = await _mammoth.default.extractRawText({ buffer: raw });
    return r.value;
  }
  throw new Error('unsupported file type');
}