import type { CallOptions, Transport } from '../transport.js';

/** Metadata for a plugin available on a Kong node. */
export interface NodePluginAvailability {
  /** Plugin version reported by Kong, when available. */
  version?: string;
  /** Execution priority of the plugin, when available. */
  priority?: number;
  [key: string]: unknown;
}

/** Timer summary reported by `GET /`. */
export interface NodeInfoTimers {
  /** Number of currently running timers. */
  running: number;
  /** Number of pending timers. */
  pending: number;
  [key: string]: unknown;
}

/** Plugin summary reported by `GET /`. */
export interface NodeInfoPlugins {
  /** Plugins installed on this node, keyed by plugin name. */
  available_on_server: Record<string, NodePluginAvailability | boolean>;
  /** Names of plugins currently enabled in the cluster. */
  enabled_in_cluster: string[];
  [key: string]: unknown;
}

/** Process identifiers reported by `GET /`. */
export interface NodeInfoPids {
  /** Master Nginx process ID. */
  master: number;
  /** Worker Nginx process IDs, when available. */
  workers?: number[];
  [key: string]: unknown;
}

/** Node information returned by `GET /`. */
export interface NodeInfo {
  /** Kong version string. */
  version: string;
  /** Kong edition (for example `'community'` or `'enterprise'`). */
  edition: string;
  /** Kong welcome tagline. */
  tagline: string;
  /** Hostname of the Kong node. */
  hostname: string;
  /** Unique identifier of the Kong node. */
  node_id: string;
  /** Lua runtime version string. */
  lua_version: string;
  /** Active and pending timer counts. */
  timers: NodeInfoTimers;
  /** Available and cluster-enabled plugins. */
  plugins: NodeInfoPlugins;
  /** Master and worker process IDs. */
  pids: NodeInfoPids;
  /** Redacted effective Kong configuration. */
  configuration: Record<string, unknown>;
  [key: string]: unknown;
}

/** Memory usage of one Nginx `lua_shared_dict` zone. */
export interface SharedDictMemory {
  /** Memory currently allocated in slabs (human-readable string). */
  allocated_slabs: string;
  /** Total configured capacity of the shared dictionary. */
  capacity: string;
  [key: string]: unknown;
}

/** Lua VM memory usage of one Kong worker process. */
export interface WorkerLuaVmMemory {
  /** Garbage-collected Lua memory allocated in the HTTP subsystem. */
  http_allocated_gc: string;
  /** Worker process ID. */
  pid: number;
  [key: string]: unknown;
}

/** Health and runtime status returned by `GET /status`. */
export interface NodeStatus {
  /** Database connectivity state. */
  database: {
    /** Whether the configured datastore is reachable. */
    reachable: boolean;
    [key: string]: unknown;
  };
  /** Nginx HTTP connection and request counters. */
  server: {
    /** Total accepted client connections. */
    connections_accepted: number;
    /** Currently active client connections. */
    connections_active: number;
    /** Total handled client connections. */
    connections_handled: number;
    /** Connections currently reading request headers. */
    connections_reading: number;
    /** Idle keep-alive client connections. */
    connections_waiting: number;
    /** Connections currently writing responses. */
    connections_writing: number;
    /** Total client requests handled. */
    total_requests: number;
    [key: string]: unknown;
  };
  /** Shared dictionary and per-worker Lua VM memory statistics. */
  memory: {
    /** Shared dictionary memory usage keyed by dictionary name. */
    lua_shared_dicts: Record<string, SharedDictMemory>;
    /** Per-worker Lua VM memory snapshots. */
    workers_lua_vms: WorkerLuaVmMemory[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Worker identity metadata returned by `/status/dns` and `/timers`. */
export interface WorkerInfo {
  /** Zero-based index of the worker that handled the request. */
  id: number;
  /** Total number of Nginx workers running on the node. */
  count: number;
  [key: string]: unknown;
}

/** DNS client status returned by `GET /status/dns`. */
export interface DnsStatus {
  /** Worker that served this status snapshot. */
  worker: WorkerInfo;
  /** DNS client statistics reported by Kong's new DNS client. */
  stats: Record<string, unknown>;
  [key: string]: unknown;
}

/** List of Admin API endpoint templates returned by `GET /endpoints`. */
export interface NodeEndpoints {
  /** Sorted list of Admin API endpoint paths registered on the node. */
  data: string[];
  [key: string]: unknown;
}

/** Runtime timer debugging information returned by `GET /timers`. */
export interface NodeTimers {
  /** Worker that served this timer snapshot. */
  worker: WorkerInfo;
  /** Timer subsystem statistics and per-timer metrics. */
  stats: {
    /** Aggregate system timer counters, when present. */
    sys?: Record<string, unknown>;
    /** Individual timer statistics keyed by timer name, when present. */
    timers?: Record<string, unknown>;
    /** Flamegraph data for timer execution, when present. */
    flamegraph?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Admin API endpoints for inspecting Kong node status, metadata, timers, and metrics. */
export class NodeApi {
  private readonly transport: Transport;

  /** Creates a {@link NodeApi} bound to the given transport. */
  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Retrieves Kong node information (`GET /`). */
  info(options?: CallOptions): Promise<NodeInfo> {
    return this.transport.request<NodeInfo>({
      method: 'GET',
      path: '/',
      signal: options?.signal,
    });
  }

  /** Retrieves Kong node health and connection status (`GET /status`). */
  status(options?: CallOptions): Promise<NodeStatus> {
    return this.transport.request<NodeStatus>({
      method: 'GET',
      path: '/status',
      signal: options?.signal,
    });
  }

  /** Retrieves DNS client statistics (`GET /status/dns`). Requires Kong's new DNS client. */
  dnsStatus(options?: CallOptions): Promise<DnsStatus> {
    return this.transport.request<DnsStatus>({
      method: 'GET',
      path: '/status/dns',
      signal: options?.signal,
    });
  }

  /** Lists all Admin API endpoints registered on the node (`GET /endpoints`). */
  endpoints(options?: CallOptions): Promise<NodeEndpoints> {
    return this.transport.request<NodeEndpoints>({
      method: 'GET',
      path: '/endpoints',
      signal: options?.signal,
    });
  }

  /** Retrieves runtime debugging statistics for Kong's background timers (`GET /timers`). */
  timers(options?: CallOptions): Promise<NodeTimers> {
    return this.transport.request<NodeTimers>({
      method: 'GET',
      path: '/timers',
      signal: options?.signal,
    });
  }

  /** Retrieves Prometheus-formatted metrics text (`GET /metrics`). */
  metrics(options?: CallOptions): Promise<string> {
    return this.transport.request<string>({
      method: 'GET',
      path: '/metrics',
      signal: options?.signal,
    });
  }
}
