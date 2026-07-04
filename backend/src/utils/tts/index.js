"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.tts = void 0;var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _child_process = require("child_process");
var _nodeEdgeTts = require("node-edge-tts");
var googleTTS = _interopRequireWildcard(require("google-tts-api"));
var _env = require("../../config/env");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}




// @speech-sdk/core is ESM-only and this backend compiles to CJS, so the import() must survive tsc transpilation
const dynImport = new Function('s', 'return import(s)');

let sdkLoad = null;

function sdk() {
  if (!sdkLoad) {
    sdkLoad = Promise.all([dynImport('@speech-sdk/core'), dynImport('@speech-sdk/core/providers')]).then(([core, prov]) => ({
      generateConversation: core.generateConversation,
      factories: {
        cartesia: prov.createCartesia,
        deepgram: prov.createDeepgram,
        elevenlabs: prov.createElevenLabs,
        'fal-ai': prov.createFal,
        'fish-audio': prov.createFishAudio,
        google: prov.createGoogle,
        hume: prov.createHume,
        inworld: prov.createInworld,
        minimax: prov.createMiniMax,
        mistral: prov.createMistral,
        murf: prov.createMurf,
        openai: prov.createOpenAI,
        resemble: prov.createResemble,
        xai: prov.createXai
      }
    }));
  }
  return sdkLoad;
}

function ff(dir, parts, out, emit) {
  return new Promise((res, rej) => {
    const list = _path.default.join(dir, 'list.txt');
    const listContent = parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    _fs.default.writeFileSync(list, listContent);

    const bin = _env.config.ffmpeg || 'ffmpeg';

    const p = (0, _child_process.spawn)(bin, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-b:a', '192k', out], { stdio: 'pipe' });

    p.stderr.on('data', (d) => {
      const msg = String(d);
      emit && emit({ type: 'ffmpeg', data: msg });
    });

    p.on('close', (c) => {
      if (c === 0) {
        res(out);
      } else {
        rej(new Error('ffmpeg_failed'));
      }
    });

    p.on('error', (err) => {
      rej(err);
    });
  });
}

async function synth_edge(segs, dir, base, emit) {
  const v0 = _env.config.tts_voice_edge || 'en-US-AvaNeural';
  const v1 = _env.config.tts_voice_alt_edge || 'en-US-AndrewNeural';

  const files = [];

  async function convertSegmentWithRetry(seg, voice, outputFile, segmentIndex, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tts = new _nodeEdgeTts.EdgeTTS({
          voice: voice,
          lang: voice.split('-').slice(0, 2).join('-'),
          outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
          timeout: 15000
        });

        await tts.ttsPromise(seg.text, outputFile);

        const stats = _fs.default.statSync(outputFile);
        if (stats.size === 0) {
          throw new Error('Generated file is empty');
        }

        return;

      } catch (err) {
        lastError = err;

        if (attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff: 1s, 2s, 4s (max 5s)
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error(`Failed to convert segment ${segmentIndex + 1} after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const v = s.voice || (i % 2 ? v1 : v0);
    const f = _path.default.join(dir, `${base}.${i}.mp3`);

    await convertSegmentWithRetry(s, v, f, i);

    files.push(f);
    emit && emit({ type: 'audio_progress', i, len: segs.length });
  }

  const out = _path.default.join(dir, `${base}.mp3`);
  const result = await ff(dir, files, out, emit);
  return result;
}

async function synth_eleven(segs, dir, base, emit) {
  const k = _env.config.eleven_api_key || '';
  const v0 = _env.config.eleven_voice_a || '';
  const v1 = _env.config.eleven_voice_b || v0;
  const files = [];

  if (!k) throw new Error('eleven_api_key_missing');

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const v = s.voice || (i % 2 ? v1 : v0);
    if (!v) throw new Error('eleven_voice_missing');
    const f = _path.default.join(dir, `${base}.${i}.mp3`);

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v}`, {
      method: 'POST',
      headers: { 'xi-api-key': k, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: s.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.8 }
      })
    });
    if (!r.ok) throw new Error(`elevenlabs_http_${r.status}`);
    const b = new Uint8Array(await r.arrayBuffer());
    await _fs.default.promises.writeFile(f, b);
    files.push(f);
    emit && emit({ type: 'audio_progress', i, len: segs.length });
  }

  const out = _path.default.join(dir, `${base}.mp3`);
  return await ff(dir, files, out, emit);
}

