# RSS 每日摘要

一个自托管的 RSS 摘要 Web 应用：抓取 RSS 订阅源、用 DeepSeek 将摘要翻译成中文，支持在网页上查看每日摘要、管理订阅源、配置定时调度任务。

## 功能

- **每日摘要查看**：历史摘要列表 + 详情；进入页面默认展示最近一次生成的结果
- **中文翻译摘要**：配置 DeepSeek API 后，自动将每篇文章的摘要翻译并整理成中文（300 字以内）
- **RSS 源管理**：网页上增删改查订阅源，写回 OPML（保留分组）
- **定时调度**：基于 cron 表达式的应用内调度，支持增删改、启停、立即触发，记录上次运行状态
- **手工立即生成**：随时手动触发一次摘要生成，可选同时发邮件
- **邮件推送**：生成 HTML 邮件发送到指定邮箱
- **访问令牌**：可选的 `?token=` 保护，未授权则设置不可见、写接口返回 401
- **CLI 兼容**：保留命令行入口，便于外部 cron 或脚本调用

## 技术栈

Node.js + Express + 原生前端（Alpine.js），文件存储（OPML + JSON），node-cron 调度。无构建步骤。

## 环境要求

- Node.js 16+（`.env` 里配置 DeepSeek 时需可访问 `api.deepseek.com`）

## 快速开始

```bash
npm install
cp .env.example .env      # 按需填写，全部可选
npm start                 # 打开 http://127.0.0.1:3000
```

## 配置

编辑 `.env`，所有配置项均为**可选**：

```env
# ---- Web 服务 ----
PORT=3000
HOST=127.0.0.1            # 默认仅本机访问

# ---- 设置访问令牌（可选）----
SETTINGS_TOKEN=           # 见下方“访问令牌”

# ---- DeepSeek（可选）----
DEEPSEEK_API_KEY=         # 不配置则仅截断原文到 300 字，不翻译

# ---- 邮件（可选）----
EMAIL_HOST=smtp.qq.com    # 不配置则只保存摘要，不发邮件
EMAIL_PORT=465
EMAIL_USER=your-email@qq.com
EMAIL_PASS=your-smtp-authorization-code
EMAIL_TO=recipient@example.com
```

> ⚠️ `.env` 已被 `.gitignore` 忽略，切勿提交真实密钥。
> `EMAIL_PASS` 填的是邮箱 SMTP 授权码，不是登录密码。

常用邮箱 SMTP 参考：QQ `smtp.qq.com:465`、163 `smtp.163.com:465`、Gmail `smtp.gmail.com:587`。端口 465 自动启用 SSL，其他端口使用 STARTTLS。

### 中文翻译

