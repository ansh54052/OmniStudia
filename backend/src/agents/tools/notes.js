"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.notesTool = void 0;
var _smartnotes = require("../../services/smartnotes");

const notesTool = exports.notesTool = {
  name: "notes.cornell",
  desc: "generate Cornell notes to PDF; input: { topic?: string, notes?: string, filePath?: string }",
  schema: {},
  run: async (i, c) => {
    const out = await (0, _smartnotes.handleSmartNotes)(i);
    return out;
  }
};