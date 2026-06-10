'use client';

import React, { useEffect, useState } from 'react';

type CcSwitchApp = 'claude' | 'claude-desktop' | 'codex' | 'hermes' | 'openclaw';
type ExportMode = 'relay' | 'provider';

interface KeySummary {
  hash: string;
  masked: string;
  source: string;
}

interface CcSwitchImportButtonProps {
  apiKey: string;
  lang: 'zh' | 'en';
  t: any;
  mode: ExportMode;
  providerId?: string;
  providerName?: string;
  compact?: boolean;
}

const TARGETS: Array<{ value: string; app: CcSwitchApp; labelZh: string; labelEn: string }> = [
  { value: 'claude-app', app: 'claude-desktop', labelZh: 'Claude App', labelEn: 'Claude App' },
  { value: 'claude-cli', app: 'claude', labelZh: 'Claude CLI', labelEn: 'Claude CLI' },
  { value: 'codex-app', app: 'codex', labelZh: 'Codex App', labelEn: 'Codex App' },
  { value: 'codex-cli', app: 'codex', labelZh: 'Codex CLI', labelEn: 'Codex CLI' },
  { value: 'hermes', app: 'hermes', labelZh: 'Hermes', labelEn: 'Hermes' },
  { value: 'openclaw', app: 'openclaw', labelZh: 'OpenClaw', labelEn: 'OpenClaw' },
];

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export default function CcSwitchImportButton({
  apiKey,
  lang,
  t,
  mode,
  providerId,
  providerName,
  compact = false,
}: CcSwitchImportButtonProps) {
  const [open, setOpen] = useState(false);
  const [targetValue, setTargetValue] = useState(TARGETS[0].value);
  const [keys, setKeys] = useState<KeySummary[]>([]);
  const [selectedKeyHash, setSelectedKeyHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!open || mode !== 'provider' || !providerId) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    fetch(`/api/admin/providers/${providerId}/keys`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || 'Failed to load provider keys');
        if (cancelled) return;
        const nextKeys = Array.isArray(json.keys) ? json.keys : [];
        setKeys(nextKeys);
        setSelectedKeyHash(nextKeys[0]?.hash || '');
      })
      .catch((err) => {
        if (!cancelled) {
          setMessage({ text: err instanceof Error ? err.message : String(err), type: 'error' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, mode, open, providerId]);

  const selectedTarget = TARGETS.find((target) => target.value === targetValue) || TARGETS[0];

  const handleImport = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ mode, app: selectedTarget.app });
      if (mode === 'provider') {
        if (!providerId) throw new Error('Missing provider id');
        if (keys.length === 0) {
          throw new Error(lang === 'zh' ? '该供应商没有可导出的 Key。' : 'This provider has no key to export.');
        }
        params.set('providerId', providerId);
        params.set('keyHash', selectedKeyHash);
      }

      const res = await fetch(`/api/admin/cc-switch/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || t.ccSwitchExportFailed);
      const link = json.links?.[0]?.url;
      if (!link) {
        throw new Error(lang === 'zh' ? '没有生成可导入链接。' : 'No import link was generated.');
      }

      await copyText(link);
      window.location.href = link;
      setMessage({
        text: lang === 'zh' ? '链接已复制，并已尝试打开 CC Switch。' : 'Link copied, and CC Switch has been opened.',
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

  const label = mode === 'relay'
    ? (t.ccSwitchExportRelay || (lang === 'zh' ? '导出到 CC Switch' : 'Export to CC Switch'))
    : (t.ccSwitchExportProvider || (lang === 'zh' ? '导出' : 'Export'));

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMessage(null);
        }}
        style={{
          padding: compact ? '0.35rem 0.65rem' : '0.5rem 1rem',
          borderRadius: '8px',
          border: '1px solid rgba(16, 185, 129, 0.28)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: '#6ee7b7',
          cursor: 'pointer',
          fontSize: compact ? '0.78rem' : '0.85rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: 'min(460px, 100%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>
                  {mode === 'relay'
                    ? (lang === 'zh' ? '导出 AI Relay' : 'Export AI Relay')
                    : (lang === 'zh' ? `导出 ${providerName || providerId}` : `Export ${providerName || providerId}`)}
                </h3>
                <p style={{ margin: '0.35rem 0 0', color: '#9ca3af', fontSize: '0.82rem', lineHeight: 1.45 }}>
                  {lang === 'zh'
                    ? '选择目标后会复制导入链接，并立即尝试打开 CC Switch。'
                    : 'After choosing the target, the import link is copied and CC Switch is opened.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ×
              </button>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', color: '#d1d5db', fontSize: '0.85rem' }}>
              {lang === 'zh' ? '目标应用' : 'Target app'}
              <select
                className="custom-select"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                style={{
                  padding: '0.6rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  color: '#fff',
                  outline: 'none',
                }}
              >
                {TARGETS.map((target) => (
                  <option key={target.value} value={target.value}>
                    {lang === 'zh' ? target.labelZh : target.labelEn}
                  </option>
                ))}
              </select>
            </label>

            {mode === 'provider' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', color: '#d1d5db', fontSize: '0.85rem' }}>
                {lang === 'zh' ? '选择 Key' : 'Select key'}
                <select
                  className="custom-select"
                  value={selectedKeyHash}
                  onChange={(e) => setSelectedKeyHash(e.target.value)}
                  disabled={loading || keys.length === 0}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    color: '#fff',
                    outline: 'none',
                  }}
                >
                  {keys.length === 0 ? (
                    <option value="">{loading ? '...' : (lang === 'zh' ? '无可用 Key' : 'No key available')}</option>
                  ) : keys.map((key) => (
                    <option key={key.hash} value={key.hash}>
                      {key.masked} ({key.source})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <p style={{ margin: 0, color: '#fbbf24', fontSize: '0.78rem', lineHeight: 1.45 }}>
              {t.ccSwitchSensitiveNotice || (lang === 'zh'
                ? '注意：ccswitch:// 导入链接会包含 API Key，请勿公开分享。'
                : 'Note: ccswitch:// import links contain API keys. Do not share them publicly.')}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: '#d1d5db',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {t.cancel || (lang === 'zh' ? '取消' : 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || (mode === 'provider' && keys.length === 0)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading || (mode === 'provider' && keys.length === 0) ? 0.6 : 1,
                }}
              >
                {loading ? '...' : (lang === 'zh' ? '复制并打开 CC Switch' : 'Copy and open CC Switch')}
              </button>
            </div>

            {message && (
              <div style={{
                padding: '0.65rem 0.8rem',
                borderRadius: '8px',
                backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: message.type === 'success' ? '#34d399' : '#f87171',
                border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                fontSize: '0.82rem',
              }}>
                {message.text}
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