- 配置有效的 `DEEPSEEK_API_KEY` 后，英文（及其他语言）摘要会被翻译并整理成中文。
- 未配置时，摘要直接截断到 300 字，不翻译。
- key 需以 `sk-` 开头，且账户有余额；获取地址 <https://platform.deepseek.com/>。
- 若翻译未生效，见下方[故障排除](#故障排除)。

## 界面使用

- **默认页**：进入即展示最近一次生成的摘要；左侧为历史列表，点击可切换查看。
- **设置**：点击左下角 ⚙️ 浮动按钮打开设置弹窗，内含三项：
  - **手工立即生成摘要** — 选时间范围、是否发邮件，点击生成
  - **RSS 源管理** — 增删改查订阅源
  - **定时调度** — 配置 cron 定时任务
  - 关闭弹窗：点右上角 ✕、点遮罩空白处，或按 `Esc`
- **删除按钮**：仅在设置解锁（令牌校验通过）时显示。

## 访问令牌

设置相关功能（源管理、调度、手工生成、删除）可用令牌保护：

- 在 `.env` 配置 `SETTINGS_TOKEN` 后，需通过 `http://localhost:3000/?token=你的令牌` 访问，令牌正确才显示 ⚙️ 与设置内容。
- 无令牌或令牌错误时，设置不可见，相关写接口返回 `401`（查看摘要仍然公开）。
- 留空则不加保护（任何人可访问，仅建议纯本机使用）。
- 生成随机令牌：

  ```bash
  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  ```

令牌通过 URL 传递，会留在浏览器历史与服务器访问日志中。个人局域网够用；若暴露公网，建议前置 HTTPS + 反向代理，不要仅依赖此令牌。

## 命令行方式

CLI 不受令牌限制，适合外部 cron / 脚本调用：

```bash
npm run generate          # 生成摘要，不发邮件
npm run cli               # 生成并发邮件
node cli.js --hours 48    # 自定义时间范围
```

## API

设置相关接口（🔒）需在请求头带 `X-Settings-Token` 或 URL 带 `?token=`（当配置了 `SETTINGS_TOKEN` 时）。

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| GET | `/api/status` | 翻译/邮件状态、设置是否受保护/已解锁 |
| GET | `/api/digests` | 摘要历史列表 |
| GET / DELETE | `/api/digests/:id` | 摘要详情 / 删除（🔒 删除） |
| POST | `/api/digests/generate` | 🔒 立即生成（body: `{hours, sendEmail}`） |
| GET / POST | `/api/feeds` | 🔒 源列表 / 新增源 |
| PUT / DELETE | `/api/feeds/:id` | 🔒 编辑 / 删除源 |
| GET / POST | `/api/schedules` | 🔒 调度列表 / 新增 |
| PUT / DELETE | `/api/schedules/:id` | 🔒 编辑 / 删除 |
| POST | `/api/schedules/:id/run` | 🔒 立即触发 |

## 目录结构

```text
rss-daily-digest/
├── server.js              # Express 入口
├── cli.js                 # 命令行入口
├── src/
│   ├── config.js          # 配置与路径
│   ├── auth.js            # 令牌校验（timingSafeEqual）+ 中间件
│   ├── opml.js            # OPML 读写 + 源 CRUD
│   ├── digest.js          # 抓取 + DeepSeek 翻译
│   ├── render.js          # 摘要 → HTML（邮件/页面共用）
│   ├── mailer.js          # 邮件发送
│   ├── store.js           # 摘要历史 JSON 存储（原子写）
│   ├── runner.js          # 生成→保存→发信 编排
│   ├── scheduler.js       # node-cron 调度 + 持久化
│   └── routes/            # feeds / digests / schedules API
├── public/                # 前端（index.html / css / js）
└── data/
    ├── rss.opml           # 订阅源
    ├── digests/           # 摘要历史（自动生成）
    └── schedules.json     # 调度配置（自动生成）
```

## 安全说明

- 默认监听 `127.0.0.1`，仅本机可访问。
- 应用自身没有账号体系，`SETTINGS_TOKEN` 只保护“设置”类操作，不是完整认证。
- 若把 `HOST` 改成 `0.0.0.0` 暴露到局域网/公网，请自行前置反向代理 + HTTPS + 认证（如 nginx basic auth）。

## 部署为常驻服务

定时调度依赖 server 常驻运行。生产可用进程管理器保活：

```bash
# pm2
npm install -g pm2
pm2 start server.js --name rss-digest
pm2 save
```

Windows 可用 [nssm](https://nssm.cc/) 把 `node server.js` 注册为系统服务。

## 故障排除

### 摘要没有翻译成中文

1. 确认 `.env` 里配置了 `DEEPSEEK_API_KEY`，且以 `sk-` 开头。
2. 确认 DeepSeek 账户有余额。
3. 生成摘要后，页面会在翻译全部失败时弹红色告警并给出原因（如 `401 Authentication Fails` 表示 key 无效）；控制台也会打印 `⚠️ 翻译调用全部失败...`。
4. 部分源本身就是中文，翻译前后无明显变化属正常。

### 邮件发送失败

- 检查邮件配置；`EMAIL_PASS` 需为 SMTP 授权码而非登录密码；确认端口未被防火墙拦截。

### 部分 RSS 源抓取失败

- 某些源因网络或服务器限制无法访问，脚本会自动跳过并继续，统计里会显示“抓取失败 N 个”。

### 看不到设置 / 删除按钮

- 说明配置了 `SETTINGS_TOKEN` 但当前未解锁，用 `?token=你的令牌` 访问。

## 许可

MIT
