// ============================================================
// AI API Relay — Smart Routing Types
// ============================================================

/** Routing strategy modes */
export type RoutingStrategy = 'latency' | 'cost' | 'availability';

/** Provider health status */
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

/** Latency sample recorded per request */
export interface LatencyRecord {
  provider: string;
  latencyMs: number;
  timestamp: number;
  success: boolean;
  statusCode?: number;
}

/** Aggregated latency stats for a provider */
export interface LatencyStats {
  provider: string;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  sampleCount: number;
  lastUpdated: number;
}

/** Provider health summary */
export interface ProviderHealthInfo {
  provider: string;
  displayName: string;
  status: ProviderHealthStatus;
  avgLatencyMs: number;
  successRate: number;       // 0-1
  consecutiveFailures: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  availableKeys: number;
  totalKeys: number;
}

/** Cost weight per provider (for cost-first strategy) */
export interface ProviderCostWeight {
  provider: string;
  costPerMillionTokens: number;  // USD per 1M tokens
  weight: number;                // normalized weight (0-1)
}

/** Routing configuration stored in KV */
export interface RoutingConfig {
  /**
   * Master switch. When true, smart routing fully takes over provider
   * selection and failover — priority rules and traditional fallback chains
   * are disabled. When false, smart routing is inert regardless of updatedAt.
   */
  enabled: boolean;
  strategy: RoutingStrategy;
  /** Cost weights — only used when strategy is 'cost' */
  costWeights: ProviderCostWeight[];
  /** Max acceptable latency for latency-first strategy */
  maxLatencyMs: number;
  /** Failure threshold for auto-failover */
  failureThreshold: number;
  /** Auto-recovery after N seconds of stability */
  recoverySeconds: number;
  /** Sticky session: same client routes to same provider */
  stickySession: boolean;
  /** Per-provider timeout override */
  providerTimeoutMs: Record<string, number>;
  /** Max retries per provider */
  maxRetries: number;
  /**
   * Tolerance (percent) for keeping the originally-resolved provider. If its
   * score is within this percentage of the best candidate's score, it is kept
   * rather than switched, to avoid churn on marginal differences. Default 20.
   */
  preferredProviderTolerancePercent: number;
  updatedAt: number;
}

/** Routing decision result */
export interface RoutingDecision {
  provider: string;
  reason: string;
  score: number;           // lower is better
  fallbackChain: string[]; // ordered fallback providers
}

/** Real-time routing status for the dashboard */
export interface RoutingStatus {
  strategy: RoutingStrategy;
  activeProviders: ProviderHealthInfo[];
  recentSwitches: Array<{
    from: string;
    to: string;
    reason: string;
    timestamp: number;
  }>;
  totalRequests: number;
  routingSince: number;
}

/** Default routing config */
export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  enabled: false,
  strategy: 'latency',
  costWeights: [],
  maxLatencyMs: 2000,
  failureThreshold: 3,
  recoverySeconds: 30,
  stickySession: false,
  providerTimeoutMs: {},
  maxRetries: 3,
  preferredProviderTolerancePercent: 20,
  updatedAt: 0,
};
