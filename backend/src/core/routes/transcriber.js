"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.transcriberRoutes = transcriberRoutes;var _transcriber = require("../../services/transcriber");
var _env = require("../../config/env");
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _busboy = _interopRequireDefault(require("busboy"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}






function parseTranscriptionRequest(req) {
  return new Promise((resolve, reject) => {
    const bb = (0, _busboy.default)({ headers: req.headers });
    let provider = _env.config.transcription_provider;
    const files = [];
    let pending = 0;
    let ended = false;
    let failed = false;
    const done = () => {
      if (!failed && ended && pending === 0) {
        resolve({ provider, files });
      }
    };

    const uploadDir = _path.default.join(process.cwd(), 'storage', 'uploads');
    if (!_fs.default.existsSync(uploadDir)) {
      _fs.default.mkdirSync(uploadDir, { recursive: true });
    }

    bb.on('field', (name, value) => {
      if (name === 'provider') {
        provider = value;
      }
    });

    bb.on('file', (_name, file, info) => {
      pending++;
      const filename = info?.filename || 'audio';
      const mimeType = info?.mimeType || info?.mime || 'audio/webm';
      const filePath = _path.default.join(uploadDir, `${Date.now()}-${filename}`);
      const writeStream = _fs.default.createWriteStream(filePath);

      file.on('error', (e) => {
        failed = true;
        reject(e);
      });
      writeStream.on('error', (e) => {
        failed = true;
        reject(e);
      });
      writeStream.on('finish', () => {
        files.push({ path: filePath, filename, mimeType });
        pending--;
        done();
      });

      file.pipe(writeStream);
    });

    bb.on('error', (e) => {
      failed = true;
      reject(e);
    });
    bb.on('finish', () => {
      ended = true;
      done();
    });

    req.pipe(bb);
  });
}

function transcriberRoutes(app) {
  app.post("/transcriber", async (req, res) => {
    try {
      const contentType = req.headers['content-type'] || '';

      if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({
          ok: false,
          error: 'Content-Type must be multipart/form-data'
        });
      }

      const { provider, files } = await parseTranscriptionRequest(req);

      if (!files || files.length === 0) {
        return res.status(400).json({
          ok: false,
          error: 'No audio file provided'
        });
      }

      const audioFile = files[0];

      // Check if it's an audio file (or video, which often contains audio)
      if (!audioFile.mimeType.startsWith('audio/') && !audioFile.mimeType.startsWith('video/')) {
        return res.status(400).json({
          ok: false,
          error: 'File must be an audio or video file'
        });
      }

      console.log(`[transcriber] Processing ${audioFile.filename} with ${provider} provider`);

      const result = await (0, _transcriber.transcribeAudio)(audioFile.path, provider);

      // Clean up the temporary file
      try {
        _fs.default.unlinkSync(audioFile.path);
      } catch (e) {
        console.warn('Failed to delete temp file:', audioFile.path);
      }

      res.json({
        ok: true,
        transcription: result.text,
        provider: result.provider,
        duration: result.duration,
        confidence: result.confidence
      });

    } catch (error) {
      console.error('Transcription route error:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'Transcription failed'
      });
    }
  });
}