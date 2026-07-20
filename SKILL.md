---
name: rss-daily-digest
description: RSS 每日摘要 Web 应用 - 抓取 RSS 订阅源生成中文摘要，支持网页查看摘要、管理订阅源、配置定时调度
trigger: 当用户想要查看 RSS 摘要、管理订阅源、配置定时抓取任务或启动摘要服务时使用
---

# RSS 每日摘要

一个自托管的 RSS 摘要 Web 应用。

## 启动服务

```bash
npm install       # 首次运行
npm start         # 启动 Web 服务，打开 http://127.0.0.1:3002
```

Web 界面提供三个功能：

1. **每日摘要** — 查看历史摘要、立即生成、可选发邮件
2. **RSS 源管理** — 增删改查订阅源
3. **定时调度** — 用 cron 表达式配置自动抓取任务

## 命令行方式

```bash
node cli.js --no-email        # 仅生成摘要
node cli.js                   # 生成并发邮件
node cli.js --hours 48        # 自定义时间范围
```

## 配置

复制 `.env.example` 为 `.env` 并按需填写（DeepSeek 翻译、邮件均可选）。详见 [README.md](README.md)。
