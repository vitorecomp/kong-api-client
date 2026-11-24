import type { Page } from '../pagination.js';
import type { CallOptions, Transport } from '../transport.js';

/** A connected hybrid-mode data plane returned by `GET /clustering/data-planes`. */
export interface ClusteringDataPlane {
  /** Unique identifier of the data plane node. */
  id: string;
  /** IP address of the data plane node. */
  ip: string;
  /** Hostname of the data plane node. */
  hostname: string;
  /** Unix timestamp when the data plane was last seen. */
  last_seen: number;
  /** Hash of the configuration currently running on the data plane. */
  config_hash: string;
  /** Kong version reported by the data plane, when present. */
  version?: string;
  /** Configuration sync status, when present. */
  sync_status?: string;
  [key: string]: unknown;
}

/** Pagination parameters for `GET /clustering/data-planes`. */
export interface ClusteringDataPlanesParams {
  /** Maximum number of data planes to return per page. */
  size?: number;
  /** Opaque pagination cursor from a previous page's `offset`. */
  offset?: string;
}

/** Per-node status entry returned by `GET /clustering/status`. */
export interface ClusteringDataPlaneStatus {
  /** Hash of the configuration running on the data plane. */
  config_hash: string;
  /** Hostname of the data plane. */
  hostname: string;
  /** IP address of the data plane. */
  ip: string;
  /** Unix timestamp when the data plane was last seen. */
  last_seen: number;
  [key: string]: unknown;
}

/** Map of data plane node IDs to status summaries returned by `GET /clustering/status`. */
export type ClusteringStatus = Record<string, ClusteringDataPlaneStatus>;

/** Admin API endpoints for inspecting hybrid-mode cluster data planes on a Control Plane node. */
export class ClusteringApi {
  private readonly transport: Transport;

  /** Creates a {@link ClusteringApi} bound to the given transport. */
  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Lists connected data planes (`GET /clustering/data-planes`). Control Plane nodes only. */
  dataPlanes(
    params?: ClusteringDataPlanesParams,
    options?: CallOptions,
  ): Promise<Page<ClusteringDataPlane>> {
    return this.transport.request<Page<ClusteringDataPlane>>({
      method: 'GET',
      path: '/clustering/data-planes',
      query: params ? { size: params.size, offset: params.offset } : undefined,
      signal: options?.signal,
    });
  }

  /** Retrieves status of connected data planes (`GET /clustering/status`). Control Plane nodes only. */
  status(options?: CallOptions): Promise<ClusteringStatus> {
    return this.transport.request<ClusteringStatus>({
      method: 'GET',
      path: '/clustering/status',
      signal: options?.signal,
    });
  }
}
