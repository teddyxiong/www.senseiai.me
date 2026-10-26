#!/bin/zsh

set -euo pipefail

# ANSI color codes
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
NC=$'\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
TARGET_ROOT="$HOME/Documents/dist/linkjobdist"

ACTIVE_LOCALE="$(python3 -c "
import json
from pathlib import Path
data = json.loads(Path('${PROJECT_DIR}/i18n.config.json').read_text('utf-8'))
print(data.get('activeLocale', 'en'))
")"

# English is the default locale, served at root. Other locales use /{locale}/ prefix.
if [[ "$ACTIVE_LOCALE" == "en" ]]; then
  LOCALE_PREFIX=""
  TARGET_DIR="$TARGET_ROOT"
else
  LOCALE_PREFIX="/$ACTIVE_LOCALE"
  TARGET_DIR="$TARGET_ROOT/$ACTIVE_LOCALE"
fi

PORT=8000
SERVER_LOG="/tmp/linkjobdist-http-server.log"
AUTO_STOP_SECONDS=120
PUBLISH_TIMEOUT=300
CURRENT_BRANCH="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD)"
COMMIT_MSG_TEMPLATE="${1:-chore: update ${ACTIVE_LOCALE} build}"

echo "${DIM}Active locale:${NC} $ACTIVE_LOCALE"
echo "${DIM}Project directory:${NC} $PROJECT_DIR"
echo "${DIM}Target directory:${NC} $TARGET_DIR"

if [[ "$CURRENT_BRANCH" != "master" ]]; then
  echo "${RED}Error:${NC} current branch is '${BOLD}$CURRENT_BRANCH${NC}'. Please switch to 'master' first."
  exit 1
fi
echo "${BLUE}[check]${NC} branch: ${GREEN}$CURRENT_BRANCH ✓${NC}"

# Interactive prompt: update download file size/version info (3s timeout, default: no)
echo ""
read -t 3 "REPLY?Update download file size and version info? (y/N) [auto-N in 3s] " 2>/dev/null || true
REPLY="${REPLY:-n}"
echo "${REPLY:-n}"
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  echo "Running getsize.sh..."
  bash "$PROJECT_DIR/scripts/getsize.sh" || echo "${YELLOW}⚠️  getsize.sh failed, skipped, continuing deploy...${NC}"
else
  echo "${DIM}Skipped download info update.${NC}"
fi
echo ""

cd "$PROJECT_DIR"

echo "${DIM}Current branch:${NC} $CURRENT_BRANCH"
echo "${BLUE}[git]${NC} source repo — checking for changes..."
git add -A

if git diff --cached --quiet; then
  echo "${YELLOW}[git]${NC} source repo — no changes, skipping commit"
else
  git commit -m "$COMMIT_MSG_TEMPLATE $(date '+%Y-%m-%d %H:%M:%S')"
  git push -u origin master
  echo "${BLUE}[git]${NC} source repo — committed + pushed ${GREEN}✓${NC}"
fi

echo ""
echo "${CYAN}===== npm run build =====${NC}"
npm run build
echo "${BLUE}[build]${NC} dist/ generated ${GREEN}✓${NC}"

mkdir -p "$TARGET_DIR"

if [[ ! -f "$PROJECT_DIR/dist/index.html" ]]; then
  echo "${RED}Error:${NC} dist/index.html not found. Build may have failed. Aborting sync."
  exit 1
fi
echo "${BLUE}[sync]${NC} dist/index.html found ${GREEN}✓${NC}"
# Mirror the latest build output into the target locale directory.
# For default locale (en), protect other language subdirectories from --delete.
if [[ "$ACTIVE_LOCALE" == "en" ]]; then
  OTHER_LOCALES=("${(@f)$(python3 -c "
import json
from pathlib import Path
data = json.loads(Path('${PROJECT_DIR}/i18n.config.json').read_text('utf-8'))
locales = data.get('publishedLocales', ['en'])
print('\n'.join(l for l in locales if l != 'en'))
")}")
  RSYNC_EXCLUDES=("--exclude=/.git")
  for loc in "${OTHER_LOCALES[@]}"; do
    [[ -n "$loc" ]] && RSYNC_EXCLUDES+=("--exclude=/$loc")
  done
  echo "${BLUE}[sync]${NC} rsync dist/ → $TARGET_DIR (protecting: .git ${OTHER_LOCALES[*]})"
  rsync -a --delete "${RSYNC_EXCLUDES[@]}" "$PROJECT_DIR/dist/" "$TARGET_DIR/"
