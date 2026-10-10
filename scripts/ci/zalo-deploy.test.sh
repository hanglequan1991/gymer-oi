#!/usr/bin/env bash
# Self-test offline cho scripts/ci/zalo-deploy.sh. Dùng zmp giả, không gọi mạng, không dùng token thật.
# Cách dùng: bash scripts/ci/zalo-deploy.test.sh
# Thoát 0 nếu mọi ca đạt; khác 0 nếu có ca lỗi.
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/zalo-deploy.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAKE_BIN="$WORK/bin/zmp"
CALLS="$WORK/calls.txt"
ALL_OUT="$WORK/all-output.txt"
STAGE_PARENT="$WORK/stages"
DIST="$WORK/dist"
DIST_BAD="$WORK/dist-bad"
mkdir -p "$WORK/bin" "$STAGE_PARENT" "$DIST/assets" "$DIST_BAD"
: >"$CALLS"
: >"$ALL_OUT"

APP_ID="123456789"
ACCESS="fake-access-token-7f3a9c"

b64url() { printf '%s' "$1" | base64 | tr '+/' '-_' | tr -d '=\n'; }
# JWT giả (chữ ký giả). Không liên quan tới Zalo thật.
make_jwt() {
  printf '%s.%s.%s' \
    "$(b64url '{"alg":"HS256","typ":"JWT"}')" \
    "$(b64url "{\"appId\":\"$1\",\"exp\":$2}")" \
    "ZmFrZS1zaWduYXR1cmU"
}
NOW="$(date +%s)"
JWT_OK="$(make_jwt "$APP_ID" $((NOW + 86400 * 30)))"
JWT_EXPIRED="$(make_jwt "$APP_ID" $((NOW - 3600)))"
JWT_OTHER_APP="$(make_jwt 999999999 $((NOW + 86400 * 30)))"

# Gói build giả: app-config có tài nguyên JS.
cat >"$DIST/app-config.json" <<'EOF'
{
  "app": { "title": "Gymer ơi", "headerColor": "#0068FF", "textColor": "white", "leftButton": "none" },
  "listCSS": [],
  "listSyncJS": ["./assets/index.abc123.module.js"],
  "listAsyncJS": []
}
EOF
printf 'console.log("fake");\n' >"$DIST/assets/index.abc123.module.js"
printf '<!doctype html><html></html>\n' >"$DIST/index.html"

# Gói build giả hỏng: không có tài nguyên JS nào.
cat >"$DIST_BAD/app-config.json" <<'EOF'
{
  "app": { "title": "Gymer ơi", "headerColor": "#0068FF", "textColor": "white", "leftButton": "none" },
  "listCSS": [],
  "listSyncJS": [],
  "listAsyncJS": []
}
EOF

# zmp giả. Ghi lời gọi (không ghi giá trị env bí mật) vào $FAKE_CALLS.
cat >"$FAKE_BIN" <<'EOF'
#!/usr/bin/env bash
printf '%s | ZMP_TOKEN=%s | ZMP_ACCESS_TOKEN=%s | %s\n' \
  "$1" "${ZMP_TOKEN-unset}" "${ZMP_ACCESS_TOKEN-unset}" "$*" >>"$FAKE_CALLS"
case "$1" in
  login)
    case "${FAKE_LOGIN:-ok}" in
      ok)
        printf 'APP_ID=%s\nZMP_TOKEN=%s\n' "$3" "$FAKE_JWT" >.env
        echo "Đăng nhập thành công (giả)."
        exit 0
        ;;
      silent)
        echo "Lỗi giả nhưng exit 0, không ghi .env."
        exit 0
        ;;
      leak)
        echo "POST /admin/login thất bại, body={\"accessToken\":\"$5\"}" >&2
        echo "jwt=$FAKE_JWT"
        exit 0
        ;;
    esac
    ;;
  deploy)
    case "${FAKE_DEPLOY:-ok}" in
      ok)
        echo "Đã tải lên (giả). Hạn mức còn lại: 299/300"
        echo "Xem app: https://zalo.example/fake-app"
        exit 0
        ;;
      fail)
        echo "Deploy lỗi (giả), jwt=$FAKE_JWT"
        exit 1
        ;;
    esac
    ;;
esac
echo "lệnh không rõ: $*" >&2
exit 9
EOF
chmod +x "$FAKE_BIN"

PASS=0
FAIL=0
CLEAN_OK=0
RUNS=0
OUT=""
RC=0
LEFT=0

pass() {
  PASS=$((PASS + 1))
  printf 'ok   - %s\n' "$1"
}
fail() {
  FAIL=$((FAIL + 1))
  printf 'FAIL - %s\n' "$1"
}

