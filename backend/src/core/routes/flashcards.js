"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.flashcardRoutes = flashcardRoutes;var _Flashcard = require("../../models/Flashcard");
var _crypto = _interopRequireDefault(require("crypto"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

function flashcardRoutes(app) {
  app.post('/flashcards', async (req, res) => {
    try {
      const { question, answer, tag } = req.body;
      if (!question || !answer || !tag) return res.status(400).send({ error: 'question, answer, tag required' });
      const id = _crypto.default.randomUUID();
      const card = new _Flashcard.Flashcard({ id, question, answer, tag, created: Date.now() });
      await card.save();
      res.send({ ok: true, flashcard: card });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || 'failed' });
    }
  });

  app.get('/flashcards', async (_, res) => {
    try {
      const flashcards = await _Flashcard.Flashcard.find().exec();
      res.send({ ok: true, flashcards });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || 'failed' });
    }
  });

  app.delete('/flashcards/:id', async (req, res) => {
    try {
      const id = req.params.id;
      if (!id) return res.status(400).send({ error: 'id required' });
      await _Flashcard.Flashcard.deleteOne({ id }).exec();
      res.send({ ok: true });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || 'failed' });
    }
  });
}