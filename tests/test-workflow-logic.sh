#!/usr/bin/env bash
set -e

test_window() {
  local IST_HOUR=$1
  local IST_MIN=$2
  local EVENT=$3
  local IS_OVERNIGHT=0
  if [ "$IST_HOUR" -ge 1 ] && [ "$IST_HOUR" -le 6 ]; then
    IS_OVERNIGHT=1
  elif [ "$IST_HOUR" -eq 0 ] && [ "$IST_MIN" -gt 0 ]; then
    IS_OVERNIGHT=1
  fi

  if [ "$EVENT" = "schedule" ] && [ "$IS_OVERNIGHT" -eq 1 ]; then
    echo "IST ${IST_HOUR}:${IST_MIN} (${EVENT}) => SKIP (Overnight Idle)"
  else
    echo "IST ${IST_HOUR}:${IST_MIN} (${EVENT}) => RUN (Active Daytime)"
  fi
}

echo "=== Testing Gatekeeper Boundaries ==="
test_window 0 0 schedule
test_window 0 1 schedule
test_window 0 10 schedule
test_window 0 59 schedule
test_window 1 0 schedule
test_window 3 30 schedule
test_window 6 59 schedule
test_window 7 0 schedule
test_window 7 10 schedule
test_window 12 0 schedule
test_window 18 30 schedule
test_window 23 50 schedule
test_window 23 59 schedule
echo ""
echo "=== Testing Manual Workflow Dispatch ==="
test_window 3 0 workflow_dispatch
test_window 0 15 workflow_dispatch
test_window 14 0 workflow_dispatch