# Chạy script trong env sạch. Tham số: <mode> [VAR=giá_trị ...]. Biến T_* (đặt trước lệnh gọi) điều khiển ca.
run() {
  local mode="$1"
  shift
  : >"$CALLS"
  set +e
  OUT="$(env -i PATH="$PATH" \
    ZMP_APP_ID="${T_APP_ID-$APP_ID}" \
    ZMP_ACCESS_TOKEN="${T_SECRET-$ACCESS}" \
    ZMP_TOKEN_KIND="${T_KIND:-access}" \
    ZMP_CLI_BIN="${T_CLI-$FAKE_BIN}" \
    DIST_DIR="${T_DIST-$DIST}" \
    ZMP_STAGE_DIR="$STAGE_PARENT" \
    FAKE_CALLS="$CALLS" \
    FAKE_JWT="${T_JWT-$JWT_OK}" \
    FAKE_LOGIN="${T_LOGIN:-ok}" \
    FAKE_DEPLOY="${T_DEPLOY:-ok}" \
    "$@" bash "$SCRIPT" "$mode" 2>&1)"
  RC=$?
  set -e
  printf '%s\n' "$OUT" >>"$ALL_OUT"
  RUNS=$((RUNS + 1))
  LEFT="$(ls -A "$STAGE_PARENT" | wc -l)"
  if [[ "$LEFT" -eq 0 ]]; then
    CLEAN_OK=$((CLEAN_OK + 1))
  else
    fail "staging còn sót sau ca thứ $RUNS (mode=$mode)"
  fi
}

expect_rc() {
  if [[ "$RC" -eq "$2" ]]; then pass "$1 (exit $RC)"; else fail "$1 (exit $RC, mong đợi $2)"; fi
}
expect_out() {
  if grep -qF -- "$2" <<<"$OUT"; then pass "$1"; else fail "$1"; fi
}
expect_no_out() {
  if grep -qF -- "$2" <<<"$OUT"; then fail "$1"; else pass "$1"; fi
}
expect_calls() {
  if grep -qF -- "$2" "$CALLS"; then pass "$1"; else fail "$1"; fi
}
expect_no_calls() {
  if [[ -s "$CALLS" ]]; then fail "$1"; else pass "$1"; fi
}

# 1. login không ghi .env nhưng exit 0 => phải thoát 3 (không tin exit code, E3)
T_LOGIN=silent run login-only
expect_rc "ca 1: login exit 0 nhưng không có ZMP_TOKEN trong .env" 3

# 2. login ghi .env hợp lệ => login-only thành công, đúng cờ login
run login-only
expect_rc "ca 2: login-only với .env hợp lệ" 0
expect_calls "ca 2: login gọi đúng --app-id và --token" "login | ZMP_TOKEN=unset | ZMP_ACCESS_TOKEN=unset | login --app-id $APP_ID --token $ACCESS"
expect_out "ca 2: báo xác thực OK" "Xác thực OK"

# 3. deploy-dev: đúng cờ, không có -t, có dòng hạn mức và xác nhận chưa production
run deploy-dev
expect_rc "ca 3: deploy-dev thành công" 0
expect_calls "ca 3: deploy-dev dùng deploy -e -p -o dist -m (không -t)" \
  "| deploy -e -p -o dist -m gymer-oi local run local"
expect_out "ca 3: báo đã đẩy lên Development, chưa production" \
  "Đã đẩy lên Zalo ở môi trường Development. Chưa phát hành production."
expect_out "ca 3: in dòng hạn mức từ CLI" "Hạn mức còn lại: 299/300"

# 4. deploy-testing qua workflow_dispatch: có -t, đứng giữa -p và -o
run deploy-testing GITHUB_EVENT_NAME=workflow_dispatch
expect_rc "ca 4: deploy-testing từ workflow_dispatch" 0
expect_calls "ca 4: deploy-testing có -t giữa -p và -o" \
  "| deploy -e -p -t -o dist -m gymer-oi local run local"
expect_out "ca 4: báo môi trường Testing" "môi trường Testing"

# 5. deploy-testing từ push => thoát 2, không gọi CLI
run deploy-testing GITHUB_EVENT_NAME=push
expect_rc "ca 5: deploy-testing từ push bị từ chối" 2
expect_no_calls "ca 5: không gọi zmp khi bị từ chối" "không gọi zmp khi bị từ chối"

# 6. deploy lỗi => thoát 4, output đã che token và JWT
T_DEPLOY=fail run deploy-dev
expect_rc "ca 6: deploy giả thoát 1 => script thoát 4" 4
expect_out "ca 6: đuôi log lỗi có dấu che ***" "***"

# 7. ZMP_APP_ID không phải số => thoát 2
T_APP_ID="12ab" run deploy-dev
expect_rc "ca 7: ZMP_APP_ID không phải số" 2
expect_no_calls "ca 7: không gọi zmp khi App ID sai" "không gọi zmp khi App ID sai"

# 8. CLI không được thấy ZMP_TOKEN từ môi trường (E2) và không thấy ZMP_ACCESS_TOKEN
run deploy-dev ZMP_TOKEN=leaked-env-value-42
expect_rc "ca 8: deploy khi môi trường có ZMP_TOKEN rò" 0
expect_calls "ca 8: deploy không nhận ZMP_TOKEN từ môi trường" "deploy | ZMP_TOKEN=unset | ZMP_ACCESS_TOKEN=unset"
expect_no_out "ca 8: giá trị ZMP_TOKEN rò không xuất hiện trong output" "leaked-env-value-42"

