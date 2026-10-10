#!/usr/bin/env bash
# Đăng nhập zmp-cli và (tùy chọn) đẩy bản build lên Zalo. Dùng trong job `zalo` của deploy.yml.
# Cách dùng: bash scripts/ci/zalo-deploy.sh <login-only|deploy-dev|deploy-testing>
#
# Env bắt buộc:
#   ZMP_APP_ID        App ID Zalo (chỉ chữ số).
#   ZMP_ACCESS_TOKEN  Bí mật. Với ZMP_TOKEN_KIND=access là access token thô (đi qua zmp login).
#                     Với ZMP_TOKEN_KIND=jwt là JWT đã lấy từ .env sau một lần zmp login.
#   ZMP_CLI_BIN       Đường dẫn tuyệt đối tới file `zmp` (cài trong tools/zmp-cli).
# Env tùy chọn:
#   ZMP_TOKEN_KIND    access (mặc định) | jwt.
#   DIST_DIR          Thư mục build (mặc định dist, tính theo thư mục hiện tại khi gọi).
#   ZMP_STAGE_DIR     Thư mục cha để tạo staging (mặc định RUNNER_TEMP, TMPDIR, /tmp). Không được nằm trong repo.
#   GITHUB_EVENT_NAME, GITHUB_SHA, GITHUB_RUN_NUMBER, GITHUB_ACTIONS, GITHUB_STEP_SUMMARY.
#
# Mã thoát:
#   0 thành công; 2 sai tham số/env; 3 đăng nhập thất bại hoặc JWT không hợp lệ/hết hạn;
#   4 deploy thất bại; 5 gói build không hợp lệ.
#
# Lưu ý:
#   - Không dựa vào exit code của `zmp login` (E3): kiểm tra ZMP_TOKEN trong .env.
#   - CLI chạy trong staging ngoài workspace (E4), không có ZMP_TOKEN/ZMP_ACCESS_TOKEN trong env (E2).
#   - Mọi output của CLI đi qua redact (token và JWT thành ***). Không in giá trị bí mật.
#   - Không dùng set -x.
set -euo pipefail
umask 077

readonly EXIT_BAD_ARGS=2
readonly EXIT_LOGIN=3
readonly EXIT_DEPLOY=4
readonly EXIT_BAD_BUILD=5

log() { printf '%s\n' "$*"; }
die() {
  local code="$1"
  shift
  printf 'LỖI: %s\n' "$*" >&2
  exit "$code"
}

# Thay token (dạng thô và dạng urlencode) và mọi JWT còn lại bằng ***.
# Giá trị đi qua env (không qua argv để không lộ trong ps).
redact() {
  S_ACCESS="${ZMP_ACCESS_TOKEN:-}" S_ACCESS_ENC="${ACCESS_ENC:-}" S_JWT="${JWT:-}" awk '
    function rep(s, t,   out, i) {
      if (t == "") return s
      out = ""
      while ((i = index(s, t)) > 0) {
        out = out substr(s, 1, i - 1) "***"
        s = substr(s, i + length(t))
      }
      return out s
    }
    {
      line = $0
      line = rep(line, ENVIRON["S_ACCESS"])
      line = rep(line, ENVIRON["S_ACCESS_ENC"])
      line = rep(line, ENVIRON["S_JWT"])
      print line
    }' | sed -E 's|eyJ[A-Za-z0-9_=+/-]*\.[A-Za-z0-9_=+/-]*\.[A-Za-z0-9_=+/-]*|***|g'
}

urlenc() {
  local s="$1" out="" i c h
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *)
        printf -v h '%%%02X' "'$c"
        out+="$h"
        ;;
    esac
  done
  printf '%s' "$out"
}

# Đọc giá trị KEY=... cuối cùng trong .env của staging. In rỗng nếu không có.
read_env_value() {
  local key="$1" line
  [[ -f "$ENV_FILE" ]] || return 0
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line#\"}"
  line="${line%\"}"
  printf '%s' "$line"
}

