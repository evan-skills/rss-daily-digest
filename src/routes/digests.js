const express = require('express');
const { listDigests, getDigest, deleteDigest } = require('../store');
const { runDigest } = require('../runner');
const { renderDigestBody } = require('../render');
const { DEFAULT_HOURS } = require('../config');
const { requireToken } = require('../auth');

const router = express.Router();

// 历史列表（元信息）
router.get('/', async (req, res, next) => {
  try {
    res.json(await listDigests());
  } catch (err) { next(err); }
});

// 立即生成（放在 :id 之前，避免被当成 id）；属于设置操作，需令牌
router.post('/generate', requireToken, async (req, res, next) => {
  try {
    const hours = parseInt(req.body && req.body.hours, 10);
    const sendEmail = Boolean(req.body && req.body.sendEmail);
    const result = await runDigest({
      hours: Number.isNaN(hours) || hours <= 0 ? DEFAULT_HOURS : hours,
      sendEmail
    });
    res.status(201).json({
      id: result.id,
      totalArticles: result.digest.totalArticles,
      feedCount: result.digest.feedCount,
      failedFeeds: result.digest.failedFeeds,
      translated: result.digest.translated,
      translationError: result.digest.translationError,
      emailed: result.emailed,
      emailError: result.emailError
    });
  } catch (err) { next(err); }
});

// 摘要详情（含渲染好的 HTML 正文）
router.get('/:id', async (req, res, next) => {
  try {
    const digest = await getDigest(req.params.id);
    const { html } = renderDigestBody(digest);
    res.json({ ...digest, bodyHtml: html });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteDigest(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
