#!/usr/bin/env bash
set -e

parse_and_log_response() {
  local LABEL=$1
  local HTTP_RESPONSE=$2

  local HTTP_BODY
  local HTTP_STATUS
  local TOTAL_TIME

  HTTP_BODY=$(echo "$HTTP_RESPONSE" | sed '$d' | sed '$d')
  HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n 2 | head -n 1)
  TOTAL_TIME=$(echo "$HTTP_RESPONSE" | tail -n 1)

  echo "─── Test: ${LABEL} ───"
  echo "Status Code : '${HTTP_STATUS}'"
  echo "Duration    : '${TOTAL_TIME}s'"
  echo "Body        : '${HTTP_BODY}'"

  if [ "$HTTP_STATUS" -eq 200 ] 2>/dev/null; then
    echo "✅ Evaluated as: Healthy and available (200)"
  elif [ "$HTTP_STATUS" -eq 502 ] 2>/dev/null || [ "$HTTP_STATUS" -eq 503 ] 2>/dev/null || [ "$HTTP_STATUS" -eq 504 ] 2>/dev/null; then
    echo "⏳ Evaluated as: Waking up from idle sleep (HTTP $HTTP_STATUS)"
  elif [ "$HTTP_STATUS" -eq 0 ] 2>/dev/null || [ "$HTTP_STATUS" = "000" ]; then
    echo "⚠️ Evaluated as: Request timed out or network unreachable"
  else
    echo "ℹ️ Evaluated as: Unexpected HTTP status ($HTTP_STATUS)"
  fi
  echo ""
}

echo "=== 1. Live Render Health Check Request ==="
TARGET_URL="https://voco-backend.onrender.com/api/health"
LIVE_RESPONSE=$(curl -s -S -w "\n%{http_code}\n%{time_total}" --max-time 30 "$TARGET_URL" || echo -e "\n000\n0")
parse_and_log_response "Live Render Backend" "$LIVE_RESPONSE"

echo "=== 2. Simulated Cold Start 502 Bad Gateway ==="
SIM_502=$(echo -e "<html><title>502 Bad Gateway</title></html>\n502\n1.240")
parse_and_log_response "Simulated 502 Gateway" "$SIM_502"

echo "=== 3. Simulated 503 Service Unavailable ==="
SIM_503=$(echo -e "Service temporarily unavailable\n503\n0.850")
parse_and_log_response "Simulated 503 Unavailable" "$SIM_503"

echo "=== 4. Simulated Timeout (curl failure / exit non-zero) ==="
SIM_TIMEOUT=$(echo -e "\n000\n45.000")
parse_and_log_response "Simulated Timeout" "$SIM_TIMEOUT"

echo "=== 5. Simulated 404 Unexpected Error ==="
SIM_404=$(echo -e '{"error":"Not Found"}\n404\n0.320')
parse_and_log_response "Simulated 404" "$SIM_404"
