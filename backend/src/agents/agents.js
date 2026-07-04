"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Agents = void 0;var _registry = require("./registry");

var _ask = require("./tools/ask");
var _notes = require("./tools/notes");
var _quiz = require("./tools/quiz");
var _examlab = require("./tools/examlab");
var _Ragsearch = require("./tools/Ragsearch");
var _nop = require("./tools/nop");
var _podcast = require("./tools/podcast");

const tutor = (0, _registry.reg)({
  id: "tutor",
  name: "Tutor",
  sys: "You teach and assess.",
  tools: [_nop.nopTool, _notes.notesTool, _quiz.quizTool, _ask.askTool]
});

const researcher = (0, _registry.reg)({
  id: "researcher",
  name: "Researcher",
  sys: "You aggregate context and draft outputs.",
  tools: [_nop.nopTool, _Ragsearch.Ragsearch, _ask.askTool]
});

const examiner = (0, _registry.reg)({
  id: "examiner",
  name: "Examiner",
  sys: "You design assessments.",
  tools: [_nop.nopTool, _examlab.examTool, _quiz.quizTool]
});

const podcaster = (0, _registry.reg)({
  id: "podcaster",
  name: "Podcaster",
  sys: "You turn materials into podcast scripts and synthesize audio.",
  tools: [_nop.nopTool, _podcast.podcastScriptTool, _podcast.podcastTtsTool]
});

const Agents = exports.Agents = { tutor, researcher, examiner };