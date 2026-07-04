"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ChatMsg = exports.ChatMeta = void 0;var _mongoose = _interopRequireWildcard(require("mongoose"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}














const ChatMetaSchema = new _mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  at: { type: Number, required: true, default: () => Date.now() }
});

const ChatMsgSchema = new _mongoose.Schema({
  chatId: { type: String, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: _mongoose.Schema.Types.Mixed, required: true },
  at: { type: Number, required: true, default: () => Date.now() }
});

const ChatMeta = exports.ChatMeta = _mongoose.default.model('ChatMeta', ChatMetaSchema);
const ChatMsg = exports.ChatMsg = _mongoose.default.model('ChatMsg', ChatMsgSchema);