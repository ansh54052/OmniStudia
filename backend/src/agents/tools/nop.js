"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.nopTool = void 0;
const nopTool = exports.nopTool = {
  name: "nop",
  desc: "no operation",
  schema: {},
  run: async () => ({ ok: true })
};