# 9. login lỗi kiểu axios in lại body có token => output phải che
T_LOGIN=leak run login-only
expect_rc "ca 9: login lỗi in lại token" 3
expect_no_out "ca 9: access token không lộ trong output" "$ACCESS"
expect_no_out "ca 9: JWT không lộ trong output" "$JWT_OK"
expect_out "ca 9: output có dấu che ***" "***"

# 10. ZMP_TOKEN_KIND=jwt: ghi .env trực tiếp, không gọi login, deploy được
T_KIND=jwt T_SECRET="$JWT_OK" run deploy-dev
expect_rc "ca 10: ZMP_TOKEN_KIND=jwt với JWT hợp lệ" 0
if grep -q '^login' "$CALLS"; then fail "ca 10: kiểu jwt không được gọi login"; else pass "ca 10: kiểu jwt không gọi login"; fi
expect_no_out "ca 10: JWT không lộ trong output" "$JWT_OK"

# 11. JWT hết hạn => thoát 3
T_KIND=jwt T_SECRET="$JWT_EXPIRED" run login-only
expect_rc "ca 11: JWT đã hết hạn" 3
expect_out "ca 11: báo hết hạn" "đã hết hạn"

# 12. appId trong JWT khác ZMP_APP_ID => thoát 3
T_KIND=jwt T_SECRET="$JWT_OTHER_APP" run login-only
expect_rc "ca 12: appId trong JWT khác ZMP_APP_ID" 3

# 13. Chạy trong GitHub Actions: JWT và token chỉ xuất hiện trong dòng ::add-mask::
GITHUB_ACTIONS=true run login-only
expect_rc "ca 13: chạy với GITHUB_ACTIONS=true" 0
bad_mask_lines="$(grep -F -e "$ACCESS" -e "$JWT_OK" <<<"$OUT" | grep -v '^::add-mask::' || true)"
if [[ -z "$bad_mask_lines" ]]; then
  pass "ca 13: bí mật chỉ xuất hiện trong dòng ::add-mask::"
else
  fail "ca 13: bí mật xuất hiện ngoài dòng ::add-mask::"
fi

# 14. Gói build không có tài nguyên JS => thoát 5, không gọi CLI
T_DIST="$DIST_BAD" run deploy-dev
expect_rc "ca 14: app-config không có tài nguyên JS" 5
expect_no_calls "ca 14: không gọi zmp khi gói build hỏng" "không gọi zmp khi gói build hỏng"

# 15. Chế độ không hợp lệ => thoát 2
run check-only
expect_rc "ca 15: chế độ không hợp lệ" 2

# 16. ZMP_CLI_BIN không phải đường dẫn tuyệt đối => thoát 2
T_CLI="zmp" run login-only
expect_rc "ca 16: ZMP_CLI_BIN tương đối" 2

# 17. Thiếu ZMP_ACCESS_TOKEN => thoát 2
T_SECRET="" run login-only
expect_rc "ca 17: thiếu ZMP_ACCESS_TOKEN" 2

# 18. Thông tin commit trong mô tả phiên bản: dùng SHA 7 ký tự và số run
run deploy-dev GITHUB_SHA=abcdef1234567890 GITHUB_RUN_NUMBER=42
expect_rc "ca 18: mô tả phiên bản từ SHA và số run" 0
expect_calls "ca 18: mô tả -m dựng từ SHA 7 ký tự và số run" "deploy -e -p -o dist -m gymer-oi abcdef1 run 42"

# Kiểm tĩnh
if bash -n "$SCRIPT" && bash -n "$HERE/zalo-deploy.test.sh"; then
  pass "bash -n đạt cho cả hai file"
else
  fail "bash -n lỗi"
fi
if grep -vE '^[[:space:]]*#' "$SCRIPT" | grep -qE 'set -[a-zA-Z]*x|xtrace'; then
  fail "phát hiện set -x hoặc xtrace ngoài dòng comment"
else
  pass "không có set -x hoặc xtrace"
fi

# Quét toàn bộ output các ca: không được có bí mật nào ngoài dòng ::add-mask::.
leaks="$(grep -vF '::add-mask::' "$ALL_OUT" |
  grep -F -e "$ACCESS" -e "$JWT_OK" -e "$JWT_EXPIRED" -e "$JWT_OTHER_APP" -e "leaked-env-value-42" || true)"
if [[ -z "$leaks" ]]; then
  pass "quét toàn bộ output: không lộ bí mật"
else
  fail "quét toàn bộ output: có bí mật lộ ra"
fi

printf 'Dọn staging: %d/%d lần chạy.\n' "$CLEAN_OK" "$RUNS"
printf '\nKết quả: %d ca đạt, %d ca lỗi.\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
