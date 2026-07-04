"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.loggerMiddleware = loggerMiddleware;function loggerMiddleware(req, _res, next) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.url}`);
  next();
}