const Parser = require('rss-parser');
const OpenAI = require('openai');
const { listFeeds } = require('./opml');
const { DEEPSEEK_API_KEY, FETCH_TIMEOUT, BATCH_SIZE, DEFAULT_HOURS } = require('./config');

const parser = new Parser({
  timeout: FETCH_TIMEOUT,
  headers: { 'User-Agent': 'RSS-Daily-Digest/2.0' }
});

let deepseek = null;
if (DEEPSEEK_API_KEY) {
  deepseek = new OpenAI({
    apiKey: DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com'
  });
}

// 翻译并生成中文摘要；无 API 或失败时降级为截断。
// stats 用于聚合本次运行的翻译成功/失败情况（可选）。
async function translateAndSummarize(text, title, stats) {
  const safeText = text || '';
  if (!deepseek || !safeText) {
    return safeText.substring(0, 300);
  }
  try {
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `请将以下文章摘要翻译成中文，并整理成一段流畅的中文摘要，300字以内。只返回摘要内容，不要其他说明。

标题：${title}

摘要：
${safeText.substring(0, 2000)}`
      }],
      max_tokens: 500,
      temperature: 0.3
    });
    const summary = completion.choices[0].message.content.trim();
    if (stats) stats.ok += 1;
    return summary.substring(0, 300);
  } catch (error) {
    console.error(`翻译失败: ${error.status || ''} ${error.message}`);
    if (stats) {
      stats.failed += 1;
      if (!stats.lastError) stats.lastError = `${error.status || ''} ${error.message}`.trim();
    }
    return safeText.substring(0, 300);
  }
}

// 抓取单个源在时间范围内的文章
async function fetchFeed(feed, hoursAgo, stats) {
  const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  try {
    const feedData = await parser.parseURL(feed.xmlUrl);
    const recentItems = (feedData.items || []).filter((item) => {
      const raw = item.pubDate || item.isoDate;
      if (!raw) return false;
      const pubDate = new Date(raw);
      return !Number.isNaN(pubDate.getTime()) && pubDate >= cutoffTime;
    });

    const processedItems = await Promise.all(recentItems.map(async (item) => {
      let summary = item.contentSnippet || item.content || item.description || '';
      summary = summary.replace(/<[^>]*>/g, '');
      // 有 DeepSeek 且素材够长时，翻译并压缩成中文摘要；否则直接截断
      if (deepseek && summary.length > 50) {
        summary = await translateAndSummarize(summary, item.title, stats);
      } else {
        summary = summary.substring(0, 300);
      }
      return {
        title: item.title || '(无标题)',
        link: item.link || feed.htmlUrl || '',
        pubDate: item.pubDate || item.isoDate || null,
        summary
      };
    }));

    return { feedTitle: feed.title, feedUrl: feed.htmlUrl, items: processedItems };
  } catch (error) {
    console.error(`抓取失败 ${feed.title}: ${error.message}`);
    return { feedTitle: feed.title, feedUrl: feed.htmlUrl, items: [], error: error.message };
  }
}

// 生成完整摘要，返回结构化数据（不含 HTML）
async function generateDigest({ hours = DEFAULT_HOURS, onProgress } = {}) {
  const feeds = await listFeeds();
  const results = [];
  const stats = { ok: 0, failed: 0, lastError: '' };

  for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
    const batch = feeds.slice(i, i + BATCH_SIZE);
    if (onProgress) {
      onProgress(`处理第 ${i + 1}-${Math.min(i + BATCH_SIZE, feeds.length)} / ${feeds.length} 个订阅源`);
    }
    const batchResults = await Promise.all(batch.map((feed) => fetchFeed(feed, hours, stats)));
    results.push(...batchResults);
  }

  const totalArticles = results.reduce((sum, r) => sum + r.items.length, 0);
  const failedFeeds = results.filter((r) => r.error).length;

  // 翻译已启用却全部失败：多为 key 无效/欠费，明确提示而不是静默降级
  let translationError = null;
  if (deepseek && stats.failed > 0 && stats.ok === 0) {
    translationError = `翻译调用全部失败（${stats.failed} 次），摘要未翻译。原因：${stats.lastError || '未知'}`;
    console.error(`⚠️  ${translationError}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    hours,
    feedCount: feeds.length,
    totalArticles,
    failedFeeds,
    translated: Boolean(deepseek),
    translationOk: stats.ok,
    translationFailed: stats.failed,
    translationError,
    results
  };
}

module.exports = { generateDigest, fetchFeed, translateAndSummarize, hasTranslation: () => Boolean(deepseek) };
