#!/usr/bin/env bash
# rss-daily-digest 重启：拉代码 → 装依赖 → 杀旧进程 → 后台重启
set -e
cd "$(dirname "$0")"

# 1. 拉取最新代码
git fetch origin main
git reset --hard origin/main

# 2. 安装依赖
npm install

# 3. 杀掉旧进程
pkill -f "node .*server.js" 2>/dev/null || true
sleep 1

# 4. 后台启动（关闭 shell 后不停）
mkdir -p logs
nohup node server.js >> logs/rss-daily-digest.log 2>&1 &

echo "已重启，PID=$!  日志: tail -f logs/rss-daily-digest.log"
