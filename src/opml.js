const fs = require('fs').promises;
const crypto = require('crypto');
const xml2js = require('xml2js');
const { OPML_PATH } = require('./config');

// 用 xmlUrl 生成稳定 id，便于前端增删改定位
function feedId(xmlUrl) {
  return crypto.createHash('md5').update(xmlUrl).digest('hex').slice(0, 12);
}

// 解析 OPML，返回扁平化的源列表（保留 category 分组名）
async function listFeeds() {
  let xmlContent;
  try {
    xmlContent = await fs.readFile(OPML_PATH, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const result = await xml2js.parseStringPromise(xmlContent);
  const feeds = [];

  const walk = (outlines, category) => {
    for (const outline of outlines) {
      const attr = outline.$ || {};
      if (attr.xmlUrl) {
        feeds.push({
          id: feedId(attr.xmlUrl),
          title: attr.title || attr.text || attr.xmlUrl,
          xmlUrl: attr.xmlUrl,
          htmlUrl: attr.htmlUrl || '',
          category: category || '',
          description: attr.description || ''
        });
      } else if (outline.outline) {
        // 无 xmlUrl 的 outline 视为分组
        walk(outline.outline, attr.title || attr.text || '');
      }
    }
  };

  const body = result.opml && result.opml.body && result.opml.body[0];
  if (body && body.outline) walk(body.outline, '');

  return feeds;
}

// 将扁平源列表写回 OPML（按 category 分组）
async function saveFeeds(feeds) {
  const grouped = new Map();
  for (const f of feeds) {
    const key = f.category || '';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(f);
  }

  const toOutline = (f) => ({
    $: {
      title: f.title,
      text: f.title,
      type: 'rss',
      version: 'RSS',
      xmlUrl: f.xmlUrl,
      htmlUrl: f.htmlUrl || '',
      description: f.description || ''
    }
  });

  const bodyOutlines = [];
  for (const [category, items] of grouped) {
    if (category) {
      bodyOutlines.push({
        $: { title: category, text: category },
        outline: items.map(toOutline)
      });
    } else {
      bodyOutlines.push(...items.map(toOutline));
    }
  }

  const builder = new xml2js.Builder({
    rootName: 'opml',
    xmldec: { version: '1.0', encoding: 'UTF-8' },
    renderOpts: { pretty: true, indent: '\t', newline: '\n' }
  });

  const xml = builder.buildObject({
    $: { version: '1.0' },
    head: { title: 'RSS Daily Digest' },
    body: { outline: bodyOutlines }
  });

  await fs.writeFile(OPML_PATH, xml, 'utf-8');
}

async function addFeed(feed) {
  const feeds = await listFeeds();
  const id = feedId(feed.xmlUrl);
  if (feeds.some((f) => f.id === id)) {
    const err = new Error('该 RSS 源已存在');
    err.status = 409;
    throw err;
  }
  feeds.push({
    id,
    title: feed.title || feed.xmlUrl,
    xmlUrl: feed.xmlUrl,
    htmlUrl: feed.htmlUrl || '',
    category: feed.category || '',
    description: feed.description || ''
  });
  await saveFeeds(feeds);
  return feeds.find((f) => f.id === id);
}

async function updateFeed(id, patch) {
  const feeds = await listFeeds();
  const idx = feeds.findIndex((f) => f.id === id);
  if (idx === -1) {
    const err = new Error('未找到该 RSS 源');
    err.status = 404;
    throw err;
  }
  const current = feeds[idx];
  const updated = {
    ...current,
    title: patch.title != null ? patch.title : current.title,
    xmlUrl: patch.xmlUrl != null ? patch.xmlUrl : current.xmlUrl,
    htmlUrl: patch.htmlUrl != null ? patch.htmlUrl : current.htmlUrl,
    category: patch.category != null ? patch.category : current.category,
    description: patch.description != null ? patch.description : current.description
  };
  // xmlUrl 变了 id 也要变
  updated.id = feedId(updated.xmlUrl);
  feeds[idx] = updated;
  await saveFeeds(feeds);
  return updated;
}

async function deleteFeed(id) {
  const feeds = await listFeeds();
  const next = feeds.filter((f) => f.id !== id);
  if (next.length === feeds.length) {
    const err = new Error('未找到该 RSS 源');
    err.status = 404;
    throw err;
  }
  await saveFeeds(next);
}

module.exports = { listFeeds, saveFeeds, addFeed, updateFeed, deleteFeed, feedId };
