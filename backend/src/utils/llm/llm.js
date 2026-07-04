"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.embeddings = exports.default = void 0;var _models = require("./models");

const { llm, embeddings } = (0, _models.makeModels)();exports.embeddings = embeddings;var _default = exports.default =

llm;