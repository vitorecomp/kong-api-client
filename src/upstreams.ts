import type { Target } from './generated/entities.js';
import { UpstreamsResource } from './generated/resources.js';
import { toListQuery, type ListParams, type Page } from './pagination.js';
import { colonSegment } from './special/colon-segment.js';
import { segment, type CallOptions } from './transport.js';

/** Target health state accepted by {@link UpstreamsApi.setTargetHealth}. */
export type TargetHealthState = 'healthy' | 'unhealthy';

/** Weight distribution across healthy and unhealthy targets or addresses. */
export interface HealthWeight {
  /** Combined weight currently available for load balancing. */
  available: number;
  /** Combined weight currently marked unavailable. */
  unavailable: number;
  /** Total configured weight. */
  total: number;
  [key: string]: unknown;
}

/** Health information for a single resolved target IP and port. */
export interface TargetAddressHealth {
  /** Resolved IP address. */
  ip: string;
  /** Target port. */
  port: number;
  /** Effective weight assigned to this address. */
  weight: number;
  /** Health state string when reported by target health view. */
  health?: string;
  /** Boolean health flag when reported by balancer health view. */
  healthy?: boolean;
  [key: string]: unknown;
}

/** Target entry enriched with health data from `GET /upstreams/{upstream}/health`. */
export interface TargetHealth extends Target {
  /** Runtime health state (for example `'HEALTHY'`, `'UNHEALTHY'`, or `'HEALTHCHECKS_OFF'`). */
  health?: string;
  /** Detailed DNS and per-address health status when a balancer is active. */
  data?: {
    /** Target host name or IP address. */
    host?: string;
    /** Target port. */
    port?: number;
    /** DNS record type used to resolve the target. */
    dns?: string;
    /** Weight of this node. */
    nodeWeight?: number;
    /** Weight summary across resolved addresses. */
    weight?: HealthWeight;
    /** Resolved addresses and their individual health states. */
    addresses?: TargetAddressHealth[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Aggregate balancer health object returned when `balancerHealth: true`. */
export interface BalancerHealth {
  /** Upstream identifier. */
  id?: string;
  /** Aggregate upstream health state. */
  health?: string;
  /** Aggregate balancer health state. */
  balancer_health?: string;
  /** Detailed host and weight breakdown from Kong's balancer. */
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Response returned by `GET /upstreams/{upstream}/health` with per-target health data. */
export interface UpstreamTargetsHealthResponse {
  /** Targets with their runtime health states. */
  data: TargetHealth[];
  /** Identifier of the Kong node that reported this health snapshot. */
  node_id: string;
  /** Opaque pagination cursor for the next page, when present. */
  offset?: string;
  /** Relative URL of the next page, or `null`. */
  next?: string | null;
  [key: string]: unknown;
}

/** Response returned by `GET /upstreams/{upstream}/health?balancer_health=1`. */
export interface UpstreamBalancerHealthResponse {
  /** Aggregate balancer health summary, when a balancer is active for the upstream. */
  data?: BalancerHealth;
  /** Identifier of the Kong node that reported this health snapshot. */
  node_id: string;
  /** Relative URL of the next page, or `null`. */
  next?: string | null;
  [key: string]: unknown;
}

/** Response returned by `GET /upstreams/{upstream}/health`. */
export type UpstreamHealthResponse = UpstreamTargetsHealthResponse | UpstreamBalancerHealthResponse;

/** Options for querying upstream health via `GET /upstreams/{upstream}/health`. */
export interface UpstreamHealthOptions extends CallOptions {
  /** When `true`, sends `balancer_health=1` to retrieve aggregate balancer health. */
  balancerHealth?: boolean;
  /** Maximum number of targets to return per page. */
  size?: number;
  /** Opaque pagination cursor from a previous page's `offset`. */
  offset?: string;
}

/** Extended `/upstreams` resource adding health inspection, full target history, and manual health overrides. */
export class UpstreamsApi extends UpstreamsResource {
  /** Retrieves aggregate balancer health (`GET /upstreams/{upstream}/health?balancer_health=1`). */
  health(
    upstream: string,
    options: UpstreamHealthOptions & { balancerHealth: true },
  ): Promise<UpstreamBalancerHealthResponse>;
  /** Retrieves per-target health status for an upstream (`GET /upstreams/{upstream}/health`). */
  health(
    upstream: string,
    options?: UpstreamHealthOptions & { balancerHealth?: false },
  ): Promise<UpstreamTargetsHealthResponse>;
  /** Retrieves health status for an upstream (`GET /upstreams/{upstream}/health`). */
  health(upstream: string, options?: UpstreamHealthOptions): Promise<UpstreamHealthResponse>;
  async health(upstream: string, options?: UpstreamHealthOptions): Promise<UpstreamHealthResponse> {
    const encodedUpstream = segment(upstream);
    const hasQuery =
      options?.balancerHealth !== undefined ||
      options?.size !== undefined ||
      options?.offset !== undefined;
    const query = hasQuery
      ? {
          balancer_health:
            options?.balancerHealth !== undefined ? (options.balancerHealth ? 1 : 0) : undefined,
          size: options?.size,
          offset: options?.offset,
        }
      : undefined;

    return this.transport.request<UpstreamHealthResponse>({
      method: 'GET',
      path: `/upstreams/${encodedUpstream}/health`,
      query,
      signal: options?.signal,
    });
  }

  /** Lists all targets (including history entries) for an upstream (`GET /upstreams/{upstream}/targets/all`). */
  async allTargets(
    upstream: string,
    params?: ListParams,
    options?: CallOptions,
  ): Promise<Page<Target>> {
    const encodedUpstream = segment(upstream);
    return this.transport.request<Page<Target>>({
      method: 'GET',
      path: `/upstreams/${encodedUpstream}/targets/all`,
      query: params ? toListQuery(params) : undefined,
      signal: options?.signal,
    });
  }

  /** Marks all addresses of a target as healthy or unhealthy (`PUT /upstreams/{upstream}/targets/{target}/{healthy|unhealthy}`). */
  setTargetHealth(
    upstream: string,
    target: string,
    health: TargetHealthState,
    options?: CallOptions,
  ): Promise<void>;
  /** Marks a specific resolved address of a target as healthy or unhealthy (`PUT /upstreams/{upstream}/targets/{target}/{address}/{healthy|unhealthy}`). */
  setTargetHealth(
    upstream: string,
    target: string,
    health: TargetHealthState,
    address: string,
    options?: CallOptions,
  ): Promise<void>;
  async setTargetHealth(
    upstream: string,
    target: string,
    health: TargetHealthState,
    addressOrOptions?: string | CallOptions,
    options?: CallOptions,
  ): Promise<void> {
    const address = typeof addressOrOptions === 'string' ? addressOrOptions : undefined;
    const callOptions = typeof addressOrOptions === 'string' ? options : addressOrOptions;
    const encodedUpstream = segment(upstream);
    const encodedTarget = segment(target);
    const path =
      address !== undefined
        ? `/upstreams/${encodedUpstream}/targets/${encodedTarget}/${colonSegment(address)}/${health}`
        : `/upstreams/${encodedUpstream}/targets/${encodedTarget}/${health}`;

    await this.transport.request<unknown>({
      method: 'PUT',
      path,
      signal: callOptions?.signal,
    });
  }
}
