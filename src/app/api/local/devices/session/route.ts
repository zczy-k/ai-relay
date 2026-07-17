// ============================================================
// AI Relay API — Local Device Session (Device Code Flow)
// ============================================================

import { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';

export const runtime = 'nodejs';

// POST /api/local/devices/session - Create device code
export async function POST(request: NextRequest) {
  const { device_name, platform } = await request.json();

  const deviceCode = `DC_${crypto.randomUUID()}`;
  const deviceId = `device_${crypto.randomUUID()}`;
  const deviceToken = `dt_${crypto.randomUUID().replace(/-/g, '')}`;
  const expiresAt = Date.now() + 600_000; // 10 min

  // Store pending session in KV
  await kv.hset(`device_session:${deviceCode}`, {
    device_id: deviceId,
    device_name: device_name || 'Unknown Device',
    platform: platform || 'unknown',
    device_token: deviceToken,
    status: 'pending',
    expires_at: expiresAt,
    created_at: Date.now(),
  });
  await kv.expire(`device_session:${deviceCode}`, 600);

  const verificationUrl = `${new URL(request.url).origin}/admin/local-relay/verify?code=${deviceCode}`;

  return Response.json({
    device_code: deviceCode,
    device_id: deviceId,
    verification_url: verificationUrl,
    expires_in: 600,
  });
}

// GET /api/local/devices/session?code=xxx - Poll for completion
export async function GET(request: NextRequest) {
  const deviceCode = request.nextUrl.searchParams.get('code');
  if (!deviceCode) {
    return Response.json({ error: 'Missing device_code' }, { status: 400 });
  }

  const session = await kv.hgetall(`device_session:${deviceCode}`);
  if (!session) {
    return Response.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  if (session.status === 'completed') {
    return Response.json({
      status: 'completed',
      device_id: session.device_id,
      device_token: session.device_token,
    });
  }

  if (session.status === 'pending' && Date.now() > (session.expires_at as number)) {
    await kv.del(`device_session:${deviceCode}`);
    return Response.json({ error: 'Session expired' }, { status: 410 });
  }

  return Response.json({ status: 'pending' });
}
