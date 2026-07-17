// ============================================================
// AI Relay API — Local Config Version
// ============================================================

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { getDefaultConfigStore } = await import('@/lib/config-store');
    const store = getDefaultConfigStore();
    const version = await store.getConfigVersion();

    return Response.json({ version });
  } catch (error: any) {
    // Don't leak internal error details to client
    console.error('[config/version] Error:', error);
    return Response.json(
      { error: { message: 'Failed to retrieve config version', type: 'internal_error' } },
      { status: 500 }
    );
  }
}
