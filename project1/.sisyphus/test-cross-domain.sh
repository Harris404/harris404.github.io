#!/bin/bash
# Cross-Domain Routing Test Suite
# Tests Wave 3 multi-agent coordination

API_URL="http://localhost:8787/api/chat"
RESULTS_FILE="/tmp/cross_domain_test_results.txt"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Cross-Domain Routing Test Suite ===" > "$RESULTS_FILE"
echo "Started: $(date)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

PASS_COUNT=0
FAIL_COUNT=0
TOTAL_TESTS=10

test_query() {
  local TEST_NUM=$1
  local QUERY=$2
  local EXPECTED_AGENTS=$3 # Comma-separated, e.g., "finance,life"
  local DESCRIPTION=$4
  
  echo -e "${YELLOW}[Test $TEST_NUM] $DESCRIPTION${NC}"
  echo "[Test $TEST_NUM] $DESCRIPTION" >> "$RESULTS_FILE"
  echo "Query: $QUERY" >> "$RESULTS_FILE"
  echo "Expected agents: $EXPECTED_AGENTS" >> "$RESULTS_FILE"
  
  # Send request with 20s timeout, parse directly from file (avoids shell encoding issues)
  TMPFILE=$(mktemp)
  curl -s -m 20 -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"$QUERY\"}" -o "$TMPFILE" 2>/dev/null
  CURL_EXIT=$?
  
  if [ $CURL_EXIT -ne 0 ]; then
    rm -f "$TMPFILE"
    echo -e "${RED}\u2717 FAIL - Request timeout or error${NC}"
    echo "FAIL - Request timeout" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    ((FAIL_COUNT++))
    return 1
  fi
  
  # Extract agents field using python for robust encoding handling
  AGENTS=$(python3 -c "
import json, sys
d = json.load(open('$TMPFILE'))
agents = d.get('agents')
if isinstance(agents, list):
    print(','.join(agents))
else:
    agent = d.get('agent', 'ERROR')
    print(agent if agent else 'ERROR')
" 2>/dev/null || echo 'ERROR')
  rm -f "$TMPFILE"
  
  echo "Actual agents: $AGENTS" >> "$RESULTS_FILE"
  
  # Check if matches expected (order may vary)
  IFS=',' read -ra EXPECTED_ARR <<< "$EXPECTED_AGENTS"
  IFS=',' read -ra ACTUAL_ARR <<< "$AGENTS"
  
  # Sort both arrays for comparison
  EXPECTED_SORTED=$(echo "${EXPECTED_ARR[@]}" | tr ' ' '\n' | sort | tr '\n' ',')
  ACTUAL_SORTED=$(echo "${ACTUAL_ARR[@]}" | tr ' ' '\n' | sort | tr '\n' ',')
  
  if [ "$EXPECTED_SORTED" = "$ACTUAL_SORTED" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo "PASS" >> "$RESULTS_FILE"
    ((PASS_COUNT++))
  else
    echo -e "${RED}✗ FAIL - Expected: $EXPECTED_AGENTS, Got: $AGENTS${NC}"
    echo "FAIL" >> "$RESULTS_FILE"
    ((FAIL_COUNT++))
  fi
  
  echo "" >> "$RESULTS_FILE"
  sleep 2 # Rate limiting - give server time between requests
}

echo "Starting cross-domain routing tests..."
echo ""

# Test 1: Finance + Life (rental + supermarket)
test_query 1 \
  "租房附近有超市吗？" \
  "finance,life" \
  "Rental (finance) + Supermarket (life)"

# Test 2: Wellness + Life (attractions + transport)
test_query 2 \
  "去Blue Mountains怎么坐车？" \
  "wellness,life" \
  "Tourist attraction (wellness) + Transport (life)"

# Test 3: Education + Finance (course + job salary)
test_query 3 \
  "悉尼大学计算机专业毕业工资多少？" \
  "education,finance" \
  "University course (education) + Job salary (finance)"

# Test 4: Healthcare + Life (GP + transport)
test_query 4 \
  "附近的GP诊所怎么去？" \
  "healthcare,life" \
  "GP location (healthcare) + Directions (life)"

# Test 5: Healthcare + Life (finding doctor while traveling in Australia)
test_query 5 \
  "在澳洲旅游时需要看心理医生怎么办？" \
  "healthcare,life" \
  "Mental health (healthcare) + Practical help in Australia (life)"
test_query 6 \
  "学生签证需要什么条件？有哪些推荐的课程？" \
  "finance,education" \
  "Visa requirements (finance) + Course recommendations (education)"

# Test 7: Life + Wellness (weather + outdoor activity)
test_query 7 \
  "周末天气适合去爬山吗？" \
  "life,wellness" \
  "Weather (life) + Outdoor activity (wellness)"

# Test 8: Finance + Healthcare (Medicare + tax)
test_query 8 \
  "Medicare卡申请后会影响税务吗？" \
  "finance,healthcare" \
  "Tax implications (finance) + Medicare (healthcare)"

# Test 9: Education + Life (university + transport)
test_query 9 \
  "去UNSW上课怎么坐车？" \
  "education,life" \
  "University (education) + Transport (life)"

# Test 10: Three-domain query (Finance + Life + Healthcare)
test_query 10 \
  "租房后附近有GP吗？看病怎么报税？" \
  "finance,healthcare,life" \
  "Rental (finance) + GP (healthcare) + Nearby (life) - Complex multi-domain"

# Summary
echo "" >> "$RESULTS_FILE"
echo "=== Test Summary ===" >> "$RESULTS_FILE"
echo "Total Tests: $TOTAL_TESTS" >> "$RESULTS_FILE"
echo "Passed: $PASS_COUNT" >> "$RESULTS_FILE"
echo "Failed: $FAIL_COUNT" >> "$RESULTS_FILE"
echo "Success Rate: $(( PASS_COUNT * 100 / TOTAL_TESTS ))%" >> "$RESULTS_FILE"
echo "Completed: $(date)" >> "$RESULTS_FILE"

echo ""
echo "=== Test Summary ==="
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
SUCCESS_RATE=$(( PASS_COUNT * 100 / TOTAL_TESTS ))
echo "Success Rate: $SUCCESS_RATE%"
echo ""
echo "Detailed results saved to: $RESULTS_FILE"

if [ $SUCCESS_RATE -ge 90 ]; then
  echo -e "${GREEN}✓ Wave 3 cross-domain routing: EXCELLENT (≥90%)${NC}"
  exit 0
elif [ $SUCCESS_RATE -ge 70 ]; then
  echo -e "${YELLOW}⚠ Wave 3 cross-domain routing: ACCEPTABLE (70-89%)${NC}"
  exit 0
else
  echo -e "${RED}✗ Wave 3 cross-domain routing: NEEDS IMPROVEMENT (<70%)${NC}"
  exit 1
fi
