import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const res = http.get(`${BASE}/api/health`);
  check(res, {
    'health returns 200': (r) => r.status === 200,
    'health is fast': (r) => r.timings.duration < 200,
  });
  sleep(1);
}

export function handleSummary(data) {
  return {
    'loadtest/results/smoke-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  const dur = metrics.http_req_duration?.values;
  const failed = metrics.http_req_failed?.values;

  return `
📊 SMOKE TEST RESULTS
════════════════════════════════════════
Total requests:     ${metrics.http_reqs?.values?.count || 0}
Failed requests:    ${((failed?.rate || 0) * 100).toFixed(2)}%
Avg response:       ${(dur?.avg || 0).toFixed(0)}ms
P95 response:       ${(dur?.['p(95)'] || 0).toFixed(0)}ms
P99 response:       ${(dur?.['p(99)'] || 0).toFixed(0)}ms
Max response:       ${(dur?.max || 0).toFixed(0)}ms
════════════════════════════════════════
`;
}
