#!/usr/bin/env bash
# Kiểm tra tĩnh các workflow GitHub Actions. Không cần mạng.
# Cách dùng: bash scripts/ci/check-workflows.sh [thư_mục_workflow]   (mặc định .github/workflows)
# Kiểm tra:
#   1. uses: phải là owner/repo@<40 ký tự hex> (cho phép uses: ./... cục bộ)
#   2. Thiếu permissions: ở cấp workflow
#   3. secrets. trong khối env: cấp workflow (secrets chỉ được đặt ở env cấp step/job)
#   4. Có chuỗi pull_request_target
#   5. Có set -x (hoặc set -o xtrace)
# Dòng comment (bắt đầu bằng #) được bỏ qua. Thoát 0 nếu đạt, khác 0 nếu có vi phạm.
set -euo pipefail

dir="${1:-.github/workflows}"
if [ ! -d "$dir" ]; then
  echo "Không tìm thấy thư mục workflow: $dir" >&2
  exit 1
fi

shopt -s nullglob
files=("$dir"/*.yml)
shopt -u nullglob
if [ "${#files[@]}" -eq 0 ]; then
  echo "Không có file .yml nào trong $dir" >&2
  exit 1
fi

violations=0
for f in "${files[@]}"; do
  out="$(awk -v F="$f" '
    function bad(msg) { printf "%s:%d: %s\n", F, NR, msg }
    # Bỏ qua dòng comment.
    /^[ \t]*#/ { next }
    # Dòng cấp cao nhất (không thụt lề): xác định khối env: cấp workflow và permissions: cấp workflow.
    /^[^ \t]/ {
      in_env = ($0 ~ /^env:/)
      if ($0 ~ /^permissions:/) has_perm = 1
    }
    in_env && /secrets\./ {
      bad("secrets. nằm trong env: cấp workflow; chỉ đặt secrets ở env cấp step hoặc job")
    }
    /pull_request_target/ {
      bad("không được dùng pull_request_target")
    }
    /(^|[^A-Za-z0-9_])set[ \t]+-[A-Za-z]*x|set[ \t]+-o[ \t]+xtrace/ {
      bad("không được dùng set -x (có thể lộ secrets trong log)")
    }
    /^[ \t]*(-[ \t]+)?uses:/ {
      v = $0
      sub(/^[ \t]*(-[ \t]+)?uses:[ \t]*/, "", v)
      sub(/[ \t]+#.*$/, "", v)
      gsub(/[\042\047 \t\r]/, "", v)
      if (v ~ /^\.\//) next
      at = index(v, "@")
      if (at == 0) { bad("uses không có ref: " v); next }
      repo = substr(v, 1, at - 1)
      ref = substr(v, at + 1)
      if (repo !~ /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+$/ || length(ref) != 40 || ref !~ /^[0-9a-f]+$/) {
        bad("uses phải pin SHA 40 ký tự dạng owner/repo@<sha>: " v)
      }
    }
    END {
      if (!has_perm) printf "%s:1: thiếu permissions: ở cấp workflow\n", F
    }
  ' "$f")"
  if [ -n "$out" ]; then
    printf '%s\n' "$out"
    violations=$((violations + $(printf '%s\n' "$out" | wc -l)))
  fi
done

if [ "$violations" -gt 0 ]; then
  echo "FAIL: $violations vi phạm trong $dir" >&2
  exit 1
fi
echo "OK: ${#files[@]} file workflow trong $dir đạt kiểm tra."
