"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.connectDB = connectDB;var _mongoose = _interopRequireDefault(require("mongoose"));
var _path = _interopRequireDefault(require("path"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

process.loadEnvFile(_path.default.resolve(process.cwd(), '.env'));

async function connectDB() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/omnistudia';
    await _mongoose.default.connect(uri);
    console.log('[omnistudia] MongoDB connected successfully');
  } catch (error) {
    console.error('[omnistudia] MongoDB connection failed:', error);
  }
}