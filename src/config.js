const path = require('path');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

module.exports = {
  ROOT,
  DATA_DIR,
  OPML_PATH: path.join(DATA_DIR, 'rss.opml'),
  DIGESTS_DIR: path.join(DATA_DIR, 'digests'),
  SCHEDULES_PATH: path.join(DATA_DIR, 'schedules.json'),

  // Web 服务
  PORT: parseInt(process.env.PORT, 10) || 3000,
  HOST: process.env.HOST || '127.0.0.1',

  // 设置访问令牌（为空则设置不加保护，所有人可访问）
  SETTINGS_TOKEN: process.env.SETTINGS_TOKEN || '',

  // DeepSeek
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',

  // 邮件
  email: {
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT, 10) || 465,
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    to: process.env.EMAIL_TO || ''
  },

  // 默认抓取时间范围（小时）
  DEFAULT_HOURS: 24,
  // RSS 抓取超时
  FETCH_TIMEOUT: 5000,
  // 并发批大小
  BATCH_SIZE: 10
};
