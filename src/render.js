// 将摘要数据渲染为 HTML，邮件与页面详情共用

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('zh-CN');
}

// 渲染摘要正文（不含 <html> 外壳），供页面内嵌
function renderDigestBody(digest) {
  const date = new Date(digest.generatedAt).toLocaleDateString('zh-CN');
  let html = `
  <div class="digest-summary">
    <strong>统计信息：</strong>
    订阅源 ${digest.feedCount} 个 ·
    最近 ${digest.hours} 小时新文章 ${digest.totalArticles} 篇`;
  if (digest.failedFeeds) html += ` · 抓取失败 ${digest.failedFeeds} 个`;
  html += `</div>`;

  digest.results.forEach((result) => {
    if (!result.items || result.items.length === 0) return;
    html += `\n  <div class="feed-section"><h2>${escapeHtml(result.feedTitle)}</h2>`;
    result.items.forEach((item) => {
      html += `
    <div class="article">
      <div class="article-title"><a href="${escapeHtml(item.link)}" class="article-link" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></div>
      <div class="article-date">${escapeHtml(formatDate(item.pubDate))}</div>
      ${item.summary ? `<div class="article-summary">${escapeHtml(item.summary)}</div>` : ''}
    </div>`;
    });
    html += `\n  </div>`;
  });

  if (digest.totalArticles === 0) {
    html += `<p class="no-articles">最近 ${digest.hours} 小时内没有新文章</p>`;
  }
  return { html, date };
}

const EMAIL_STYLES = `
    body { font-family: Arial, "Microsoft YaHei", sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; border-left: 4px solid #3498db; padding-left: 10px; }
    .digest-summary { background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .feed-section { margin-bottom: 30px; }
    .article { margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 3px; }
    .article-title { font-weight: bold; color: #2980b9; }
    .article-link { color: #3498db; text-decoration: none; }
    .article-link:hover { text-decoration: underline; }
    .article-date { color: #7f8c8d; font-size: 0.9em; }
    .article-summary { color: #555; margin-top: 5px; font-size: 0.95em; }
    .no-articles { color: #95a5a6; font-style: italic; }`;

// 渲染完整 HTML 邮件（含 <html> 外壳）
function renderEmailHtml(digest) {
  const { html, date } = renderDigestBody(digest);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${EMAIL_STYLES}
  </style>
</head>
<body>
  <h1>📰 RSS每日摘要 - ${date}</h1>${html}
</body>
</html>`;
}

module.exports = { renderDigestBody, renderEmailHtml, escapeHtml, formatDate };
