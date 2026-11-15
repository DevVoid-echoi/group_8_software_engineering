#!/usr/bin/env bash
# Chạy cả backend (cổng 3000) và frontend (cổng 5500) bằng một lệnh: ./start.sh
# Nhấn Ctrl+C để tắt cả hai.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BE_DIR="$ROOT/backend"
FE_DIR="$ROOT/frontend"
BE_PORT="${BE_PORT:-3000}"
FE_PORT="${FE_PORT:-5500}"

port_in_use() { lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# ---------- Backend ----------
if [ ! -f "$BE_DIR/.env" ]; then
  echo "Thiếu backend/.env. Chạy: cp backend/.env.example backend/.env rồi điền thông tin DB và JWT_SECRET."
  exit 1
fi

if [ ! -x "$BE_DIR/.venv/bin/uvicorn" ]; then
  echo "Lần đầu chạy: tạo môi trường Python và cài thư viện..."
  python3 -m venv "$BE_DIR/.venv"
  "$BE_DIR/.venv/bin/pip" install -q -r "$BE_DIR/requirements.txt"
fi

if port_in_use "$BE_PORT"; then
  echo "Cổng $BE_PORT đang bị chương trình khác dùng. Tắt nó đi rồi chạy lại."
  exit 1
fi

PIDS=()
cleanup() {
  echo
  echo "Đang tắt..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "$BE_DIR" && exec .venv/bin/uvicorn app.main:app --port "$BE_PORT" --reload) &
PIDS+=($!)

# ---------- Frontend ----------
if port_in_use "$FE_PORT"; then
  echo "Cổng $FE_PORT đã có chương trình khác (vd. VS Code Live Server) nên không chạy frontend nữa."
  echo "Nếu đó không phải frontend của dự án, tắt nó đi rồi chạy lại ./start.sh"
  FE_URL=""
else
  (cd "$FE_DIR" && exec python3 -m http.server "$FE_PORT" --bind 127.0.0.1 >/dev/null 2>&1) &
  PIDS+=($!)
  FE_URL="http://localhost:$FE_PORT/pages/login.html"
fi

# Chờ backend sẵn sàng
for _ in $(seq 1 30); do
  curl -s "http://localhost:$BE_PORT/api/health" >/dev/null 2>&1 && break
  sleep 1
done

echo
echo "Backend : http://localhost:$BE_PORT  (thử API: http://localhost:$BE_PORT/docs)"
[ -n "$FE_URL" ] && echo "Frontend: $FE_URL"
echo "Nhấn Ctrl+C để tắt."
wait
