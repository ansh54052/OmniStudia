"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.plannerRoutes = plannerRoutes;
var _service = require("../../services/planner/service");

var _ws = require("../../utils/chat/ws");

var _upload = require("../../lib/parser/upload");
var _crypto = _interopRequireDefault(require("crypto"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const rooms = new Map();
const log = (...a) => console.log("[planner]", ...a);

function plannerRoutes(app) {
  app.ws("/ws/planner", (ws, req) => {
    const u = new URL(req.url, "http://localhost");
    const sid = u.searchParams.get("sid") || "default";
    let set = rooms.get(sid);
    if (!set) {set = new Set();rooms.set(sid, set);}
    set.add(ws);
    ws.send(JSON.stringify({ type: "ready", sid }));
    ws.on("close", () => {set.delete(ws);if (set.size === 0) rooms.delete(sid);});
  });

  app.post("/tasks", async (req, res) => {
    try {
      const ct = req.headers['content-type'] || '';
      const isMultipart = ct.includes("multipart/form-data");

      if (isMultipart) {
        const { q: text, files } = await (0, _upload.parseMultipart)(req);
        const request = { text, files };
        const task = await _service.plannerService.createTaskFromRequest(request);
        res.send({ ok: true, task });
        (0, _ws.emitToAll)(rooms.get("default"), { type: "task.created", task });
      } else {
        const request = req.body;
        const task = await _service.plannerService.createTaskFromRequest(request);
        res.send({ ok: true, task });
        (0, _ws.emitToAll)(rooms.get("default"), { type: "task.created", task });
      }
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/tasks/ingest", async (req, res) => {
    try {
      const text = String(req.body?.text || "").trim();
      if (!text) return res.status(400).send({ ok: false, error: "text required" });
      const task = await _service.plannerService.createTaskFromRequest({ text });
      res.send({ ok: true, task });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "task.created", task });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.get("/tasks/:id", async (req, res) => {
    try {
      const task = await _service.plannerService.getTask(req.params.id);
      if (!task) return res.status(404).send({ ok: false, error: "Task not found" });
      res.send({ ok: true, task });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/tasks/:id/replan", async (req, res) => {
    try {
      const task = await _service.plannerService.replanTask(req.params.id);
      if (!task) return res.status(404).send({ ok: false, error: "Task not found" });
      res.send({ ok: true, task });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "plan.update", taskId: task.id, slots: task.plan?.slots || [] });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/tasks/:id/plan", async (req, res) => {
    try {
      console.log('Planning task:', req.params.id);
      const task = await _service.plannerService.planSingleTask(req.params.id);
      if (!task) {
        console.log('Task not found:', req.params.id);
        return res.status(404).send({ ok: false, error: "Task not found" });
      }

      console.log('Task planned successfully:', task.id, 'Steps:', task.steps?.length);
      res.send({ ok: true, task });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "plan.update", taskId: task.id, slots: task.plan?.slots || [] });
    } catch (e) {
      console.error('Plan task error:', e);
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/planner/weekly", async (req, res) => {
    try {
      const request = req.body;
      const result = await _service.plannerService.generateWeeklyPlan(request);
      res.send({ ok: true, ...result });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "weekly.update", plan: result.plan });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.get("/planner/today", async (req, res) => {
    try {
      const sessions = await _service.plannerService.getTodaySessions();
      res.send({ ok: true, sessions });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.get("/planner/deadlines", async (req, res) => {
    try {
      const deadlines = await _service.plannerService.getUpcomingDeadlines();
      res.send({ ok: true, ...deadlines });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.get("/planner/stats", async (req, res) => {
    try {
      const stats = await _service.plannerService.getUserStats();
      res.send({ ok: true, stats });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/tasks/:id/materials", async (req, res) => {
    try {
      const id = req.params.id;
      const request = { type: req.body?.type || "summary" };
      (0, _ws.emitToAll)(rooms.get("default"), { type: "phase", value: "assist" });
      const materials = await _service.plannerService.generateMaterials(id, request);
      await (0, _ws.emitLarge)(rooms.get("default"), "materials", { taskId: id, type: request.type, data: materials }, { gzip: true });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "done", taskId: id });
      res.send({ ok: true, materials });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.patch("/slots/:taskId/:slotId", async (req, res) => {
    try {
      const { taskId, slotId } = req.params;
      const { done, skip } = req.body;
      const task = await _service.plannerService.updateSlot(taskId, slotId, { done, skip });
      if (!task) return res.status(404).send({ ok: false, error: "Task or slot not found" });
      res.send({ ok: true, task });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "slot.update", taskId, slotId, done, skip });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.get("/tasks", async (req, res) => {
    try {
      const { status, dueBefore, course } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (dueBefore) filter.dueBefore = dueBefore;
      if (course) filter.course = course;

      const tasks = await _service.plannerService.listTasks(filter);
      res.send({ ok: true, tasks });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.patch("/tasks/:id", async (req, res) => {
    try {
      const updates = req.body;
      const task = await _service.plannerService.updateTask(req.params.id, updates);
      if (!task) return res.status(404).send({ ok: false, error: "Task not found" });
      res.send({ ok: true, task });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "task.updated", task });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.delete("/tasks/:id", async (req, res) => {
    try {
      const success = await _service.plannerService.deleteTask(req.params.id);
      if (!success) return res.status(404).send({ ok: false, error: "Task not found" });
      res.send({ ok: true });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "task.deleted", taskId: req.params.id });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/tasks/:id/files", async (req, res) => {
    try {
      const ct = req.headers['content-type'] || '';
      if (!ct.includes("multipart/form-data")) {
        return res.status(400).send({ ok: false, error: "multipart/form-data required" });
      }

      const { files } = await (0, _upload.parseMultipart)(req);
      if (!files || files.length === 0) {
        return res.status(400).send({ ok: false, error: "no files uploaded" });
      }

      const taskId = req.params.id;
      const uploadedFiles = await _service.plannerService.addFilesToTask(taskId, files);
      res.send({ ok: true, files: uploadedFiles });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "task.files.added", taskId, files: uploadedFiles });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.delete("/tasks/:id/files/:fileId", async (req, res) => {
    try {
      const success = await _service.plannerService.removeFileFromTask(req.params.id, req.params.fileId);
      if (!success) return res.status(404).send({ ok: false, error: "File not found" });
      res.send({ ok: true });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "task.file.removed", taskId: req.params.id, fileId: req.params.fileId });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/sessions/start", async (req, res) => {
    try {
      const { taskId, slotId } = req.body;
      if (!taskId) return res.status(400).send({ ok: false, error: "taskId required" });

      const session = {
        id: _crypto.default.randomUUID(),
        taskId,
        slotId,
        startedAt: new Date().toISOString(),
        status: 'active'
      };

      res.send({ ok: true, session });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "session.started", session });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/sessions/:id/stop", async (req, res) => {
    try {
      const sessionId = req.params.id;
      const { minutesWorked, completed } = req.body;

      const session = {
        id: sessionId,
        endedAt: new Date().toISOString(),
        minutesWorked: minutesWorked || 0,
        completed: completed || false,
        status: 'completed'
      };

      res.send({ ok: true, session });
      (0, _ws.emitToAll)(rooms.get("default"), { type: "session.ended", session });
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/reminders/schedule", async (req, res) => {
    try {
      const { text, scheduledFor, taskId } = req.body;
      if (!text || !scheduledFor) {
        return res.status(400).send({ ok: false, error: "text and scheduledFor required" });
      }

      const reminder = {
        id: _crypto.default.randomUUID(),
        text,
        taskId,
        scheduledFor,
        createdAt: new Date().toISOString()
      };

      res.send({ ok: true, reminder });

      const delayMs = new Date(scheduledFor).getTime() - Date.now();
      if (delayMs > 0) {
        setTimeout(() => {
          (0, _ws.emitToAll)(rooms.get("default"), {
            type: "reminder",
            id: reminder.id,
            text: reminder.text,
            taskId: reminder.taskId,
            scheduledFor: reminder.scheduledFor
          });
        }, delayMs);
      }
    } catch (e) {
      res.status(500).send({ ok: false, error: e?.message || "failed" });
    }
  });

  app.post("/reminders/test", async (_req, res) => {
    (0, _ws.emitToAll)(rooms.get("default"), { type: "reminder", text: "Test reminder", at: Date.now() + 60000 });
    res.send({ ok: true });
  });
}

let lastDigest = "";
let lastBreakReminder = 0;

setInterval(async () => {
  try {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const today = now.toISOString().slice(0, 10);

    if (hh === 8 && mm < 5 && lastDigest !== today) {
      lastDigest = today;
      const tomorrow = new Date(today + "T23:59:59Z").toISOString();
      const tasks = await _service.plannerService.listTasks({ dueBefore: tomorrow });
      const dueToday = tasks.filter((t) => new Date(t.dueAt).toDateString() === new Date(today).toDateString());
      const todaySessions = await _service.plannerService.getTodaySessions();

      (0, _ws.emitToAll)(rooms.get("default"), {
        type: "daily.digest",
        date: today,
        due: dueToday.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt })),
        sessions: todaySessions.length,
        message: `Good morning! You have ${dueToday.length} tasks due today and ${todaySessions.length} sessions planned.`
      });
    }

    if (hh >= 9 && hh <= 18 && mm < 5) {
      const currentHour = now.getTime();
      if (currentHour - lastBreakReminder > 2 * 60 * 60 * 1000) {
        lastBreakReminder = currentHour;
        (0, _ws.emitToAll)(rooms.get("default"), {
          type: "break.reminder",
          text: "Time for a break! Consider taking 5-10 minutes to rest your eyes and stretch.",
          at: now.toISOString()
        });
      }
    }

    // Evening review at 8 PM
    if (hh === 20 && mm < 5) {
      const stats = await _service.plannerService.getUserStats();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const tomorrowTasks = await _service.plannerService.listTasks({
        status: 'todo',
        dueBefore: new Date(tomorrow + "T23:59:59Z").toISOString()
      });

      (0, _ws.emitToAll)(rooms.get("default"), {
        type: "evening.review",
        date: today,
        stats,
        tomorrowTasks: tomorrowTasks.slice(0, 3).map((t) => ({ id: t.id, title: t.title })),
        message: `Today's recap: ${stats.completedTasks} tasks completed. Tomorrow you have ${tomorrowTasks.length} tasks planned.`
      });
    }
  } catch {}
}, 60000);