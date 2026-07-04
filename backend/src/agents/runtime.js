"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.execDirect = execDirect;require("./agents");
var _crypto = require("crypto");
var _registry = require("./registry");


async function withTimeout(p, ms, label) {
  if (!ms || ms <= 0) return p;
  let t;
  return await Promise.race([
  p.finally(() => clearTimeout(t)),
  new Promise((_, rej) => {t = setTimeout(() => rej(new Error(`timeout: ${label} exceeded ${ms}ms`)), ms);})]
  );
}

async function execDirect({ agent, plan, ctx }) {
  const ag = (0, _registry.get)(agent);
  if (!ag) throw new Error(`agent_not_found: ${agent}`);

  const threadId = (0, _crypto.randomBytes)(12).toString("hex");
  const trace = [];
  let last = null;

  for (let i = 0; i < (plan?.steps?.length || 0); i++) {
    const st = plan.steps[i] || {};
    const name = String(st.tool || "").trim();
    const input = st.input ?? {};
    const timeoutMs = Number.isFinite(st.timeoutMs) ? Number(st.timeoutMs) : 15000;
    const retries = Number.isFinite(st.retries) ? Math.min(2, Math.max(0, Number(st.retries))) : 0;

    const tool = ag.tools.find((t) => t.name === name);
    if (!tool) throw new Error(`tool_not_found: "${name}" | have=${JSON.stringify(ag.tools.map((t) => t.name))}`);

    let attempt = 0,ok = false,out,err;
    while (attempt <= retries && !ok) {
      try {
        out = await withTimeout(tool.run(input, ctx || {}), timeoutMs, name);
        ok = true;
      } catch (e) {
        err = e;
        attempt++;
        if (attempt > retries) throw e;
      }
    }

    trace.push({ step: i + 1, tool: name, input, output: out, err: err ? String(err) : null, retries: attempt });
    last = out;
  }

  return { trace, result: last, threadId };
}