"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.quizTool = void 0;
var _quiz = require("../../services/quiz");

const quizTool = exports.quizTool = {
  name: "quiz.build",
  desc: "build 5 MCQs; input: { topic: string }",
  schema: {},
  run: async (i) => {
    const out = await (0, _quiz.handleQuiz)(i.topic);
    return out;
  }
};