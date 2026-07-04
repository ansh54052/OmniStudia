"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.reg = exports.get = exports.all = void 0;

const registry = new Map();

const reg = (a) => {
  registry.set(a.id, a);
  return a;
};exports.reg = reg;

const get = (id) => registry.get(id);exports.get = get;

const all = () => [...registry.values()];exports.all = all;