else
  echo "${BLUE}[sync]${NC} rsync dist/ → $TARGET_DIR"
  rsync -a --delete "$PROJECT_DIR/dist/" "$TARGET_DIR/"
fi
echo "${BLUE}[sync]${NC} rsync done ${GREEN}✓${NC}"

cd "$TARGET_ROOT"

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "${YELLOW}[server]${NC} port $PORT occupied, stopping existing process..."
  lsof -tiTCP:"$PORT" -sTCP:LISTEN | xargs kill -TERM >/dev/null 2>&1 || true
  sleep 1
  echo "${YELLOW}[server]${NC} old process killed"
else
  echo "${BLUE}[server]${NC} port $PORT free ${GREEN}✓${NC}"
fi

echo "${BLUE}[server]${NC} starting http.server on :$PORT ..."
python3 -m http.server "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 2
if ! lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "${YELLOW}⚠️  Warning:${NC} HTTP server may not have started. Check $SERVER_LOG"
else
  echo "${BLUE}[server]${NC} http.server listening ${GREEN}✓${NC} (pid: $SERVER_PID, auto-stop: ${AUTO_STOP_SECONDS}s)"
fi

(
  sleep "$AUTO_STOP_SECONDS"
  kill "$SERVER_PID" >/dev/null 2>&1 || true
) >/dev/null 2>&1 &

echo ""
echo "${CYAN}===== Preview URLs =====${NC}"
if [[ -n "$LOCALE_PREFIX" ]]; then
  echo "  ${DIM}→${NC} http://localhost:$PORT${LOCALE_PREFIX}/"
  echo "  ${DIM}→${NC} http://localhost:$PORT${LOCALE_PREFIX}/sitemap-0.xml"
fi
echo "  ${DIM}→${NC} http://localhost:$PORT/"
echo "  ${DIM}→${NC} http://localhost:$PORT/sitemap-0.xml"
echo "  ${DIM}→${NC} http://localhost:$PORT/sitemap.xml"
echo ""

if [[ -n "$LOCALE_PREFIX" ]]; then
  open "http://localhost:$PORT${LOCALE_PREFIX}/"
  open "http://localhost:$PORT${LOCALE_PREFIX}/sitemap-0.xml"
fi
open "http://localhost:$PORT/"
open "http://localhost:$PORT/sitemap-0.xml"
open "http://localhost:$PORT/sitemap.xml"
echo "${BLUE}[preview]${NC} browser tabs opened, auto-stop in ${AUTO_STOP_SECONDS}s"

# Interactive prompt: push linkjobdist to www.senseiai.me (300s timeout, default: no)
echo ""
echo "${CYAN}===== Publish to www.senseiai.me =====${NC}"
echo ""
echo "  The build has been synced to linkjobdist and is ready for review."
echo "  If everything looks good, type 'y' to push linkjobdist to the remote"
echo "  repository. Cloudflare Pages will then deploy to www.senseiai.me."
echo ""
echo "  ════════════════════════════════════════════════════════════"
echo "  ⏳  This prompt will auto-answer 'N' in ${PUBLISH_TIMEOUT}s"
echo "  ════════════════════════════════════════════════════════════"
echo ""

printf "  [%3ds]" "$PUBLISH_TIMEOUT" > /dev/tty

(
  for sec in {$((PUBLISH_TIMEOUT - 1))..1}; do
    sleep 1
    printf "\033[A\r  [%3ds]" "$sec" > /dev/tty
  done
) &
CD_PID=$!

printf "\n\033[A" > /dev/tty
read -t "$PUBLISH_TIMEOUT" "REPLY?👉  Type 'y' to publish or 'N' to skip, then press Enter: " 2>/dev/null || true

kill $CD_PID 2>/dev/null || true
wait $CD_PID 2>/dev/null || true
printf "\033[A\r                              \r\033[B\n" > /dev/tty

