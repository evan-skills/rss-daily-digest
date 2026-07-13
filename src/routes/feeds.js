const express = require('express');
const { listFeeds, addFeed, updateFeed, deleteFeed } = require('../opml');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await listFeeds());
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { xmlUrl } = req.body || {};
    if (!xmlUrl || !/^https?:\/\//i.test(xmlUrl)) {
      return res.status(400).json({ error: 'xmlUrl 必填且需为 http(s) 链接' });
    }
    res.status(201).json(await addFeed(req.body));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (req.body.xmlUrl != null && !/^https?:\/\//i.test(req.body.xmlUrl)) {
      return res.status(400).json({ error: 'xmlUrl 需为 http(s) 链接' });
    }
    res.json(await updateFeed(req.params.id, req.body || {}));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteFeed(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
