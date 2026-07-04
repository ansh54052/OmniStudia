"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.createTask = createTask;exports.deleteTask = deleteTask;exports.deleteTaskFile = deleteTaskFile;exports.deleteTaskFiles = deleteTaskFiles;exports.getTask = getTask;exports.getTaskFiles = getTaskFiles;exports.listTasks = listTasks;exports.saveTaskFile = saveTaskFile;exports.updateTask = updateTask;var _crypto = _interopRequireDefault(require("crypto"));

var _Planner = require("../../models/Planner");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

async function createTask(t) {
  const id = _crypto.default.randomUUID();
  const now = new Date().toISOString();
  const task = new _Planner.PlannerTask({ ...t, id, createdAt: now, updatedAt: now });
  await task.save();
  return task.toObject();
}

async function getTask(id) {
  const task = await _Planner.PlannerTask.findOne({ id }).lean().exec();
  if (task) {
    task.files = await getTaskFiles(id);
  }
  return task;
}

async function updateTask(id, patch) {
  const now = new Date().toISOString();
  const updated = await _Planner.PlannerTask.findOneAndUpdate(
    { id },
    { $set: { ...patch, updatedAt: now } },
    { new: true }
  ).lean().exec();
  return updated;
}

async function deleteTask(id) {
  await _Planner.PlannerTask.deleteOne({ id }).exec();
  await _Planner.PlannerTaskFile.deleteMany({ taskId: id }).exec();
  return true;
}

async function listTasks(filter) {
  const query = {};
  if (filter?.status) query.status = filter.status;
  if (filter?.course) query.course = filter.course;
  // Note: If dueBefore needs to be handled via DB, you could parse it, but for simplicity we filter in JS like before if dueAt is stored as string.

  let tasks = await _Planner.PlannerTask.find(query).lean().exec();

  if (filter?.dueBefore) {
    tasks = tasks.filter((t) => new Date(t.dueAt) <= new Date(filter.dueBefore));
  }

  return tasks.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

async function saveTaskFile(file) {
  const f = new _Planner.PlannerTaskFile({ ...file });
  await f.save();
}

async function getTaskFiles(taskId) {
  return await _Planner.PlannerTaskFile.find({ taskId }).lean().exec();
}

async function deleteTaskFile(id) {
  await _Planner.PlannerTaskFile.deleteOne({ id }).exec();
}

async function deleteTaskFiles(taskId) {
  await _Planner.PlannerTaskFile.deleteMany({ taskId }).exec();
}