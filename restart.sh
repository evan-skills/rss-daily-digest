#!/usr/bin/env bash
# rss-daily-digest 重启：拉代码 → 装依赖 → 杀旧进程 → 后台重启
set -e
cd "$(dirname "$0")"

# 1. 拉取最新代码
git pull

# 2. 安装依赖
npm install

# 3. 按端口杀掉旧进程（从 .env 读取端口，默认 3002）
PORT=$(grep -oP '^PORT=\K\d+' .env 2>/dev/null || echo 3002)
OLD_PID=$(lsof -ti:${PORT} 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
  kill $OLD_PID
  echo "已杀掉端口 ${PORT} 上的旧进程 PID=$OLD_PID"
  sleep 1
else
  echo "端口 ${PORT} 无监听进程，跳过"
fi

# 4. 后台启动（关闭 shell 后不停）
mkdir -p logs
nohup node server.js >> logs/rss-daily-digest.log 2>&1 &

echo "已重启，PID=$!  日志: tail -f logs/rss-daily-digest.log"
