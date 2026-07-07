import { env } from "../config/env";















































































const timeoutCtl = (ms) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

async function req(
url,
init = {})
{
  const { timeout = env.timeout, ...rest } = init;
  const { signal, done } = timeoutCtl(timeout);
  try {
    const r = await fetch(url, { signal, ...rest });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`http ${r.status}: ${txt || r.statusText}`);
    }
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await r.json();
    return await r.text();
  } finally {
    done();
  }
}

const jsonHeaders = (_) => {
  const h = new Headers();
  h.set("content-type", "application/json");
  return h;
};

function wsURL(path) {
  const u = new URL(env.backend);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}${path}`;
}

export async function chatJSON(body) {
  return req(`${env.backend}/chat`, {
    method: "POST",
    headers: jsonHeaders({}),
    body: JSON.stringify(body)
  });
}

export async function chatMultipart(q, files, chatId) {
  const f = new FormData();
  f.append("q", q);
  if (chatId) f.append("chatId", chatId);
  for (const file of files) f.append("file", file, file.name);
  return req(`${env.backend}/chat`, {
    method: "POST",
    body: f,
    timeout: Math.max(env.timeout, 300000)
  });
}

export function connectChatStream(chatId, onEvent) {
  const url = wsURL(`/ws/chat?chatId=${encodeURIComponent(chatId)}`);
  const ws = new WebSocket(url);
  ws.onmessage = (m) => {
    try {
      const data = JSON.parse(m.data);
      onEvent(data);
    } catch {}
  };
  ws.onerror = () => {
    onEvent({ type: "error", error: "stream_error" });
  };
  return { ws, close: () => {try {ws.close();} catch {}} };
}

export async function chatAskOnce(opts)




{
  const { q, files = [], chatId, onEvent } = opts;
  const start = files.length ? await chatMultipart(q, files, chatId) : await chatJSON({ q, chatId });
  let answer = "";
  let flashcards;

  await new Promise((resolve, reject) => {
    const { close } = connectChatStream(start.chatId, (ev) => {
      onEvent?.(ev);
      if (ev.type === "answer") {
        const p = ev.answer;
        if (typeof p === "string") {
          answer = p;
        } else if (p && typeof p === "object") {
          answer = p.answer ?? "";
          if (Array.isArray(p.flashcards)) flashcards = p.flashcards;
        }
      }
      if (ev.type === "done") {close();resolve();}
      if (ev.type === "error") {close();reject(new Error(ev.error || "chat failed"));}
    });
  });

  return { chatId: start.chatId, answer, flashcards };
}

export async function companionAsk(input)






{
  const question = (input.question || "").trim();
  if (!question) throw new Error("Question is required");

  const payload = { question };
  if (input.filePath) payload.filePath = input.filePath;
  if (input.documentText) payload.documentText = input.documentText;
  if (input.documentTitle) payload.documentTitle = input.documentTitle;
  if (input.topic) payload.topic = input.topic;
  if (input.history && input.history.length) {
    payload.history = input.history.map((h) => ({ role: h.role, content: h.content }));
  }

  return req(`${env.backend}/api/companion/ask`, {
    method: "POST",
    headers: jsonHeaders({}),
    body: JSON.stringify(payload),
    timeout: Math.max(env.timeout, 120000)
  });
}

export function getChats() {
  return req(`${env.backend}/chats`, { method: "GET" });
}

export function getChatDetail(id) {
  return req(`${env.backend}/chats/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createFlashcard(input)



{
  return req(`${env.backend}/flashcards`, {
    method: "POST",
    headers: jsonHeaders({}),
    body: JSON.stringify(input)
  });
}

export async function listFlashcards() {
  return req(`${env.backend}/flashcards`, {
    method: "GET"
  });
}

export async function deleteFlashcard(id) {
  return req(`${env.backend}/flashcards/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function getExams() {
  return req(
    `${env.backend}/exams`,
    { method: "GET" }
  );
}

export async function startExam(examId) {
  return req(
    `${env.backend}/exam`,
    {
      method: "POST",
      headers: jsonHeaders({}),
      body: JSON.stringify({ examId })
    }
  );
}

export function connectExamStream(runId, onEvent) {
  const url = wsURL(`/ws/exams?runId=${encodeURIComponent(runId)}`);
  const ws = new WebSocket(url);
  ws.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data));
    } catch {}
  };
  ws.onerror = () => onEvent({ type: "error", error: "stream_error" });
  return { ws, close: () => {try {ws.close();} catch {}} };
}

export async function smartnotesStart(input) {
  return req(`${env.backend}/smartnotes`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input)
  });
}

export function connectSmartnotesStream(noteId, onEvent) {
  const url = wsURL(`/ws/smartnotes?noteId=${encodeURIComponent(noteId)}`);
  const ws = new WebSocket(url);
  ws.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data));
    } catch {}
  };
  ws.onerror = () => onEvent({ type: "error", error: "stream_error" });
  return { ws, close: () => {try {ws.close();} catch {}} };
}

export function flashcards(topic) {
  return req(`${env.backend}/flashcards`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ topic })
  });
}

export async function quizStart(topic) {
  return req(`${env.backend}/quiz`, {
    method: "POST",
    headers: jsonHeaders({}),
    body: JSON.stringify({ topic })
  }
  );
}

export async function podcastStart(payload) {
  const url = `${env.backend}/podcast`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to start podcast");
  return data;
}

export function connectPodcastStream(pid, onEvent) {
  const wsUrl = `${env.backend.replace(/^http/, "ws")}/ws/podcast?pid=${pid}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      onEvent(msg);
    } catch (err) {
      onEvent({ type: "error", error: "invalid_message" });
    }
  };

  ws.onclose = (e) => {
  };

  ws.onerror = () => onEvent({ type: "error", error: "stream_error" });
  return { ws, close: () => {try {ws.close();} catch {}} };
}