# Phần payload (base64url) của JWT, giải mã ra JSON. Không xác minh chữ ký.
jwt_payload() {
  local seg="${1#*.}"
  seg="${seg%%.*}"
  seg="${seg//-/+}"
  seg="${seg//_/\/}"
  case $((${#seg} % 4)) in
    2) seg+="==" ;;
    3) seg+="=" ;;
  esac
  printf '%s' "$seg" | base64 -d 2>/dev/null || true
}

# ---------------------------------------------------------------- tham số và env
MODE="${1:-}"
case "$MODE" in
  login-only | deploy-dev | deploy-testing) ;;
  *) die "$EXIT_BAD_ARGS" "Chế độ không hợp lệ: '${MODE}' (cho phép: login-only, deploy-dev, deploy-testing)." ;;
esac

if [[ "$MODE" == "deploy-testing" && "${GITHUB_EVENT_NAME:-}" == "push" ]]; then
  die "$EXIT_BAD_ARGS" "deploy-testing không được chạy từ push (chỉ qua workflow_dispatch)."
fi

[[ "${ZMP_APP_ID:-}" =~ ^[0-9]+$ ]] || die "$EXIT_BAD_ARGS" "ZMP_APP_ID phải là chuỗi chữ số."
[[ -n "${ZMP_ACCESS_TOKEN:-}" ]] || die "$EXIT_BAD_ARGS" "Thiếu ZMP_ACCESS_TOKEN."
[[ ! "$ZMP_ACCESS_TOKEN" =~ [[:space:]] ]] || die "$EXIT_BAD_ARGS" "ZMP_ACCESS_TOKEN chứa khoảng trắng."

KIND="${ZMP_TOKEN_KIND:-access}"
case "$KIND" in
  access | jwt) ;;
  *) die "$EXIT_BAD_ARGS" "ZMP_TOKEN_KIND phải là access hoặc jwt." ;;
esac

