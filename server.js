const path = require('path');
const express = require('express');
const { PORT, HOST } = require('./src/config');
const { initScheduler } = require('./src/scheduler');
const { isEmailConfigured } = require('./src/mailer');
const { hasTranslation } = require('./src/digest');
const { requireToken, isUnlocked, isProtectionEnabled } = require('./src/auth');

const app = express();
app.use(express.json());

// 运行状态（含设置是否解锁）
app.get('/api/status', (req, res) => {
  res.json({
    emailConfigured: isEmailConfigured(),
    translationEnabled: hasTranslation(),
    settingsProtected: isProtectionEnabled(),
    settingsUnlocked: isUnlocked(req)
  });
});

// 设置相关接口：源管理、调度全程保护
app.use('/api/feeds', requireToken, require('./src/routes/feeds'));
app.use('/api/schedules', requireToken, require('./src/routes/schedules'));
// 摘要：查看/删除公开，但生成属于设置操作，在路由内单独保护
app.use('/api/digests', require('./src/routes/digests'));

// 静态前端
app.use(express.static(path.join(__dirname, 'public')));

// 统一错误处理
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || '服务器内部错误' });
});

async function start() {
  try {
    await initScheduler();
  } catch (err) {
    console.error(`调度器初始化失败: ${err.message}`);
  }
  app.listen(PORT, HOST, () => {
    console.log(`🚀 RSS 每日摘要服务已启动: http://${HOST}:${PORT}`);
    if (HOST === '0.0.0.0') {
      console.log('⚠️  正在监听所有网卡，公网环境请自行添加访问认证');
    }
  });
}

start();
