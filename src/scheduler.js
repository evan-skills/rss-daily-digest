const fs = require('fs').promises;
const crypto = require('crypto');
const cron = require('node-cron');
const { SCHEDULES_PATH, DEFAULT_HOURS } = require('./config');
const { atomicWrite } = require('./store');
const { runDigest } = require('./runner');

// 内存中活跃的 cron 任务：id -> ScheduledTask
const activeTasks = new Map();

async function loadSchedules() {
  try {
    const raw = await fs.readFile(SCHEDULES_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function persist(schedules) {
  await atomicWrite(SCHEDULES_PATH, JSON.stringify(schedules, null, 2));
}

// 执行一个调度任务，更新 lastRun 状态
async function executeSchedule(schedule) {
  console.log(`⏰ 执行调度任务 [${schedule.name || schedule.id}]`);
  const lastRun = { at: new Date().toISOString() };
  try {
    const result = await runDigest({ hours: schedule.hours, sendEmail: schedule.sendEmail });
    lastRun.status = 'success';
    lastRun.digestId = result.id;
    lastRun.totalArticles = result.digest.totalArticles;
    lastRun.emailed = result.emailed;
    if (result.emailError) lastRun.emailError = result.emailError;
  } catch (err) {
    lastRun.status = 'error';
    lastRun.error = err.message;
    console.error(`调度任务失败 [${schedule.id}]: ${err.message}`);
  }

  // 回写 lastRun（重新读取以避免覆盖并发修改）
  try {
    const schedules = await loadSchedules();
    const idx = schedules.findIndex((s) => s.id === schedule.id);
    if (idx !== -1) {
      schedules[idx].lastRun = lastRun;
      await persist(schedules);
    }
  } catch (err) {
    console.error(`回写 lastRun 失败: ${err.message}`);
  }
  return lastRun;
}

function stopTask(id) {
  const task = activeTasks.get(id);
  if (task) {
    task.stop();
    activeTasks.delete(id);
  }
}

// 注册（或重新注册）一个 cron 任务
function registerTask(schedule) {
  stopTask(schedule.id);
  if (!schedule.enabled) return;
  if (!cron.validate(schedule.cron)) {
    console.error(`跳过无效 cron 表达式 [${schedule.id}]: ${schedule.cron}`);
    return;
  }
  const task = cron.schedule(schedule.cron, () => {
    executeSchedule(schedule).catch((e) => console.error(e));
  });
  activeTasks.set(schedule.id, task);
}

// server 启动时调用：加载全部调度并注册
async function initScheduler() {
  const schedules = await loadSchedules();
  schedules.forEach(registerTask);
  console.log(`✅ 已加载 ${schedules.length} 个调度任务，其中启用 ${activeTasks.size} 个`);
}

// ---- CRUD ----
async function listSchedules() {
  return loadSchedules();
}

async function addSchedule({ name, cron: cronExpr, hours = DEFAULT_HOURS, sendEmail = true, enabled = true }) {
  if (!cron.validate(cronExpr)) {
    const err = new Error(`无效的 cron 表达式: ${cronExpr}`);
    err.status = 400;
    throw err;
  }
  const schedules = await loadSchedules();
  const schedule = {
    id: crypto.randomBytes(6).toString('hex'),
    name: name || '未命名任务',
    cron: cronExpr,
    hours,
    sendEmail: Boolean(sendEmail),
    enabled: Boolean(enabled),
    createdAt: new Date().toISOString(),
    lastRun: null
  };
  schedules.push(schedule);
  await persist(schedules);
  registerTask(schedule);
  return schedule;
}

async function updateSchedule(id, patch) {
  const schedules = await loadSchedules();
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) {
    const err = new Error('未找到该调度任务');
    err.status = 404;
    throw err;
  }
  if (patch.cron != null && !cron.validate(patch.cron)) {
    const err = new Error(`无效的 cron 表达式: ${patch.cron}`);
    err.status = 400;
    throw err;
  }
  const updated = { ...schedules[idx] };
  ['name', 'cron', 'hours', 'sendEmail', 'enabled'].forEach((k) => {
    if (patch[k] != null) updated[k] = patch[k];
  });
  schedules[idx] = updated;
  await persist(schedules);
  registerTask(updated);
  return updated;
}

async function deleteSchedule(id) {
  const schedules = await loadSchedules();
  const next = schedules.filter((s) => s.id !== id);
  if (next.length === schedules.length) {
    const err = new Error('未找到该调度任务');
    err.status = 404;
    throw err;
  }
  stopTask(id);
  await persist(next);
}

// 立即触发一个调度任务
async function runScheduleNow(id) {
  const schedules = await loadSchedules();
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) {
    const err = new Error('未找到该调度任务');
    err.status = 404;
    throw err;
  }
  return executeSchedule(schedule);
}

module.exports = {
  initScheduler,
  listSchedules,
  addSchedule,
  updateSchedule,
  deleteSchedule,
  runScheduleNow
};
