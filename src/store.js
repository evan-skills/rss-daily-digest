const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { DIGESTS_DIR } = require('./config');

async function ensureDir() {
  await fs.mkdir(DIGESTS_DIR, { recursive: true });
}

// 原子写：先写临时文件再 rename，避免并发/中断损坏
async function atomicWrite(filePath, content) {
  const tmp = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, filePath);
}

// 保存一份摘要，文件名用生成时间戳
async function saveDigest(digest) {
  await ensureDir();
  const id = digest.generatedAt.replace(/[:.]/g, '-');
  const filePath = path.join(DIGESTS_DIR, `${id}.json`);
  await atomicWrite(filePath, JSON.stringify({ id, ...digest }, null, 2));
  return id;
}

// 列出所有摘要（仅元信息，按时间倒序）
async function listDigests() {
  await ensureDir();
  const files = (await fs.readdir(DIGESTS_DIR)).filter((f) => f.endsWith('.json'));
  const metas = await Promise.all(files.map(async (file) => {
    try {
      const raw = await fs.readFile(path.join(DIGESTS_DIR, file), 'utf-8');
      const d = JSON.parse(raw);
      return {
        id: d.id,
        generatedAt: d.generatedAt,
        hours: d.hours,
        feedCount: d.feedCount,
        totalArticles: d.totalArticles,
        failedFeeds: d.failedFeeds || 0,
        translated: Boolean(d.translated)
      };
    } catch {
      return null;
    }
  }));
  return metas
    .filter(Boolean)
    .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
}

// 读取单份摘要完整内容
async function getDigest(id) {
  const filePath = path.join(DIGESTS_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const e = new Error('未找到该摘要');
      e.status = 404;
      throw e;
    }
    throw err;
  }
}

async function deleteDigest(id) {
  const filePath = path.join(DIGESTS_DIR, `${id}.json`);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const e = new Error('未找到该摘要');
      e.status = 404;
      throw e;
    }
    throw err;
  }
}

module.exports = { saveDigest, listDigests, getDigest, deleteDigest, atomicWrite };
