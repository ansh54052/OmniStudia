"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.plannerService = exports.PlannerService = void 0;
var _store = require("./store");
var _ai = require("./ai");
var _scheduler = require("./scheduler");
var _ask = require("../../lib/ai/ask");
var _crypto = _interopRequireDefault(require("crypto"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

class PlannerService {


  constructor(policy) {
    this.policy = policy || (0, _scheduler.defaultPolicy)();
  }

  async createTaskFromRequest(req) {
    let taskData;

    if (req.text) {
      taskData = await (0, _ai.parseTask)(req.text);

      if (req.course) taskData.course = req.course;
      if (req.title) taskData.title = req.title;
      if (req.type) taskData.type = req.type;
      if (req.notes) taskData.notes = req.notes;
      if (req.dueAt) taskData.dueAt = req.dueAt;
      if (req.estMins) taskData.estMins = req.estMins;
      if (req.priority) taskData.priority = req.priority;
    } else {
      taskData = {
        title: req.title || "Untitled Task",
        course: req.course,
        type: req.type,
        notes: req.notes,
        dueAt: req.dueAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        estMins: req.estMins || 60,
        priority: req.priority || 3
      };
    }

    const tempTask = { ...taskData, id: 'temp' };
    const steps = await (0, _ai.generateSteps)(tempTask);
    taskData.steps = steps;

    const task = await (0, _store.createTask)({
      title: taskData.title || "Untitled Task",
      course: taskData.course,
      type: taskData.type,
      notes: taskData.notes,
      dueAt: taskData.dueAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      estMins: taskData.estMins || 60,
      priority: taskData.priority || 3,
      status: 'todo',
      steps: taskData.steps
    });

    if (req.files && req.files.length > 0) {
      await this.addFilesToTask(task.id, req.files);
      const updatedTask = await (0, _store.getTask)(task.id);
      return updatedTask || task;
    }

    return task;
  }

  async getTask(id) {
    return (0, _store.getTask)(id);
  }

  async updateTask(id, req) {
    const existing = await (0, _store.getTask)(id);
    if (!existing) return null;

    let steps = existing.steps;
    if (req.title || req.type || req.notes) {
      const updatedTask = { ...existing, ...req };
      steps = await (0, _ai.generateSteps)(updatedTask);
    }

    return (0, _store.updateTask)(id, { ...req, steps });
  }

  async deleteTask(id) {
    return (0, _store.deleteTask)(id);
  }

  async listTasks(filter) {
    return (0, _store.listTasks)(filter);
  }

  async planSingleTask(taskId) {
    const task = await (0, _store.getTask)(taskId);
    if (!task) return null;

    const plannedTask = (0, _scheduler.planTask)(task, this.policy);
    await (0, _store.updateTask)(taskId, { plan: plannedTask.plan });

    return plannedTask;
  }

  async generateWeeklyPlan(req) {
    const policy = { ...this.policy, ...req?.policy };

    const tasks = await (0, _store.listTasks)({ status: 'todo' });

    const plannedTasks = (0, _scheduler.planTasks)(tasks, policy);

    for (const task of plannedTasks) {
      await (0, _store.updateTask)(task.id, { plan: task.plan });
    }

    const plan = (0, _scheduler.weeklyPlan)(plannedTasks, policy);

    return { tasks: plannedTasks, plan };
  }

  async getTodaySessions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const tasks = await (0, _store.listTasks)({ status: 'todo' });
    const todaySessions = [];

    for (const task of tasks) {
      if (!task.plan?.slots) continue;

      const todaySlots = task.plan.slots.filter((slot) => {
        const slotDate = new Date(slot.start);
        return slotDate >= today && slotDate < tomorrow;
      });

      if (todaySlots.length > 0) {
        todaySessions.push({ task, slots: todaySlots });
      }
    }

    return todaySessions.sort((a, b) => {
      const aStart = new Date(a.slots[0].start).getTime();
      const bStart = new Date(b.slots[0].start).getTime();
      return aStart - bStart;
    });
  }

  async updateSlot(taskId, slotId, updates) {
    const task = await (0, _store.getTask)(taskId);
    if (!task?.plan?.slots) return null;

    const slotIndex = task.plan.slots.findIndex((s) => s.id === slotId);
    if (slotIndex === -1) return null;

    const updatedSlots = [...task.plan.slots];
    updatedSlots[slotIndex] = {
      ...updatedSlots[slotIndex],
      done: updates.done
    };

    if (updates.skip) {
      await this.replanTask(taskId);
      return (0, _store.getTask)(taskId);
    }

    const updatedPlan = { ...task.plan, slots: updatedSlots };
    return (0, _store.updateTask)(taskId, { plan: updatedPlan });
  }

  async replanTask(taskId) {
    const task = await (0, _store.getTask)(taskId);
    if (!task?.plan) return null;

    const now = new Date();
    const missedSlots = task.plan.slots.filter((s) => new Date(s.end) < now && !s.done);
    const remainingSlots = task.plan.slots.filter((s) => new Date(s.start) >= now);

    const allTasks = await (0, _store.listTasks)({ status: 'todo' });

    const newSlots = (0, _ai.replan)(missedSlots, remainingSlots, allTasks, task.plan.policy);
    const taskSlots = newSlots.filter((s) => s.taskId === taskId);

    const updatedPlan = {
      ...task.plan,
      slots: taskSlots,
      lastPlannedAt: new Date().toISOString()
    };

    return (0, _store.updateTask)(taskId, { plan: updatedPlan });
  }

  async generateMaterials(taskId, req) {
    const task = await (0, _store.getTask)(taskId);
    if (!task) throw new Error('Task not found');

    const content = `${task.title}\n${task.notes || ''}\nSteps: ${task.steps?.join(', ') || ''}`;

    switch (req.type) {
      case 'summary':
        return this.generateSummary(content);
      case 'studyGuide':
        return this.generateStudyGuide(content, task);
      case 'flashcards':
        return this.generateFlashcards(content, task);
      case 'quiz':
        return this.generateQuiz(content, task);
      default:
        throw new Error('Invalid material type');
    }
  }

  async generateSummary(content) {
    const prompt = `Create a clear, concise summary of this study material that highlights the key concepts and important points:`;
    const response = await (0, _ask.handleAsk)(prompt + '\n\n' + content);
    return response.answer;
  }

  async generateStudyGuide(content, task) {
    const prompt = `Create a comprehensive study guide for this ${task.type || 'assignment'}. Include:
        - Key concepts and definitions
        - Important formulas or principles
        - Practice questions
        - Study tips specific to this topic

        Format as a structured guide with clear sections:`;

    const response = await (0, _ask.handleAsk)(prompt + '\n\n' + content);
    return response.answer;
  }

  async generateFlashcards(content, task) {
    const prompt = `Create 10-15 flashcards for this ${task.type || 'assignment'}. 
        Return as JSON array with "front" and "back" properties.
        Focus on key concepts, definitions, formulas, and important facts.
        
        Example format:
        [
          {"front": "What is the derivative of x^2?", "back": "2x"},
          {"front": "Define photosynthesis", "back": "The process by which plants convert light energy into chemical energy"}
        ]`;

    try {
      const response = await (0, _ask.handleAsk)(prompt + '\n\n' + content);
      return JSON.parse(response.answer);
    } catch (error) {
      console.warn('Failed to parse flashcards JSON, returning default');
      return [
      { front: `Key concept from ${task.title}`, back: 'Review the main material' }];

    }
  }

  async generateQuiz(content, task) {
    const prompt = `Create a 5-question quiz for this ${task.type || 'assignment'}.
        Include multiple choice and short answer questions.
        Focus on testing understanding of key concepts.`;

    const response = await (0, _ask.handleAsk)(prompt + '\n\n' + content);
    return response.answer;
  }

  async getUpcomingDeadlines() {
    const tasks = await (0, _store.listTasks)({ status: 'todo' });
    const now = new Date();

    const urgent = [];
    const atRisk = [];
    const upcoming = [];

    for (const task of tasks) {
      const deadline = new Date(task.dueAt);
      const hoursToDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      const hasScheduledWork = task.plan?.slots?.some((s) => new Date(s.start) >= now);

      if (hoursToDeadline < 24) {
        urgent.push(task);
      } else if (hoursToDeadline < 72 && !hasScheduledWork) {
        atRisk.push(task);
      } else if (hoursToDeadline < 168) {
        upcoming.push(task);
      }
    }

    return { urgent, atRisk, upcoming };
  }

  async getUserStats() {
    const allTasks = await (0, _store.listTasks)();
    const completedTasks = allTasks.filter((t) => t.status === 'done');

    const totalPlannedMinutes = allTasks.reduce((sum, task) => {
      return sum + (task.plan?.slots?.length || 0) * this.policy.pomodoroMins;
    }, 0);

    const completedMinutes = completedTasks.reduce((sum, task) => {
      const completedSlots = task.plan?.slots?.filter((s) => s.done) || [];
      return sum + completedSlots.length * this.policy.pomodoroMins;
    }, 0);

    const onTimeCompletions = completedTasks.filter((task) => {
      return new Date(task.updatedAt) <= new Date(task.dueAt);
    }).length;

    return {
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      totalPlannedMinutes,
      completedMinutes,
      onTimeRatio: completedTasks.length > 0 ? onTimeCompletions / completedTasks.length : 0,
      averageEstimateAccuracy: this.calculateEstimateAccuracy(completedTasks)
    };
  }

  async addFilesToTask(taskId, files) {
    const task = await (0, _store.getTask)(taskId);
    if (!task) throw new Error("Task not found");

    const { saveTaskFile } = await import("./store");
    const uploadedFiles = [];

    for (const file of files) {
      const taskFile = {
        id: _crypto.default.randomUUID(),
        taskId,
        filename: file.filename,
        originalName: file.filename,
        mimeType: file.mimeType,
        size: require('fs').statSync(file.path).size,
        uploadedAt: new Date().toISOString()
      };

      await saveTaskFile(taskFile);
      uploadedFiles.push(taskFile);
    }

    return uploadedFiles;
  }

  async removeFileFromTask(taskId, fileId) {
    const task = await (0, _store.getTask)(taskId);
    if (!task) return false;

    const { deleteTaskFile } = await import("./store");
    try {
      await deleteTaskFile(fileId);
      return true;
    } catch {
      return false;
    }
  }

  calculateEstimateAccuracy(completedTasks) {
    if (completedTasks.length === 0) return 1.0;

    let totalAccuracy = 0;
    let validTasks = 0;

    for (const task of completedTasks) {
      if (task.metrics?.minutesSpent && task.estMins > 0) {
        const accuracy = Math.min(task.estMins / task.metrics.minutesSpent, 2);
        totalAccuracy += accuracy;
        validTasks++;
      }
    }

    return validTasks > 0 ? totalAccuracy / validTasks : 1.0;
  }
}exports.PlannerService = PlannerService;

const plannerService = exports.plannerService = new PlannerService();