REPLY="${REPLY:-n}"
echo ""
echo "→ Your answer: ${BOLD}${REPLY}${NC}"
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  echo "${BLUE}[publish]${NC} pushing linkjobdist to www.senseiai.me..."
  git -C "$TARGET_ROOT" add .
  if git -C "$TARGET_ROOT" diff --cached --quiet; then
    echo "${YELLOW}[publish]${NC} no changes to commit, skipping push."
  else
    git -C "$TARGET_ROOT" commit -m "自动部署-${ACTIVE_LOCALE}语言包-$(date '+%Y-%m-%d %H:%M:%S')"
    git -C "$TARGET_ROOT" push -u origin master
    echo "${GREEN}[publish]${NC} linkjobdist 推送完成 ${GREEN}✓${NC}"
  fi

  # Interactive prompt: open www.senseiai.me for verification (90s countdown, default: yes)
  echo ""
  read -t 15 "REPLY?Open www.senseiai.me in browser for verification? (Y/n) [auto-Y in 15s] " 2>/dev/null || true
  REPLY="${REPLY:-y}"
  echo "${REPLY:-y}"
  if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    echo "${DIM}Waiting 90 seconds for Cloudflare Pages to deploy...${NC}"
    for i in {90..1}; do
      echo -ne "\r${DIM}Countdown: $i seconds remaining...${NC}"
      sleep 1
    done
    echo ""
    echo "${BLUE}[verify]${NC} opening live site..."
    open -a "Google Chrome" "https://www.senseiai.me"
    open -a "Google Chrome" "https://www.senseiai.me/sitemap.xml"
    if [[ -n "$LOCALE_PREFIX" ]]; then
      open -a "Google Chrome" "https://www.senseiai.me${LOCALE_PREFIX}/"
      open -a "Google Chrome" "https://www.senseiai.me${LOCALE_PREFIX}/sitemap-0.xml"
    fi
  else
    echo "${YELLOW}Skipped www.senseiai.me verification.${NC}"
  fi

  # ── IndexNow submission ──
  echo ""
  echo "${CYAN}===== IndexNow Submit =====${NC}"
  INDEXNOW_KEY="5b59ea84565f422aafbde7848274090a"
  INDEXNOW_HOST="www.senseiai.me"
  SITEMAP_URL="https://${INDEXNOW_HOST}/sitemap.xml"

  echo "${BLUE}[indexnow]${NC} fetching sitemap..."
  SITEMAP_CONTENT=$(curl -sL "$SITEMAP_URL" 2>/dev/null)

  # Check if it's a sitemap index (contains <sitemap>) or urlset
  if echo "$SITEMAP_CONTENT" | grep -qi '<sitemap>'; then
    # Sitemap index: extract sub-sitemap URLs and fetch each
    SUB_MAPS=$(echo "$SITEMAP_CONTENT" | sed -n 's/.*<loc>\([^<]*\)<\/loc>.*/\1/p')
    URLS=""
    while IFS= read -r sub_url; do
      [ -z "$sub_url" ] && continue
      echo "  fetching: $sub_url"
      SUB_CONTENT=$(curl -sL "$sub_url" 2>/dev/null)
      SUB_URLS=$(echo "$SUB_CONTENT" | sed -n 's/.*<loc>\([^<]*\)<\/loc>.*/\1/p')
      URLS="${URLS}${SUB_URLS}"$'\n'
    done <<< "$SUB_MAPS"
  else
    # Direct urlset
    URLS=$(echo "$SITEMAP_CONTENT" | sed -n 's/.*<loc>\([^<]*\)<\/loc>.*/\1/p')
  fi

  URLS=$(echo "$URLS" | sed '/^$/d' | sort -u)
  URL_COUNT=$(echo "$URLS" | grep -c . 2>/dev/null || echo 0)

  if [ "$URL_COUNT" -eq 0 ]; then
    echo "${YELLOW}[indexnow]${NC} no URLs found, skipping."
  else
    echo "${BLUE}[indexnow]${NC} submitting $URL_COUNT URLs to IndexNow..."

    JSON_URLS=""
    FIRST=true
    while IFS= read -r url; do
      [ -z "$url" ] && continue
      if [ "$FIRST" = true ]; then
        JSON_URLS="\"$url\""
        FIRST=false
      else
        JSON_URLS="$JSON_URLS, \"$url\""
      fi
    done <<< "$URLS"

    PAYLOAD="{\"host\":\"${INDEXNOW_HOST}\",\"key\":\"${INDEXNOW_KEY}\",\"urlList\":[${JSON_URLS}]}"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://www.bing.com/indexnow" \
      -H "Content-Type: application/json; charset=utf-8" \
      -d "$PAYLOAD" 2>/dev/null)

    if [ "$HTTP_CODE" = "200" ]; then
      echo "${GREEN}[indexnow]${NC} submitted successfully (HTTP ${HTTP_CODE}) ${GREEN}✓${NC}"
    else
      echo "${YELLOW}[indexnow]${NC} response: HTTP ${HTTP_CODE}"
    fi
  fi
  echo ""

else
  echo "${DIM}Skipped www.senseiai.me publish.${NC}"
fi

echo ""
echo "${CYAN}===== deploy.sh finished =====${NC}"
