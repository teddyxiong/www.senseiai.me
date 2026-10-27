#!/bin/zsh

set -euo pipefail

GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
DIM=$'\033[2m'
NC=$'\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
PORT=8000
SERVER_LOG="/tmp/sensei-http-server.log"
AUTO_STOP_SECONDS=120

cd "$PROJECT_DIR"

echo "${CYAN}===== npm run build =====${NC}"
npm run build

if [[ ! -f "$PROJECT_DIR/dist/index.html" ]]; then
  echo "Build failed: dist/index.html was not generated."
  exit 1
fi
echo "${BLUE}[build]${NC} dist/ generated ${GREEN}✓${NC}"

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "${YELLOW}[server]${NC} port $PORT occupied, stopping existing preview..."
  lsof -tiTCP:"$PORT" -sTCP:LISTEN | xargs kill -TERM >/dev/null 2>&1 || true
  sleep 1
fi

cd "$PROJECT_DIR/dist"
python3 -m http.server "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 2

if ! lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "${YELLOW}Warning:${NC} preview server may not have started. Check $SERVER_LOG"
  exit 1
fi

(
  sleep "$AUTO_STOP_SECONDS"
  kill "$SERVER_PID" >/dev/null 2>&1 || true
) >/dev/null 2>&1 &

echo ""
echo "${CYAN}===== Local preview =====${NC}"
echo "  ${DIM}→${NC} http://localhost:$PORT/"
echo "  ${DIM}→${NC} http://localhost:$PORT/sitemap.xml"
echo "${BLUE}[preview]${NC} server auto-stops in ${AUTO_STOP_SECONDS}s"
echo "${DIM}This script only builds and previews locally; publishing is handled by Cloudflare Pages.${NC}"
