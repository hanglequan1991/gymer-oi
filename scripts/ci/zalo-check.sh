#!/usr/bin/env bash
# Kiểm gói build của Zalo Mini App trước khi đẩy lên Zalo. Chạy offline, không gọi mạng.
#
# Usage: scripts/ci/zalo-check.sh [dist_dir=dist]
#
# Điều kiện (theo E7 trong docs/plans/zalo-deploy-job.md):
#   - có index.html và app-config.json trong dist_dir; app-config.json là JSON hợp lệ
#   - app.title là chuỗi không rỗng; listSyncJS là mảng không rỗng; listCSS, listSyncJS,
#     listAsyncJS đều là mảng; mọi tên file trong ba mảng tồn tại trong dist_dir
#   - mỗi file (trừ index.html) tối đa 3 MiB
#   - zip toàn bộ dist_dir tối đa 10 MiB
#   - không có chuỗi service_role
#   - không có file .map, .env*, *.env và không có symlink
#
# Mã thoát: 0 đạt; 1 có điều kiện vi phạm; 2 sai tham số hoặc thiếu công cụ.
# In bảng số file theo đuôi để so với danh sách đuôi server cho phép.
# Nếu GITHUB_STEP_SUMMARY được đặt thì ghi tóm tắt vào đó.
set -euo pipefail

readonly MAX_FILE_BYTES=$((3 * 1024 * 1024))
readonly MAX_ZIP_BYTES=$((10 * 1024 * 1024))

dist_dir="${1:-dist}"
dist_dir="${dist_dir%/}"
errors=()

add_error() {
  errors+=("$1")
  echo "LỖI: $1" >&2
}

if [[ ! -d "$dist_dir" ]]; then
  echo "LỖI: không tìm thấy thư mục '$dist_dir'. Hãy chạy 'npm run build' trước." >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "LỖI: cần node để đọc app-config.json." >&2
  exit 2
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "LỖI: cần zip để đo dung lượng gói." >&2
  exit 2
fi

echo "Kiểm gói Zalo trong: $dist_dir"

# 1. index.html và app-config.json
if [[ ! -f "$dist_dir/index.html" ]]; then
  add_error "thiếu index.html trong $dist_dir"
fi

if [[ ! -f "$dist_dir/app-config.json" ]]; then
  add_error "thiếu app-config.json trong $dist_dir (plugin zmp-vite-plugin phải sinh file này khi build)"
else
  # node in dòng "ERR<TAB>msg" cho lỗi và "INFO<TAB>..." cho thông tin; không thoát khác 0 để bash tự gom lỗi.
  config_report="$(node -e '
    const fs = require("fs");
    const path = require("path");
    const [file, dist] = process.argv.slice(1);
    const err = (m) => console.log("ERR\t" + m);
    let c;
    try {
      c = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      err("app-config.json không phải JSON hợp lệ: " + e.message);
      process.exit(0);
    }
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      err("app-config.json phải là một object JSON");
      process.exit(0);
    }
    const app = c.app;
    if (!app || typeof app !== "object" || typeof app.title !== "string" || app.title.trim() === "") {
      err("app.title trong app-config.json phải là chuỗi không rỗng");
    } else {
      console.log("INFO\ttitle\t" + app.title);
    }
    const keys = ["listCSS", "listSyncJS", "listAsyncJS"];
    for (const k of keys) {
      if (!Array.isArray(c[k])) {
        err(k + " trong app-config.json phải là mảng");
        continue;
      }
      console.log("INFO\tcount\t" + k + "\t" + c[k].length);
      for (const entry of c[k]) {
        if (typeof entry !== "string" || entry.trim() === "") {
          err(k + " chứa phần tử không phải chuỗi hoặc rỗng");
          continue;
        }
        const rel = entry.replace(/^\.?\/+/, "");
        const abs = path.resolve(dist, rel);
        if (path.isAbsolute(rel) || !abs.startsWith(path.resolve(dist) + path.sep)) {
          err(k + " chứa đường dẫn thoát khỏi dist: " + entry);
          continue;
        }
        let ok = false;
        try { ok = fs.statSync(abs).isFile(); } catch (_) { ok = false; }
        if (!ok) err(k + " tham chiếu file không tồn tại trong dist: " + entry);
      }
    }
    if (Array.isArray(c.listSyncJS) && c.listSyncJS.length === 0) {
      err("listSyncJS không được rỗng");
    }
  ' "$dist_dir/app-config.json" "$dist_dir")"

  while IFS=$'\t' read -r kind a b c_; do
    case "$kind" in
      ERR) add_error "$a" ;;
      INFO)
        if [[ "$a" == "title" ]]; then
          echo "Tiêu đề app: $b"
        elif [[ "$a" == "count" ]]; then
          echo "Số file khai báo trong $b: $c_"
        fi
        ;;
    esac
  done <<< "$config_report"
