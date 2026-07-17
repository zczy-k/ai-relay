// ============================================================
// AI API Relay — Routing Strategy Engine
// ============================================================
// Implements 3 routing strategies: latency, cost, availability.
// Each strategy scores providers and returns a ranked decision.

import type {
  RoutingStrategy,
  RoutingConfig,
  RoutingDecision,
  ProviderHealthInfo,
  LatencyStats,
  ProviderCostWeight,
} from './types';
import { getLatencyStats, getSuccessRate } from './latency-tracker';

/**
 * Score a provider for the "latency-first" strategy.
 * Lower score = better candidate.
 */
function scoreByLatency(stats: LatencyStats, maxLatencyMs: number): number {
  if (stats.sampleCount === 0) return maxLatencyMs * 2; // No data → worst score
  return stats.p50LatencyMs; // Use p50 for stability
}

/**
 * Score a provider for the "cost-first" strategy.
 * Lower score = cheaper.
 */
function scoreByCost(
  provider: string,
  costWeights: ProviderCostWeight[],
  latencyStats: LatencyStats
): number {
  const cost = costWeights.find((cw) => cw.provider === provider);
  if (!cost) return 100; // No cost data → neutral score

  // Blend cost with a small latency penalty to avoid routing to totally dead providers
  const costScore = cost.costPerMillionTokens * (1 / Math.max(cost.weight, 0.01));
  const latencyPenalty = latencyStats.sampleCount > 0
    ? (latencyStats.avgLatencyMs / 1000) * 0.1  // 10% weight on latency
    : 0.5; // Slight penalty for unknown

  return costScore + latencyPenalty;
}

/**
 * Score a provider for the "availability-first" strategy.
 * Lower score = more available/reliable.
 */
function scoreByAvailability(health: ProviderHealthInfo): number {
  let score = 0;

  // Heavy penalty for unhealthy providers
  if (health.status === 'down') score += 1000;
  if (health.status === 'degraded') score += 100;
  if (health.status === 'unknown') score += 50;

  // Failure penalty
  score += health.consecutiveFailures * 50;

  // Success rate penalty (0-1, inverted)
  score += (1 - health.successRate) * 200;

  // Latency tiebreaker (minor)
  score += Math.min(health.avgLatencyMs / 100, 20);

  return score;
}

/**
 * Route a request to the best provider using the configured strategy.
 *
 * @param config  Routing configuration
 * @param healthData  Current health info for all providers
 * @param preferredProvider  The originally requested provider (from model resolution)
 * @returns Routing decision with scored provider ranking
 */
export async function routeByStrategy(
  config: RoutingConfig,
  healthData: Map<string, ProviderHealthInfo>,
  preferredProvider?: string,
  preloadedLatency?: Map<string, LatencyStats>
): Promise<RoutingDecision> {
  const providers = Array.from(healthData.keys());
  if (providers.length === 0) {
    return {
      provider: preferredProvider || '',
      reason: 'No providers available',
      score: Infinity,
      fallbackChain: [],
    };
  }

  // Use pre-loaded latency stats if available (avoids N KV reads on cold start)
  const latencyMap = preloadedLatency ?? new Map<string, LatencyStats>();
  if (!preloadedLatency) {
    for (const p of providers) {
      latencyMap.set(p, await getLatencyStats(p));
    }
  }

  // Score each provider based on strategy
  const scored: Array<{ provider: string; score: number }> = [];

  for (const provider of providers) {
    const health = healthData.get(provider)!;
    const latency = latencyMap.get(provider)!;
    let score: number;

    switch (config.strategy) {
      case 'latency':
        score = scoreByLatency(latency, config.maxLatencyMs);
        break;
      case 'cost':
        score = scoreByCost(provider, config.costWeights, latency);
        break;
      case 'availability':
        score = scoreByAvailability(health);
        break;
      default:
        score = scoreByLatency(latency, config.maxLatencyMs);
    }

    // Check if provider is down — add massive penalty
    if (health.status === 'down') {
      score += 10000;
    }

    scored.push({ provider, score });
  }

  // Sort by score (ascending — lower is better)
  scored.sort((a, b) => a.score - b.score);

  // Keep the originally-resolved provider when it is "good enough": available
  // (not down) and scoring within preferredProviderTolerancePercent of the best
  // candidate. This avoids churning the route on marginal differences while
  // still switching away when another provider is meaningfully better. With a
  // tolerance of 0 the preferred provider is only kept on an exact tie.
  if (preferredProvider) {
    const preferredIdx = scored.findIndex((s) => s.provider === preferredProvider);
    if (preferredIdx > 0) {
      const preferredHealth = healthData.get(preferredProvider);
      const bestScore = scored[0].score;
      const preferredScore = scored[preferredIdx].score;
      const tolerance = 1 + (config.preferredProviderTolerancePercent ?? 20) / 100;
      if (
        preferredHealth &&
        preferredHealth.status !== 'down' &&
        (bestScore <= 0 || preferredScore <= bestScore * tolerance)
      ) {
        const entry = scored.splice(preferredIdx, 1)[0];
        scored.unshift(entry);
      }
    }
  }

  const best = scored[0];
  const fallbackChain = scored.slice(1).map((s) => s.provider);

  // Determine reason
  let reason: string;
  switch (config.strategy) {
    case 'latency':
      reason = `Lowest latency: ${latencyMap.get(best.provider)?.avgLatencyMs ?? '?'}ms avg`;
      break;
    case 'cost':
      reason = `Lowest cost: ${best.provider}`;
      break;
    case 'availability':
      reason = `Best availability: ${healthData.get(best.provider)?.status ?? 'unknown'}`;
      break;
    default:
      reason = `Selected ${best.provider}`;
  }

  return {
    provider: best.provider,
    reason,
    score: best.score,
    fallbackChain,
  };
}
