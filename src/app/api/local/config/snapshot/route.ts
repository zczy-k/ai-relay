// ============================================================
// AI Relay API — Local Config Snapshot
// ============================================================

import { NextRequest } from 'next/server';
import type { ConfigSnapshot } from '@/lib/config-store/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { getDefaultConfigStore } = await import('@/lib/config-store');
    const store = getDefaultConfigStore();

    const snapshot: ConfigSnapshot = {
      version: await store.getConfigVersion(),
      generatedAt: new Date().toISOString(),
      providers: await store.getProviders(),
      providerKeys: {},
      modelAliases: await store.getModelAliases(),
      priorityRules: await store.getPriorityRules(),
      fallbackChains: {},
    };

    return Response.json(snapshot);
  } catch (error: any) {
    // Don't leak internal error details to client
    console.error('[config/snapshot] Error:', error);
    return Response.json(
      { error: { message: 'Failed to retrieve config snapshot', type: 'internal_error' } },
      { status: 500 }
    );
  }
}
