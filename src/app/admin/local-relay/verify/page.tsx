'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function VerifyContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleVerify = async () => {
    if (!code) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    setStatus('verifying');

    try {
      const res = await fetch('/api/local/devices/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code: code }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatus('success');
        setMessage(`Device ${data.device_id} verified successfully!`);
      } else {
        const error = await res.json();
        setStatus('error');
        setMessage(error.error || 'Verification failed');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Network error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-4">Verify Device</h1>

        {!code && (
          <div className="bg-red-100 text-red-700 p-4 rounded">
            Invalid verification link
          </div>
        )}

        {code && status === 'idle' && (
          <div>
            <p className="text-gray-600 mb-4">
              Click the button below to authorize this device to access your AI Relay.
            </p>
            <button
              onClick={handleVerify}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Verify Device
            </button>
          </div>
        )}

        {status === 'verifying' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-green-100 text-green-700 p-4 rounded">
            <p className="font-semibold">✅ Success!</p>
            <p className="text-sm mt-2">{message}</p>
            <p className="text-sm mt-2">You can close this window and return to your terminal.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-100 text-red-700 p-4 rounded">
            <p className="font-semibold">❌ Error</p>
            <p className="text-sm mt-2">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyDevicePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
