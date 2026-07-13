const express = require('express');
const {
  listSchedules, addSchedule, updateSchedule, deleteSchedule, runScheduleNow
} = require('../scheduler');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await listSchedules());
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { cron } = req.body || {};
    if (!cron) return res.status(400).json({ error: 'cron 表达式必填' });
    res.status(201).json(await addSchedule(req.body));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    res.json(await updateSchedule(req.params.id, req.body || {}));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteSchedule(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

// 立即触发
router.post('/:id/run', async (req, res, next) => {
  try {
    res.json(await runScheduleNow(req.params.id));
  } catch (err) { next(err); }
});

module.exports = router;
