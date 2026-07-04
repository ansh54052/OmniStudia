"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.addMsg = addMsg;exports.getChat = getChat;exports.getMsgs = getMsgs;exports.listChats = listChats;exports.mkChat = mkChat;var _crypto = require("crypto");
var _Chat = require("../../models/Chat");

async function mkChat(t) {
  const id = (0, _crypto.randomUUID)();
  const c = new _Chat.ChatMeta({ id, title: t.slice(0, 60), at: Date.now() });
  await c.save();
  return c;
}

async function getChat(id) {
  return await _Chat.ChatMeta.findOne({ id }).exec();
}

async function addMsg(id, m) {
  const msg = new _Chat.ChatMsg({
    chatId: id,
    role: m.role,
    content: m.content,
    at: m.at
  });
  await msg.save();

  await _Chat.ChatMeta.updateOne({ id }, { $set: { at: Date.now() } }).exec();
}

async function listChats(n = 50) {
  return await _Chat.ChatMeta.find().sort({ at: -1 }).limit(n).exec();
}

async function getMsgs(id) {
  return await _Chat.ChatMsg.find({ chatId: id }).sort({ at: 1 }).exec();
}