export function connectQuizStream(quizId, onEvent) {
  const url = wsURL(`/ws/quiz?quizId=${encodeURIComponent(quizId)}`);
  const ws = new WebSocket(url);ws.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data));
    } catch {}
  };ws.onerror = () => onEvent({ type: "error", error: "stream_error" });return { ws, close: () => {try {ws.close();} catch {}} };
}

export async function transcribeAudio(file) {
  const formData = new FormData();
  formData.append('file', file);

  return req(`${env.backend}/transcriber`, {
    method: 'POST',
    body: formData,
    timeout: Math.max(env.timeout, 180000)
  });
}










































export async function plannerIngest(text) {
  return req(`${env.backend}/tasks/ingest`, {
    method: "POST",
    headers: jsonHeaders({}),
    body: JSON.stringify({ text })
  });
}

export async function plannerList(params) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.dueBefore) q.set("dueBefore", String(params.dueBefore));
  if (params?.course) q.set("course", params.course);
  const url = `${env.backend}/tasks${q.toString() ? `?${q}` : ""}`;
  return req(url, { method: "GET" });
}

export async function plannerPlan(id, cram) {
  return req(`${env.backend}/tasks/${encodeURIComponent(id)}/plan`, {
    method: "POST",
    headers: jsonHeaders({}),
    body: JSON.stringify({ cram: !!cram })
  });
}

export async function plannerWeekly(cram) {
  return req(`${env.backend}/planner/weekly`, {
    method: "POST",
    headers: jsonHeaders({}),
    body: JSON.stringify({ cram: !!cram })
  });
}

export async function plannerMaterials(id, kind) {
  return req(`${env.backend}/tasks/${encodeURIComponent(id)}/materials`, {
    method: "POST",
    headers: jsonHeaders({}),
    body: JSON.stringify({ kind })
  });
}

export function connectPlannerStream(sid, onEvent) {
  const url = wsURL(`/ws/planner?sid=${encodeURIComponent(sid)}`);
  const ws = new WebSocket(url);
  ws.onmessage = (m) => {
    try {
      const ev = JSON.parse(m.data);
      onEvent(ev);
    } catch {}
  };
  ws.onerror = () => {/* ignore for now */};
  return { ws, close: () => {try {ws.close();} catch {}} };
}

export async function plannerUpdate(id, patch) {
  return req(`${env.backend}/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders({}),
    body: JSON.stringify(patch)
  });
}

export async function plannerDelete(id) {
  return req(`${env.backend}/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function plannerCreateWithFiles(data) {
  const formData = new FormData();
  if (data.text) formData.append('q', data.text);
  if (data.title) formData.append('title', data.title);
  if (data.course) formData.append('course', data.course);
  if (data.type) formData.append('type', data.type);
  if (data.files) {
    for (const file of data.files) {
      formData.append('file', file, file.name);
    }
  }

  return req(`${env.backend}/tasks`, {
    method: "POST",
    body: formData,
    timeout: Math.max(env.timeout, 300000)
  });
}

export async function plannerUploadFiles(taskId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('file', file, file.name);
  }

  return req(`${env.backend}/tasks/${encodeURIComponent(taskId)}/files`, {
    method: "POST",
    body: formData,
    timeout: Math.max(env.timeout, 300000)
  });
}

export async function plannerDeleteFile(taskId, fileId) {
  return req(`${env.backend}/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE"
  });
}


























export async function startDebate(topic, position) {
  return req(`${env.backend}/debate/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, position }),
    timeout: 30000
  });
}

export async function submitDebateArgument(debateId, argument) {
  return req(`${env.backend}/debate/${encodeURIComponent(debateId)}/argue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ argument }),
    timeout: 120000
  });
}

export async function getDebateSession(debateId) {
  return req(`${env.backend}/debate/${encodeURIComponent(debateId)}`, {
    method: "GET"
  });
}

export async function listDebates() {
  return req(`${env.backend}/debates`, {
    method: "GET"
  });
}

export async function deleteDebate(debateId) {
  return req(`${env.backend}/debate/${encodeURIComponent(debateId)}`, {
    method: "DELETE"
  });
}

export async function surrenderDebate(debateId) {
  return req(`${env.backend}/debate/${encodeURIComponent(debateId)}/surrender`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
}












export async function analyzeDebate(debateId) {
  return req(`${env.backend}/debate/${encodeURIComponent(debateId)}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    timeout: 60000
  });
}

export function err(e) {
  return e instanceof Error ? e.message : String(e);
}