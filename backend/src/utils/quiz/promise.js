"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.withTimeout = withTimeout;function withTimeout(p, ms, label = 'op') {
  let t;
  return new Promise((resolve, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
    p.then((v) => {clearTimeout(t);resolve(v);}).
    catch((e) => {clearTimeout(t);reject(e);});
  });
}