import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  group('health', () => {
    const r = http.get(`${BASE}/api/health`);
    check(r, {
      'health 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  const dur = metrics.http_req_duration?.values;
  const failed = metrics.http_req_failed?.values;

  return {
    'loadtest/results/load-summary.json': JSON.stringify(data, null, 2),
    stdout: `
📊 LOAD TEST RESULTS
════════════════════════════════════════
Total requests:     ${metrics.http_reqs?.values?.count || 0}
Failed requests:    ${((failed?.rate || 0) * 100).toFixed(2)}%
Avg response:       ${(dur?.avg || 0).toFixed(0)}ms
P95 response:       ${(dur?.['p(95)'] || 0).toFixed(0)}ms
P99 response:       ${(dur?.['p(99)'] || 0).toFixed(0)}ms
Max response:       ${(dur?.max || 0).toFixed(0)}ms
════════════════════════════════════════
`,
  };
}