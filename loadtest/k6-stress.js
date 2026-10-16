import http from 'k6/http';
import { check, sleep } from 'k6';

// ⚠️ Only run against STAGING/PRODUCTION with high resources.
//    Running 1000 VUs locally will overwhelm your machine.
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 500 },
    { duration: '3m', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const r = http.get(`${BASE}/api/health`);
  check(r, { 'health ok': (r) => r.status === 200 });
  sleep(2);
}
