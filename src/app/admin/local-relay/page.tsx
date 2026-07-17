// ============================================================
// AI Relay Admin — Local Relay Management Page
// ============================================================

'use client';

import { useEffect, useState } from 'react';

interface Device {
  id: string;
  name: string;
  platform: string;
  status: string;
  last_heartbeat: number;
}

export default function LocalRelayPage() {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch('/api/local/devices');
        const data = await res.json();
        setDevices(data.devices || []);
      } catch (err) {
        console.error('Failed to fetch devices:', err);
      }
    }
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Local Relay</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
        <div className="bg-gray-100 p-4 rounded">
          <ol className="list-decimal list-inside space-y-2">
            <li>Install CLI: <code className="bg-gray-200 px-2 py-1 rounded">npm install -g ai-relay</code></li>
            <li>Login: <code className="bg-gray-200 px-2 py-1 rounded">ai-relay login {typeof window !== 'undefined' ? window.location.origin : 'https://your-relay.vercel.app'}</code></li>
            <li>Start: <code className="bg-gray-200 px-2 py-1 rounded">ai-relay local:start</code></li>
            <li>Configure Agent: <code className="bg-gray-200 px-2 py-1 rounded">ai-relay agent install codex</code></li>
          </ol>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Devices</h2>
        <div className="bg-white shadow rounded p-4">
          {devices.length === 0 ? (
            <p className="text-gray-600">No devices connected yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Platform</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} className="border-b">
                    <td className="py-2">{device.name}</td>
                    <td className="py-2">{device.platform}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${device.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {device.status}
                      </span>
                    </td>
                    <td className="py-2 text-sm text-gray-600">
                      {device.last_heartbeat ? new Date(device.last_heartbeat).toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Documentation</h2>
        <div className="bg-white shadow rounded p-4">
          <p className="text-gray-600">
            See <a href="/docs/local-relay-guide.md" className="text-blue-600 hover:underline">Local Relay Guide</a> for detailed setup instructions.
          </p>
        </div>
      </section>
    </div>
  );
}