fi

# 2. Kích thước từng file (trừ index.html)
while IFS= read -r big; do
  [[ -z "$big" ]] && continue
  add_error "file vượt 3 MiB: $big"
done < <(find "$dist_dir" -type f ! -path "$dist_dir/index.html" -size +"${MAX_FILE_BYTES}"c -print)

# 3. Dung lượng zip toàn dist. Lỗi zip (hoặc không đọc được số byte) là FAIL, không coi là 0 byte.
zip_bytes=""
if zip_out="$(cd "$dist_dir" && zip -qr - . | wc -c)" && [[ "$zip_out" =~ ^[[:space:]]*[0-9]+[[:space:]]*$ ]]; then
  zip_bytes="${zip_out//[[:space:]]/}"
fi
if [[ -z "$zip_bytes" ]]; then
  add_error "không đo được dung lượng zip dist (lệnh zip lỗi)"
  zip_bytes="không đo được"
  echo "Dung lượng zip dist: không đo được (giới hạn $MAX_ZIP_BYTES)"
else
  echo "Dung lượng zip dist: $zip_bytes byte (giới hạn $MAX_ZIP_BYTES)"
  if (( zip_bytes > MAX_ZIP_BYTES )); then
    add_error "zip dist vượt 10 MiB ($zip_bytes byte)"
  fi
fi

# 4. Chuỗi service_role
if grep -rqF -- "service_role" "$dist_dir"; then
  add_error "phát hiện chuỗi service_role trong $dist_dir (không được đưa khóa service_role vào gói)"
fi

# 5. File bị cấm: .map, .env*, *.env, symlink
while IFS= read -r bad; do
  [[ -z "$bad" ]] && continue
  add_error "file bị cấm trong gói: $bad"
done < <(find "$dist_dir" \( -name '*.map' -o -name '.env*' -o -name '*.env' \) -print)

while IFS= read -r link; do
  [[ -z "$link" ]] && continue
  add_error "symlink không được có trong gói: $link"
done < <(find "$dist_dir" -type l -print)

# 6. Bảng số file theo đuôi
echo "Số file theo đuôi:"
ext_table="$(find "$dist_dir" -type f -print \
  | sed -E 's#.*/##' \
  | awk -F. 'NF > 1 { print tolower($NF); next } { print "(không đuôi)" }' \
  | sort | uniq -c | sort -rn)"
total_files="$(find "$dist_dir" -type f | wc -l | tr -d ' ')"
if [[ "$total_files" -eq 0 ]]; then
  add_error "thư mục $dist_dir không có file nào"
fi
if [[ -n "$ext_table" ]]; then
  printf '%s\n' "$ext_table" | sed -E 's/^ +/  /'
fi
echo "Tổng số file: $total_files"

# 7. Kết quả
status="ĐẠT"
if (( ${#errors[@]} > 0 )); then
  status="KHÔNG ĐẠT"
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Kiểm gói Zalo: $status"
    echo ""
    echo "- Thư mục: \`$dist_dir\`"
    echo "- Tổng số file: $total_files"
    echo "- Dung lượng zip: $zip_bytes$([[ "$zip_bytes" =~ ^[0-9]+$ ]] && echo " byte") (giới hạn $MAX_ZIP_BYTES)"
    echo ""
    echo "| Đuôi | Số file |"
    echo "|---|---|"
    if [[ -n "$ext_table" ]]; then
      printf '%s\n' "$ext_table" | awk '{ n=$1; $1=""; sub(/^ /, ""); printf "| %s | %s |\n", $0, n }'
    fi
    if (( ${#errors[@]} > 0 )); then
      echo ""
      echo "### Lỗi"
      for e in "${errors[@]}"; do
        echo "- $e"
      done
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

if (( ${#errors[@]} > 0 )); then
  echo "Kiểm gói Zalo KHÔNG ĐẠT (${#errors[@]} lỗi)." >&2
  exit 1
fi

echo "Kiểm gói Zalo ĐẠT."
