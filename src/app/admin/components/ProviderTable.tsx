'use client';

import React, { useState } from 'react';
import type { AdminData } from '../types';
import CcSwitchImportButton from './CcSwitchImportButton';

interface ProviderTableProps {
  data: AdminData;
  selectedProvider: string | null;
  setSelectedProvider: (providerId: string | null) => void;
  setEditingCustomProvider: (val: any) => void;
  setCustomProviderModalOpen: (val: boolean) => void;
  onImportProviderLink?: (link: string) => Promise<boolean>;
  operationLoading?: boolean;
  apiKey: string;
  lang: 'zh' | 'en';
  t: any;
}

export type ProviderStatusTone = 'healthy' | 'degraded' | 'down';

export function getProviderStatusView(provider: { configured: boolean; availableKeys: number }): {
  tone: ProviderStatusTone;
  dot: '●' | '⚠' | '✕';
  labelKey: 'statusOk' | 'statusNoKeys';
} {
  if (provider.configured && provider.availableKeys > 0) {
    return { tone: 'healthy', dot: '●', labelKey: 'statusOk' };
  }
  if (provider.configured) {
    return { tone: 'degraded', dot: '⚠', labelKey: 'statusNoKeys' };
  }
  return { tone: 'down', dot: '✕', labelKey: 'statusNoKeys' };
}

const statusStyles: Record<ProviderStatusTone, { backgroundColor: string; color: string; border: string }> = {
  healthy: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.2)',
  },
  degraded: {
    backgroundColor: 'rgba(245, 158, 11, 0.13)',
    color: '#fbbf24',
    border: '1px solid rgba(245, 158, 11, 0.24)',
  },
  down: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.2)',
  },
};

export default function ProviderTable({
  data,
  selectedProvider,
  setSelectedProvider,
  setEditingCustomProvider,
  setCustomProviderModalOpen,
  onImportProviderLink,
  operationLoading,
  apiKey,
  lang,
  t,
}: ProviderTableProps) {
  const [showImportInput, setShowImportInput] = useState(false);
  const [importLinkValue, setImportLinkValue] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importLinkValue.trim() || !onImportProviderLink) return;
    setImporting(true);
    try {
      const success = await onImportProviderLink(importLinkValue.trim());
      if (success) {
        setImportLinkValue('');
        setShowImportInput(false);
      }
    } catch {
      // Errors are handled and displayed via configMessage in KeysTab
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#fff', fontWeight: 600 }}>
          {t.providerKeyPools}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {onImportProviderLink && (
            <button
              onClick={() => {
                setShowImportInput(!showImportInput);
                setImportLinkValue('');
              }}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: showImportInput ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                color: '#d1d5db',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (!showImportInput) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'; }}
              onMouseLeave={(e) => { if (!showImportInput) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'; }}
            >
              {t.importProviderLink}
            </button>
          )}
          <button
            onClick={() => {
              setEditingCustomProvider(null);
              setCustomProviderModalOpen(true);
            }}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
          >
            {t.addCustomProvider}
          </button>
        </div>
      </div>
      {showImportInput && (
        <form
          onSubmit={handleImportSubmit}
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
            padding: '0.75rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            alignItems: 'center',
            flexWrap: 'wrap',
            animation: 'slideDown 0.2s ease-out',
          }}
        >
          <input
            type="text"
            placeholder={t.importProviderPlaceholder}
            value={importLinkValue}
            onChange={(e) => setImportLinkValue(e.target.value)}
            disabled={importing || operationLoading}
            style={{
              flex: 1,
              minWidth: '240px',
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={importing || operationLoading || !importLinkValue.trim()}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#10b981',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: (importing || operationLoading || !importLinkValue.trim()) ? 'not-allowed' : 'pointer',
              opacity: (importing || operationLoading || !importLinkValue.trim()) ? 0.5 : 1,
            }}
          >
            {importing || operationLoading ? '...' : t.btnImport}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowImportInput(false);
              setImportLinkValue('');
            }}
            disabled={importing || operationLoading}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'transparent',
              color: '#d1d5db',
              fontSize: '0.85rem',
              cursor: (importing || operationLoading) ? 'not-allowed' : 'pointer',
            }}
          >
            {t.cancel}
          </button>
        </form>
      )}
      <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 0, marginBottom: '1.25rem' }}>
        {t.providerKeyPoolsDesc}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="styled-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>{t.tblProvider}</th>
              <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', minWidth: '132px', whiteSpace: 'nowrap' }}>{t.tblStatus}</th>
              <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>{t.tblKeys}</th>
              <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>{t.tblAvailable}</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>{t.tblModelPrefixes}</th>
              <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>{t.ccSwitchExportCol || (lang === 'zh' ? '导出' : 'Export')}</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map((p) => {
              const isSelected = selectedProvider === p.id;
              const status = getProviderStatusView(p);
              const styles = statusStyles[status.tone];
              return (
                <tr
                  key={p.id}
                  className={`provider-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedProvider(isSelected ? null : p.id)}
                  style={{
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: isSelected ? '#60a5fa' : '#f3f4f6' }}>
                    {isSelected ? '👉 ' : ''}{p.name}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                      backgroundColor: styles.backgroundColor,
                      color: styles.color,
                      border: styles.border,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                    }}>
                      <span aria-hidden="true">{status.dot}</span>
                      {t[status.labelKey]}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#d1d5db' }}>{p.keyCount}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{
                      color: p.availableKeys > 0 ? '#34d399' : '#ef4444',
                      fontWeight: 'bold',
                    }}>
                      {p.availableKeys}
                    </span>
                  </td>
                  <td style={{
                    padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.85rem',
                    color: '#9ca3af',
                  }}>
                    {p.modelPrefixes.join(', ')}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <CcSwitchImportButton
                      apiKey={apiKey}
                      lang={lang}
                      t={t}
                      mode="provider"
                      providerId={p.id}
                      providerName={p.name}
                      compact
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
