#!/bin/bash
# Routing Accuracy Test Suite
# Tests 10 diverse queries across all 5 agents

# Test queries (expected_agent|query)
declare -a tests=(
  "life|Sydney weather tomorrow"
  "life|Woolworths有什么特价"
  "finance|年收入8万交多少税"
  "finance|AUD to CNY exchange rate"
  "education|UNSW计算机课程"
  "healthcare|怎么预约GP"
  "wellness|墨尔本三日游攻略"
  "wellness|Sydney tourist attractions guide"
  "life|附近有餐厅吗"
  "wellness|悉尼有什么好玩的景点"
)

echo "=== Routing Accuracy Test ==="
echo "Testing 10 queries across 5 agents"
echo ""

passed=0
failed=0
results_file="/tmp/routing_test_results.txt"
> $results_file

for test in "${tests[@]}"; do
  IFS='|' read -r expected query <<< "$test"
  
  echo -n "Testing: \"$query\" (expect: $expected)... "
  
  # Make API call - write to temp file, parse directly to handle encoding
  TMPFILE=$(mktemp)
  curl -s -m 20 -X POST http://localhost:8787/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"$query\"}" -o "$TMPFILE" 2>/dev/null
  # Extract primary agent: check .agent (single-domain) or .agents[] (cross-domain contains expected)
  actual=$(python3 -c "
import json, sys
d = json.load(open('$TMPFILE'))
agent = d.get('agent')
agents = d.get('agents', [])
if agent:
    print(agent)
elif '$expected' in (agents or []):
    print('$expected')  # expected domain is present in cross-domain result
else:
    print(','.join(agents) if agents else 'ERROR')
" 2>/dev/null || echo 'ERROR')
  rm -f "$TMPFILE"
  
  if [ "$actual" == "$expected" ]; then
    echo "✅ PASS (routed to $actual)"
    ((passed++))
    echo "PASS|$expected|$actual|$query" >> $results_file
  else
    echo "❌ FAIL (routed to $actual, expected $expected)"
    ((failed++))
    echo "FAIL|$expected|$actual|$query" >> $results_file
  fi
  
  sleep 0.5
done

echo ""
echo "=== Test Summary ==="
echo "Passed: $passed/10 ($(( passed * 100 / 10 ))%)"
echo "Failed: $failed/10"
echo ""

if [ $passed -ge 10 ]; then
  echo "✅ 100% accuracy - EXCELLENT!"
elif [ $passed -ge 9 ]; then
  echo "✅ 90%+ accuracy - GOOD (target: 95%)"
elif [ $passed -ge 8 ]; then
  echo "⚠️  80%+ accuracy - ACCEPTABLE (target: 95%)"
else
  echo "❌ <80% accuracy - NEEDS IMPROVEMENT"
fi

echo ""
echo "Detailed results saved to: $results_file"
cat $results_file
