// ============================================================
// AI Relay API — Device Verification (Admin UI)
// ============================================================

import { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import { requireAdminAuth } from '@/lib/admin';
import { hashDeviceToken } from '@/lib/local/device-auth';

export const runtime = 'nodejs';

// POST /api/local/devices/verify - Approve device from Admin UI
export async function POST(request: NextRequest) {
  const authResponse = requireAdminAuth(request);
  if (authResponse) return authResponse;

  const { device_code } = await request.json();

  if (!device_code) {
    return Response.json({ error: 'Missing device_code' }, { status: 400 });
  }

  const session = await kv.hgetall(`device_session:${device_code}`);
  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status === 'completed') {
    return Response.json({ error: 'Already verified' }, { status: 400 });
  }

  // Mark as completed
  await kv.hset(`device_session:${device_code}`, { status: 'completed' });

  // Create device record with secure token hash
  const tokenHash = await hashDeviceToken(session.device_token as string);

  await kv.hset(`device:${session.device_id}`, {
    name: session.device_name,
    platform: session.platform,
    token_hash: tokenHash,
    status: 'online',
    config_version: 0,
    last_heartbeat: Date.now(),
    created_at: Date.now(),
  });

  // Create reverse index for O(1) token lookup
  await kv.set(`device_token:${tokenHash}`, session.device_id);

  return Response.json({ success: true, device_id: session.device_id });
}
