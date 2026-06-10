'use client';

import React, { useState } from 'react';

interface CcSwitchExportProps {
  apiKey: string;
  lang: 'zh' | 'en';
  t: any;
}

function downloadJson(payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `ai-relay-cc-switch-all-${dateStr}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function CcSwitchExport({ apiKey, lang, t }: CcSwitchExportProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleExportAll = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/cc-switch/export?mode=providers', {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || t.ccSwitchExportFailed);
      downloadJson(json);
      setMessage({
        text: lang === 'zh' ? `已导出 ${json.links?.length || 0} 个供应商链接文件。` : `Exported ${json.links?.length || 0} provider link(s).`,
        type: 'success',
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : String(err),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '0.5rem', color: '#fff', fontWeight: 600 }}>
        {t.ccSwitchBulkExportTitle || (lang === 'zh' ? 'CC Switch 批量导出' : 'CC Switch Bulk Export')}
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 0, marginBottom: '0.25rem', lineHeight: '1.5' }}>
        {t.ccSwitchBulkExportDesc || (lang === 'zh'
          ? '一次性导出所有已配置供应商的 CC Switch 导入链接文件。单个导入请使用顶部 AI Relay 入口或服务商密钥池列表里的导出按钮。'
          : 'Export a JSON file containing CC Switch import links for all configured providers. Use the header or provider rows for one-click single imports.')}
      </p>
      <p style={{ fontSize: '0.78rem', color: '#fbbf24', margin: 0, lineHeight: 1.45 }}>
        {t.ccSwitchSensitiveNotice || (lang === 'zh'
          ? '注意：导出文件会包含 API Key，请勿公开分享。'
          : 'Note: the exported file contains API keys. Do not share it publicly.')}
      </p>

      <div>
        <button
          onClick={handleExportAll}
          disabled={loading}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#fff',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.65 : 1,
          }}
        >
          {loading ? '...' : (t.ccSwitchBulkExportBtn || (lang === 'zh' ? '导出全部供应商文件' : 'Export All Providers'))}
        </button>
      </div>

      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: message.type === 'success' ? '#34d399' : '#f87171',
          border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          fontSize: '0.85rem',
        }}>
          {message.text}
        </div>
      )}
    </section>
  );
}