[[ "${ZMP_CLI_BIN:-}" == /* && -x "${ZMP_CLI_BIN:-}" ]] ||
  die "$EXIT_BAD_ARGS" "ZMP_CLI_BIN phải là đường dẫn tuyệt đối tới file thực thi."

# Không để ZMP_TOKEN từ môi trường ghi đè JWT trong .env (E2).
unset ZMP_TOKEN

ACCESS_ENC="$(urlenc "$ZMP_ACCESS_TOKEN")"
JWT=""

SHA_SHORT="local"
if [[ "${GITHUB_SHA:-}" =~ ^[0-9a-f]{7,40}$ ]]; then
  SHA_SHORT="${GITHUB_SHA:0:7}"
fi
RUN_NO="local"
if [[ "${GITHUB_RUN_NUMBER:-}" =~ ^[0-9]+$ ]]; then
  RUN_NO="$GITHUB_RUN_NUMBER"
fi
DESC="gymer-oi ${SHA_SHORT} run ${RUN_NO}"

# ---------------------------------------------------------------- gói build
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

DIST_IN="${DIST_DIR:-dist}"
[[ -d "$DIST_IN" ]] || die "$EXIT_BAD_BUILD" "Không có thư mục build: ${DIST_IN}."
DIST="$(cd "$DIST_IN" && pwd)"
[[ -f "$DIST/app-config.json" ]] ||
  die "$EXIT_BAD_BUILD" "Thiếu app-config.json trong gói build (cần chạy vite build có zmp-vite-plugin)."

DIST_COMPACT="$(tr -d ' \n\r\t' < "$DIST/app-config.json")"
if [[ "$DIST_COMPACT" != *'"listSyncJS":["'* && "$DIST_COMPACT" != *'"listAsyncJS":["'* ]]; then
  die "$EXIT_BAD_BUILD" "app-config.json không có tài nguyên JS nào (listSyncJS và listAsyncJS đều rỗng)."
fi

BIG_FILES="$(find "$DIST" -type f -size +3145728c)"
if [[ -n "$BIG_FILES" ]]; then
  die "$EXIT_BAD_BUILD" "Có file vượt 3 MB trong gói build (giới hạn của Zalo)."
fi

# ---------------------------------------------------------------- staging ngoài workspace
PARENT="${ZMP_STAGE_DIR:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}}"
case "$PARENT" in
  /*) ;;
  *) die "$EXIT_BAD_ARGS" "Thư mục staging phải là đường dẫn tuyệt đối." ;;
esac
case "$PARENT/" in
  "$ROOT/"*) die "$EXIT_BAD_ARGS" "Thư mục staging không được nằm trong workspace repo." ;;
esac
mkdir -p "$PARENT"
PARENT="$(cd "$PARENT" && pwd)"
STAGE="$(mktemp -d "$PARENT/zalo-stage.XXXXXX")"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT
trap 'exit 1' INT TERM

LOG_DIR="$STAGE/logs"
mkdir "$LOG_DIR"
ENV_FILE="$STAGE/.env"

cp "$ROOT/package.json" "$STAGE/package.json"
cp -R "$DIST" "$STAGE/dist"
cp "$DIST/app-config.json" "$STAGE/app-config.json"

cd "$STAGE"

# ---------------------------------------------------------------- đăng nhập
if [[ "$KIND" == "access" ]]; then
  log "Đăng nhập Zalo CLI bằng access token..."
  set +e
  timeout --kill-after=10 300 env -u ZMP_ACCESS_TOKEN -u ZMP_TOKEN "$ZMP_CLI_BIN" login \
    --app-id "$ZMP_APP_ID" --token "$ZMP_ACCESS_TOKEN" >"$LOG_DIR/login.log" 2>&1 </dev/null
  LOGIN_RC=$?
  set -e
  JWT="$(read_env_value ZMP_TOKEN)"
  if [[ -z "$JWT" ]]; then
    log "zmp login trả mã ${LOGIN_RC}, nhưng .env không có ZMP_TOKEN. Đuôi log (đã che):" >&2
    redact < "$LOG_DIR/login.log" | tail -n 5 >&2
    die "$EXIT_LOGIN" "Đăng nhập thất bại: không có ZMP_TOKEN trong .env."
  fi
else
  JWT="$ZMP_ACCESS_TOKEN"
  [[ "$JWT" =~ ^[A-Za-z0-9_=+/-]+\.[A-Za-z0-9_=+/-]+\.[A-Za-z0-9_=+/-]*$ ]] ||
    die "$EXIT_BAD_ARGS" "ZMP_TOKEN_KIND=jwt nhưng ZMP_ACCESS_TOKEN không có dạng JWT."
  printf 'APP_ID=%s\nZMP_TOKEN=%s\n' "$ZMP_APP_ID" "$JWT" >"$ENV_FILE"
  log "Dùng JWT có sẵn (ZMP_TOKEN_KIND=jwt), đã ghi vào .env của staging."
fi

JWT="$(read_env_value ZMP_TOKEN)"
[[ "$JWT" =~ ^[A-Za-z0-9_=+/-]+\.[A-Za-z0-9_=+/-]+\.[A-Za-z0-9_=+/-]*$ ]] ||
  die "$EXIT_LOGIN" "ZMP_TOKEN trong .env không có dạng JWT."

# Che giá trị trong log của GitHub Actions. Chỉ in khi chạy trong Actions.
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  printf '::add-mask::%s\n' "$ZMP_ACCESS_TOKEN"
  printf '::add-mask::%s\n' "$ACCESS_ENC"
  printf '::add-mask::%s\n' "$JWT"
fi

# Kiểm JWT: đọc exp và appId từ payload (không xác minh chữ ký).
PAYLOAD="$(jwt_payload "$JWT")"
[[ -n "$PAYLOAD" ]] || die "$EXIT_LOGIN" "Không đọc được payload của JWT."

EXP="$(printf '%s' "$PAYLOAD" | sed -nE 's/.*"exp"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' | head -n 1 || true)"
APP_ID_IN_JWT="$(printf '%s' "$PAYLOAD" | sed -nE 's/.*"appId"[[:space:]]*:[[:space:]]*"?([^",}[:space:]]+).*/\1/p' | head -n 1 || true)"

EXP_TEXT="không có claim exp"
if [[ -n "$EXP" ]]; then
  if (( EXP <= $(date +%s) )); then
    die "$EXIT_LOGIN" "JWT đã hết hạn (exp $(date -u -d "@${EXP}" '+%Y-%m-%dT%H:%M:%SZ')). Cần lấy token mới."
  fi
  EXP_TEXT="$(date -u -d "@${EXP}" '+%Y-%m-%dT%H:%M:%SZ')"
fi

if [[ -n "$APP_ID_IN_JWT" && "$APP_ID_IN_JWT" != "$ZMP_APP_ID" ]]; then
  die "$EXIT_LOGIN" "appId trong JWT khác ZMP_APP_ID."
fi
APP_ID_TEXT="không có claim appId"
if [[ -n "$APP_ID_IN_JWT" ]]; then
  APP_ID_TEXT="khớp ZMP_APP_ID"
fi

log "Xác thực OK: JWT hết hạn lúc ${EXP_TEXT}; ${APP_ID_TEXT}."

write_summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$@" >>"$GITHUB_STEP_SUMMARY"
  fi
}

if [[ "$MODE" == "login-only" ]]; then
  write_summary "- Đăng nhập Zalo CLI OK (JWT hết hạn: ${EXP_TEXT}). Chưa upload gì lên Zalo."
  exit 0
fi

# ---------------------------------------------------------------- deploy
ENV_NAME="Development"
DEPLOY_ARGS=(deploy -e -p)
if [[ "$MODE" == "deploy-testing" ]]; then
  ENV_NAME="Testing"
  DEPLOY_ARGS+=(-t)
fi
DEPLOY_ARGS+=(-o dist -m "$DESC")

unset ZMP_TOKEN
set +e
timeout --kill-after=10 900 env -u ZMP_ACCESS_TOKEN -u ZMP_TOKEN "$ZMP_CLI_BIN" "${DEPLOY_ARGS[@]}" \
  >"$LOG_DIR/deploy.log" 2>&1 </dev/null
DEPLOY_RC=$?
set -e

if (( DEPLOY_RC != 0 )); then
  log "Deploy lên ${ENV_NAME} thất bại. Đuôi log (đã che):" >&2
  redact < "$LOG_DIR/deploy.log" | tail -n 30 >&2
  die "$EXIT_DEPLOY" "Deploy lên ${ENV_NAME} thất bại (mã ${DEPLOY_RC})."
fi

QUOTA_LINES="$(grep -iE 'hạn mức|quota|limit|còn lại|remain' "$LOG_DIR/deploy.log" | redact || true)"
URL_LINES="$(grep -oE 'https?://[^[:space:]]+' "$LOG_DIR/deploy.log" | redact | head -n 3 || true)"

log "Đã đẩy lên Zalo ở môi trường ${ENV_NAME}. Chưa phát hành production."
if [[ -n "$QUOTA_LINES" ]]; then
  log "Hạn mức:"
  printf '%s\n' "$QUOTA_LINES"
fi
if [[ -n "$URL_LINES" ]]; then
  log "Liên kết:"
  printf '%s\n' "$URL_LINES"
fi

write_summary "- Đã đẩy lên Zalo ở môi trường ${ENV_NAME}. Chưa phát hành production." \
  "- JWT hết hạn: ${EXP_TEXT}"
if [[ -n "$QUOTA_LINES" ]]; then
  write_summary "- Dòng hạn mức từ CLI:" "$(printf '%s\n' "$QUOTA_LINES" | sed 's/^/  /')"
fi
exit 0
