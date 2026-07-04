"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.DebateSession = void 0;var _mongoose = _interopRequireWildcard(require("mongoose"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}

















const DebateMessageSchema = new _mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Number, required: true }
}, { _id: false });

const DebateSessionSchema = new _mongoose.Schema({
  id: { type: String, required: true, unique: true },
  topic: { type: String, required: true },
  position: { type: String, enum: ['for', 'against'], required: true },
  messages: { type: [DebateMessageSchema], default: [] },
  createdAt: { type: Number, required: true },
  status: { type: String, enum: ["active", "user_surrendered", "ai_conceded", "completed"] },
  winner: { type: String, enum: ["user", "ai", "draw"] }
});

const DebateSession = exports.DebateSession = _mongoose.default.model('DebateSession', DebateSessionSchema);