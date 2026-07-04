"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.defaultPolicy = defaultPolicy;exports.planTask = planTask;exports.planTasks = planTasks;exports.weeklyPlan = weeklyPlan;
var _ai = require("./ai");

const DAY_MS = 24 * 3600 * 1000;

function defaultPolicy(cram = false) {
  return { pomodoroMins: 25, breakMins: 5, maxDailyMins: cram ? 360 : 240, cram };
}

function planTask(task, policy) {
  const slots = (0, _ai.makeSlots)([task], policy);
  const taskSlots = slots.filter((s) => s.taskId === task.id);

  const plan = {
    slots: taskSlots,
    policy,
    lastPlannedAt: new Date().toISOString()
  };

  return { ...task, plan };
}

function planTasks(tasks, policy) {
  const allSlots = (0, _ai.makeSlots)(tasks, policy);

  return tasks.map((task) => {
    const taskSlots = allSlots.filter((s) => s.taskId === task.id);
    const plan = {
      slots: taskSlots,
      policy,
      lastPlannedAt: new Date().toISOString()
    };
    return { ...task, plan };
  });
}

function weeklyPlan(tasks, policy) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    days.push({ date: d.toISOString().slice(0, 10), slots: [] });
  }

  for (const task of tasks) {
    const taskSlots = task.plan?.slots || [];
    for (const slot of taskSlots) {
      const slotDate = new Date(slot.start);
      const dayIndex = Math.floor((slotDate.getTime() - start.getTime()) / DAY_MS);
      if (dayIndex >= 0 && dayIndex < 7) {
        days[dayIndex].slots.push(slot);
      }
    }
  }

  for (const day of days) {
    day.slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  return { days };
}