async function synth_google(segs, dir, base, emit) {
  const creds = _env.config.google_creds || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!creds) throw new Error('google_creds_missing');

  const mod = await import('@google-cloud/text-to-speech');
  const TTS = mod.default || mod;
  const c = new TTS.TextToSpeechClient();
  const v0 = _env.config.tts_voice_google || 'en-US-Neural2-F';
  const v1 = _env.config.tts_voice_alt_google || 'en-US-Neural2-D';
  const files = [];

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const v = s.voice || (i % 2 ? v1 : v0);
    const [r] = await c.synthesizeSpeech({
      input: { text: s.text },
      voice: { languageCode: v.split('-').slice(0, 2).join('-'), name: v },
      audioConfig: { audioEncoding: 'MP3' }
    });
    const f = _path.default.join(dir, `${base}.${i}.mp3`);
    await _fs.default.promises.writeFile(f, r.audioContent);
    files.push(f);
    emit && emit({ type: 'audio_progress', i, len: segs.length });
  }

  const out = _path.default.join(dir, `${base}.mp3`);
  return await ff(dir, files, out, emit);
}

function sdk_model(m, factories) {
  // with SPEECHBASE_API_KEY set, the bare string routes every provider through the hosted gateway; otherwise call the provider directly with its own env key
  if (process.env.SPEECHBASE_API_KEY) return m;
  const i = m.indexOf('/');
  const provider = i === -1 ? m : m.slice(0, i);
  const modelId = i === -1 ? '' : m.slice(i + 1);
  const factory = factories[provider];
  if (!factory) throw new Error(`speechsdk_unknown_provider_${provider}`);
  return factory()(modelId || undefined);
}

async function synth_speechsdk(segs, dir, base, emit) {
  const { generateConversation, factories } = await sdk();
  const v0 = _env.config.speech_sdk_voice_a || 'alloy';
  const v1 = _env.config.speech_sdk_voice_b || 'echo';
  const model = sdk_model(_env.config.speech_sdk_model || 'openai/gpt-4o-mini-tts', factories);
  const turns = segs.map((s, i) => ({ text: s.text, voice: s.voice || (i % 2 ? v1 : v0) }));

  // one call renders the whole dialogue: native multi-speaker models when the provider has one, otherwise per-turn synthesis stitched and loudness-normalized (-20 dBFS) by the SDK, so no ffmpeg pass is needed
  const r = await generateConversation({ model, turns, output: { format: 'mp3' } });

  const out = _path.default.join(dir, `${base}.mp3`);
  await _fs.default.promises.writeFile(out, r.audio.uint8Array);
  emit && emit({ type: 'audio_progress', i: segs.length - 1, len: segs.length });
  return out;
}

async function synth_google_free(segs, dir, base, emit) {
  const files = [];

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    // google-tts-api only supports 'en' for English
    const chunks = await googleTTS.getAllAudioBase64(s.text, {
      lang: 'en',
      slow: i % 2 !== 0, // Differentiate speakers using playback speed
      host: 'https://translate.google.com',
      splitPunct: ',.?!'
    });

    const buffers = chunks.map((chunk) => Buffer.from(chunk.base64, 'base64'));
    const finalBuffer = Buffer.concat(buffers);

    const f = _path.default.join(dir, `${base}.${i}.mp3`);
    await _fs.default.promises.writeFile(f, finalBuffer);
    files.push(f);
    emit && emit({ type: 'audio_progress', i, len: segs.length });
  }

  const out = _path.default.join(dir, `${base}.mp3`);
  return await ff(dir, files, out, emit);
}

const tts = async (segs, dir, base, emit) => {
  const p = _env.config.tts_provider || 'google_free';

  if (p === 'edge') {
    return synth_edge(segs, dir, base, emit);
  } else if (p === 'eleven') {
    return synth_eleven(segs, dir, base, emit);
  } else if (p === 'google') {
    return synth_google(segs, dir, base, emit);
  } else if (p === 'speechsdk') {
    return synth_speechsdk(segs, dir, base, emit);
  } else if (p === 'google_free') {
    return synth_google_free(segs, dir, base, emit);
  } else {
    return synth_google_free(segs, dir, base, emit);
  }
};exports.tts = tts;