# Load Testing

Runs realistic load against the API.

## Prerequisites

Install k6:

- `choco install k6` (Chocolatey)
- `winget install k6` (WinGet)
- Or download from https://github.com/grafana/k6/releases

## Tests

### 1. Smoke (10 users, 30s)
Just checks the API responds.

```bash
k6 run loadtest/k6-smoke.js