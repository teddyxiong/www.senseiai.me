#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_FILE="${PROJECT_DIR}/src/content/downloads/-index.md"
LATEST_JSON_URL="https://www.senseiai.me/download/latest/latest.json"
DOWNLOAD_URL_PATTERN='url: "https://www\.Sensei\.ai/download/latest/'

sed_inplace() {
  local expr=$1
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$expr" "$TARGET_FILE"
  else
    sed -i "$expr" "$TARGET_FILE"
  fi
}

extract_current_version() {
  sed -n 's/^current_version: "\(.*\)"/\1/p' "$TARGET_FILE" | head -n 1
}

fetch_latest_meta() {
  local json_content
  json_content=$(curl -sf "$LATEST_JSON_URL")
  if [ -z "$json_content" ]; then
    echo "ERROR ERROR"
    return 1
  fi

  python3 -c "
import sys, json, datetime
try:
    data = json.loads(sys.argv[1])
    ver = data.get('version', '').strip()
    dt_str = data.get('pub_date', '').strip()
    if not ver or not dt_str:
        print('ERROR ERROR')
        raise SystemExit(0)
    if dt_str.endswith('Z'):
        dt_str = dt_str[:-1] + '+00:00'
    dt = datetime.datetime.fromisoformat(dt_str)
    print(dt.strftime('%Y-%m-%d') + ' ' + ver)
except Exception:
    print('ERROR ERROR')
" "$json_content"
}

# 取 md 里所有下载链接所在的行号（不依赖固定行号）
download_url_lines() {
  grep -n "$DOWNLOAD_URL_PATTERN" "$TARGET_FILE" | cut -d: -f1
}

# 根据 url 行号，向上找到所属条目的 file_size 行并写回大小
update_size_at() {
  local url_line=$1
  local url
  local size_line
  local content_length
  local mb_size

  url=$(sed -n "${url_line}p" "$TARGET_FILE" | sed -E 's/.*url: "(.*)".*/\1/')
  if [[ "$url" != http* ]]; then
    echo "Warning: no download URL at line ${url_line}, skipped."
    return 1
  fi

  size_line=$(awk -v stop="$url_line" 'NR < stop && /file_size:/ { line = NR } END { print line }' "$TARGET_FILE")
  if [ -z "$size_line" ]; then
    echo "Warning: no file_size line above line ${url_line}, skipped."
    return 1
  fi

  echo "Fetching size for: $url"
  content_length=$(curl -sIL --max-time 30 "$url" 2>/dev/null | grep -i '^content-length:' | awk '{print $2}' | tr -d '\r' | head -n 1) || true
  if [ -z "$content_length" ]; then
    echo "Warning: could not read content-length, size kept unchanged."
    return 1
  fi

  mb_size=$(echo "scale=2; $content_length / 1048576" | bc)
  if [[ "$mb_size" == .* ]]; then
    mb_size="0$mb_size"
  fi
  if [ -z "$mb_size" ]; then
    echo "Warning: could not calculate size for $url"
    return 1
  fi

  echo "Size: ${mb_size} MB -> line ${size_line}"
  sed_inplace "${size_line}s/file_size: \".*\"/file_size: \"${mb_size} MB\"/"
}

echo "Step 1/4: Reading current version from ${TARGET_FILE} ..."
current_version=$(extract_current_version)
if [ -z "$current_version" ]; then
  echo "Error: Cannot find current_version in ${TARGET_FILE}"
  exit 1
fi
echo "Current version: $current_version"

echo "Step 2/4: Fetching latest version from ${LATEST_JSON_URL} ..."
read -r latest_pub_date latest_version <<< "$(fetch_latest_meta)"
if [ "$latest_pub_date" = "ERROR" ] || [ "$latest_version" = "ERROR" ]; then
  echo "Error: Failed to parse latest.json (version/pub_date)."
  exit 1
fi
echo "Latest version: $latest_version"
echo "Latest pub_date: $latest_pub_date"

echo "Step 3/4: Comparing versions ..."
if [ "$current_version" = "$latest_version" ]; then
  echo "Version unchanged (${current_version}). Skip all follow-up tasks."
  exit 0
fi

echo "Version changed: ${current_version} -> ${latest_version}"
echo "Step 4/4: Updating markdown version/date/urls/filesize ..."

# 旧版本号做字面量匹配（转义点号）
old_version_re="${current_version//./\\.}"

# 1) title / current_version
sed_inplace "s/^title: \"\(.*\)V${old_version_re}\"/title: \"\1V${latest_version}\"/"
sed_inplace "s/^current_version: \"[^\"]*\"/current_version: \"${latest_version}\"/"

# 2) 所有下载链接里的版本号：dmg / exe / rpm / AppImage / deb
sed_inplace "s/SenseiAI\([-_]\)${old_version_re}\([-_.]\)/SenseiAI\1${latest_version}\2/g"

# 3) Update last_updated from latest.json pub_date
sed_inplace "s/^last_updated: \"[^\"]*\"/last_updated: \"${latest_pub_date}\"/"

# 4) Re-fetch file sizes for every download link (failures are non-fatal)
url_lines=$(download_url_lines)
while IFS= read -r url_line; do
  [ -z "$url_line" ] && continue
  update_size_at "$url_line" || true
done <<< "$url_lines"

echo "Done."
echo "=== Updated Information ==="
grep -n '^title:' "$TARGET_FILE" || true
grep -n '^last_updated:' "$TARGET_FILE" || true
grep -n '^current_version:' "$TARGET_FILE" || true
grep -n 'file_size:\|file_size: \|url: "https://www.senseiai.me/download/latest/' "$TARGET_FILE" || true
