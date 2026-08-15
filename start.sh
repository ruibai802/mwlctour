#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "启动 MWLC 赛事协助系统..."

if [ ! -d "backend/node_modules" ]; then
  echo "安装后端依赖..."
  (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "安装前端依赖..."
  (cd frontend && npm install)
fi

echo "启动后端 (端口 3001)..."
(cd backend && nohup npm start > ../backend.log 2>&1 &)

sleep 2

echo "启动前端 (端口 5173)..."
(cd frontend && npm run dev)
