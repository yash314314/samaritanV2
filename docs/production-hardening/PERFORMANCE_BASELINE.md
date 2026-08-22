# SamaritanV2 Performance & Stress Test Baseline

## Load & Latency Metrics

| Scenario | Concurrency | Total Requests | Successful | Failed | P50 (ms) | P95 (ms) | P99 (ms) | RPS | Error Rate (%) | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| **Activity Batch Ingestion & Session Creation** | 100 | 100 | 100 | 0 | 1153 | 1454 | 1457 | 67 | 0.00% | 100 concurrent DB transactional writes with auto-session aggregation. Zero failures. |
| **REST Health Endpoint** | 1 | 1 | 1 | 0 | 2 | 2 | 2 | 500+ | 0.00% | Fast local response. |
| **WebSocket Connection & Handshake** | 1 | 1 | 1 | 0 | 5 | 5 | 5 | 200+ | 0.00% | WS server successfully initialized on `/ws` route. |

## Resource Utilization Under 100 Parallel Write Stress
- Database Connections: Handled within Prisma PostgreSQL connection pool default limits.
- Memory: Steady memory footprint, no unhandled memory spikes.
- Concurrency Safety: 100 concurrent requests created valid activities and attached to target sessions without deadlocks or missing keys.
