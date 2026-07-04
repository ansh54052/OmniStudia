"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.save = exports.load = void 0;var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}



const dir = _path.default.join(process.cwd(), "storage", "agents");

const fileOf = (sid) => _path.default.join(dir, `${sid}.json`);

const load = (sid) => {
  if (!sid) return {};
  if (!_fs.default.existsSync(dir)) _fs.default.mkdirSync(dir, { recursive: true });
  const f = fileOf(sid);
  return _fs.default.existsSync(f) ? JSON.parse(_fs.default.readFileSync(f, "utf8")) : {};
};exports.load = load;

const save = (sid, m) => {
  if (!sid) return;
  if (!_fs.default.existsSync(dir)) _fs.default.mkdirSync(dir, { recursive: true });
  _fs.default.writeFileSync(fileOf(sid), JSON.stringify(m || {}, null, 0));
};exports.save = save;