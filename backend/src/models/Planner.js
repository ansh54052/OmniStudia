"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.PlannerTaskFile = exports.PlannerTask = void 0;var _mongoose = _interopRequireWildcard(require("mongoose"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}



























const PlannerTaskSchema = new _mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, required: true },
  dueAt: { type: String, required: true },
  course: { type: String },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
  estMins: { type: Number },
  priority: { type: Number }
}, { strict: false });

const PlannerTaskFileSchema = new _mongoose.Schema({
  id: { type: String, required: true, unique: true },
  taskId: { type: String, required: true, index: true },
  name: { type: String },
  filename: { type: String },
  originalName: { type: String },
  mimeType: { type: String },
  size: { type: Number },
  uploadedAt: { type: String },
  type: { type: String },
  content: { type: String }
}, { strict: false });

const PlannerTask = exports.PlannerTask = _mongoose.default.model('PlannerTask', PlannerTaskSchema);
const PlannerTaskFile = exports.PlannerTaskFile = _mongoose.default.model('PlannerTaskFile', PlannerTaskFileSchema);