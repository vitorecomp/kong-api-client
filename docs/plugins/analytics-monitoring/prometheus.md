---
title: Prometheus
group: Plugins
category: Analytics & Monitoring
---

# Prometheus (`prometheus`)

- **Category:** Analytics & Monitoring
- **Kong documentation:** [https://developer.konghq.com/plugins/prometheus/](https://developer.konghq.com/plugins/prometheus/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('prometheus', {
  on: { route: 'my-route' },
  config: { latency_metrics: true, status_code_metrics: true, per_consumer: false },
});
```

## Configuration fields

| Field                     | Type      | Required | Default | Description                                                                                                                                                                                           |
| ------------------------- | --------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_metrics`              | `boolean` | No       | `false` | A boolean value that determines if ai metrics should be collected. If enabled, the `ai_llm_requests_total`, `ai_llm_cost_total` and `ai_llm_tokens_total` metrics will be exported.                   |
| `bandwidth_metrics`       | `boolean` | No       | `false` | A boolean value that determines if bandwidth metrics should be collected. If enabled, `bandwidth_bytes` and `stream_sessions_total` metrics will be exported.                                         |
| `latency_metrics`         | `boolean` | No       | `false` | A boolean value that determines if latency metrics should be collected. If enabled, `kong_latency_ms`, `upstream_latency_ms` and `request_latency_ms` metrics will be exported.                       |
| `per_consumer`            | `boolean` | No       | `false` | A boolean value that determines if per-consumer metrics should be collected. If enabled, the `kong_http_requests_total` and `kong_bandwidth_bytes` metrics fill in the consumer label when available. |
| `status_code_metrics`     | `boolean` | No       | `false` | A boolean value that determines if status code metrics should be collected. If enabled, `http_requests_total`, `stream_sessions_total` metrics will be exported.                                      |
| `upstream_health_metrics` | `boolean` | No       | `false` | A boolean value that determines if upstream metrics should be collected. If enabled, `upstream_target_health` metric will be exported.                                                                |
| `wasm_metrics`            | `boolean` | No       | —       | Kong Gateway 3.14 only.                                                                                                                                                                               |
