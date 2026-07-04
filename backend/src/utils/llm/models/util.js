"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.wrapChat = void 0;

const wrapChat = (m) => ({
  invoke: (ms) => m.invoke(ms),
  call: (ms) => m.invoke(ms)
});exports.wrapChat = wrapChat;