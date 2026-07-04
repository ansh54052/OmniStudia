"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.registerRoutes = registerRoutes;var _chat = require("./routes/chat");
var _quiz = require("./routes/quiz");
var _flashcards = require("./routes/flashcards");
var _notes = require("./routes/notes");
var _podcast = require("./routes/podcast");
var _examlab = require("./routes/examlab");
var _transcriber = require("./routes/transcriber");
var _planner = require("./routes/planner");
var _debate = require("./routes/debate");
var _companion = require("./routes/companion");

function registerRoutes(app) {
  (0, _chat.chatRoutes)(app);
  (0, _quiz.quizRoutes)(app);
  (0, _examlab.examRoutes)(app);
  (0, _podcast.podcastRoutes)(app);
  (0, _flashcards.flashcardRoutes)(app);
  (0, _notes.smartnotesRoutes)(app);
  (0, _transcriber.transcriberRoutes)(app);
  (0, _planner.plannerRoutes)(app);
  (0, _debate.debateRoutes)(app);
  (0, _companion.companionRoutes)(app);
}