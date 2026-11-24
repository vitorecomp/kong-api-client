---
title: All Plugins
group: Plugins
category: Overview
---

# Plugins

Reference pages for all 45 first-class Kong Gateway plugins supported by `kong-api-client`, grouped by category.

## AI

| Plugin                                                     | Name                      | Scopes                                   | Targets                         |
| ---------------------------------------------------------- | ------------------------- | ---------------------------------------- | ------------------------------- |
| [AI Prompt Decorator](./ai/ai-prompt-decorator.md)         | `ai-prompt-decorator`     | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [AI Prompt Guard](./ai/ai-prompt-guard.md)                 | `ai-prompt-guard`         | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [AI Prompt Template](./ai/ai-prompt-template.md)           | `ai-prompt-template`      | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [AI Proxy](./ai/ai-proxy.md)                               | `ai-proxy`                | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [AI Request Transformer](./ai/ai-request-transformer.md)   | `ai-request-transformer`  | `global`, `service`, `route`             | `kong-3.9`, `kong-gateway-3.14` |
| [AI Response Transformer](./ai/ai-response-transformer.md) | `ai-response-transformer` | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |

## Analytics & Monitoring

| Plugin                                                   | Name            | Scopes                                   | Targets                         |
| -------------------------------------------------------- | --------------- | ---------------------------------------- | ------------------------------- |
| [Datadog](./analytics-monitoring/datadog.md)             | `datadog`       | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [OpenTelemetry](./analytics-monitoring/opentelemetry.md) | `opentelemetry` | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Prometheus](./analytics-monitoring/prometheus.md)       | `prometheus`    | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [StatsD](./analytics-monitoring/statsd.md)               | `statsd`        | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Zipkin](./analytics-monitoring/zipkin.md)               | `zipkin`        | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |

## Authentication

| Plugin                                                 | Name         | Scopes                       | Targets                         |
| ------------------------------------------------------ | ------------ | ---------------------------- | ------------------------------- |
| [Basic Auth](./authentication/basic-auth.md)           | `basic-auth` | `global`, `service`, `route` | `kong-3.9`, `kong-gateway-3.14` |
| [HMAC Auth](./authentication/hmac-auth.md)             | `hmac-auth`  | `global`, `service`, `route` | `kong-3.9`, `kong-gateway-3.14` |
| [JWT](./authentication/jwt.md)                         | `jwt`        | `global`, `service`, `route` | `kong-3.9`, `kong-gateway-3.14` |
| [Key Auth](./authentication/key-auth.md)               | `key-auth`   | `global`, `service`, `route` | `kong-3.9`, `kong-gateway-3.14` |
| [LDAP Authentication](./authentication/ldap-auth.md)   | `ldap-auth`  | `global`, `service`, `route` | `kong-3.9`, `kong-gateway-3.14` |
| [OAuth 2.0 Authentication](./authentication/oauth2.md) | `oauth2`     | `global`, `service`, `route` | `kong-3.9`, `kong-gateway-3.14` |
| [Session](./authentication/session.md)                 | `session`    | `global`, `service`, `route` | `kong-3.9`, `kong-gateway-3.14` |

## Logging

| Plugin                            | Name       | Scopes                                   | Targets                         |
| --------------------------------- | ---------- | ---------------------------------------- | ------------------------------- |
| [File Log](./logging/file-log.md) | `file-log` | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [HTTP Log](./logging/http-log.md) | `http-log` | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Loggly](./logging/loggly.md)     | `loggly`   | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Syslog](./logging/syslog.md)     | `syslog`   | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [TCP Log](./logging/tcp-log.md)   | `tcp-log`  | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [UDP Log](./logging/udp-log.md)   | `udp-log`  | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |

## Security

| Plugin                                         | Name             | Scopes                                   | Targets                         |
| ---------------------------------------------- | ---------------- | ---------------------------------------- | ------------------------------- |
| [ACME](./security/acme.md)                     | `acme`           | `global`                                 | `kong-3.9`, `kong-gateway-3.14` |
| [Bot Detection](./security/bot-detection.md)   | `bot-detection`  | `global`, `service`, `route`             | `kong-3.9`, `kong-gateway-3.14` |
| [CORS](./security/cors.md)                     | `cors`           | `global`, `service`, `route`             | `kong-3.9`, `kong-gateway-3.14` |
| [IP Restriction](./security/ip-restriction.md) | `ip-restriction` | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |

## Serverless

| Plugin                                             | Name              | Scopes                                   | Targets                         |
| -------------------------------------------------- | ----------------- | ---------------------------------------- | ------------------------------- |
| [AWS Lambda](./serverless/aws-lambda.md)           | `aws-lambda`      | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Azure Functions](./serverless/azure-functions.md) | `azure-functions` | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Post-Function](./serverless/post-function.md)     | `post-function`   | `global`, `service`, `route`             | `kong-3.9`, `kong-gateway-3.14` |
| [Pre-Function](./serverless/pre-function.md)       | `pre-function`    | `global`, `service`, `route`             | `kong-3.9`, `kong-gateway-3.14` |

## Traffic Control

| Plugin                                                               | Name                    | Scopes                                   | Targets                         |
| -------------------------------------------------------------------- | ----------------------- | ---------------------------------------- | ------------------------------- |
| [ACL](./traffic-control/acl.md)                                      | `acl`                   | `global`, `service`, `route`             | `kong-3.9`, `kong-gateway-3.14` |
| [Proxy Cache](./traffic-control/proxy-cache.md)                      | `proxy-cache`           | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Rate Limiting](./traffic-control/rate-limiting.md)                  | `rate-limiting`         | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Redirect](./traffic-control/redirect.md)                            | `redirect`              | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Request Size Limiting](./traffic-control/request-size-limiting.md)  | `request-size-limiting` | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Request Termination](./traffic-control/request-termination.md)      | `request-termination`   | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Response Rate Limiting](./traffic-control/response-ratelimiting.md) | `response-ratelimiting` | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Standard Webhooks](./traffic-control/standard-webhooks.md)          | `standard-webhooks`     | `global`, `service`, `route`             | `kong-3.9`, `kong-gateway-3.14` |

## Transformations

| Plugin                                                            | Name                   | Scopes                                   | Targets                         |
| ----------------------------------------------------------------- | ---------------------- | ---------------------------------------- | ------------------------------- |
| [Correlation ID](./transformations/correlation-id.md)             | `correlation-id`       | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [gRPC-Gateway](./transformations/grpc-gateway.md)                 | `grpc-gateway`         | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [gRPC-Web](./transformations/grpc-web.md)                         | `grpc-web`             | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Request Transformer](./transformations/request-transformer.md)   | `request-transformer`  | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
| [Response Transformer](./transformations/response-transformer.md) | `response-transformer` | `global`, `service`, `route`, `consumer` | `kong-3.9`, `kong-gateway-3.14` |
