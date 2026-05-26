'use client';

import React, { useState, useRef, useEffect } from 'react';

interface StatsBackupRestoreProps {
  apiKey: string;
  lang: 'zh' | 'en';
  t: any;
  onRefreshData?: () => Promise<void>;
}

export default function StatsBackupRestore({ apiKey, lang, t, onRefreshData }: StatsBackupRestoreProps) {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  
  // Get Beijing Date helper
  const getBeijingDateStr = (daysAgo: number) => {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const [startDate, setStartDate] = useState(getBeijingDateStr(29));
  const [endDate, setEndDate] = useState(getBeijingDateStr(0));
  
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pastedJson, setPastedJson] = useState('');
  const [showTextArea, setShowTextArea] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update start/end date when period changes
  useEffect(() => {
    if (period === '7d') {
      setStartDate(getBeijingDateStr(6));
      setEndDate(getBeijingDateStr(0));
    } else if (period === '30d') {
      setStartDate(getBeijingDateStr(29));
      setEndDate(getBeijingDateStr(0));
    } else if (period === '90d') {
      setStartDate(getBeijingDateStr(89));
      setEndDate(getBeijingDateStr(0));
    }
    // For 'custom', do not overwrite user custom selections
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const handleExport = async () => {
    setBackupLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/backup/stats?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || t.statsBackupFailed);
      }
      const data = await res.json();

      // Trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', url);
      downloadAnchor.setAttribute('download', `ai-relay-stats-backup-${startDate}-to-${endDate}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      setMessage({
        text: lang === 'zh' 
          ? `🎉 成功导出时间范围为 ${startDate} 至 ${endDate} 的统计数据备份！` 
          : `🎉 Statistics backup successfully exported for range ${startDate} to ${endDate}!`,
        type: 'success'
      });
    } catch (e: any) {
      setMessage({
        text: `${t.statsBackupFailed}: ${e.message}`,
        type: 'error'
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const processJson = async (jsonText: string) => {
    if (!jsonText.trim()) return;
    setRestoreLoading(true);
    setMessage(null);
    try {
      let parsedData;
      try {
        parsedData = JSON.parse(jsonText);
      } catch {
        throw new Error(t.restoreInvalidFormat);
      }

      if (parsedData.type !== 'ai-relay-stats-backup' || parsedData.version !== 1 || !parsedData.data) {
        throw new Error(t.restoreInvalidFormat);
      }

      const confirmMsg = lang === 'zh'
        ? `确认要导入此统计数据备份吗？这会覆写 ${parsedData.startDate} 至 ${parsedData.endDate} 期间的用量统计和错误历史，该操作无法撤销！`
        : `Are you sure you want to import this statistics backup? This will overwrite daily usage stats and error history for the period of ${parsedData.startDate} to ${parsedData.endDate}. This action cannot be undone!`;

      if (!confirm(confirmMsg)) {
        setRestoreLoading(false);
        return;
      }

      const res = await fetch('/api/admin/backup/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(parsedData),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error?.message || t.statsRestoreFailed);
      }

      setMessage({ text: t.statsRestoreSuccess, type: 'success' });
      setPastedJson('');
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (e: any) {
      setMessage({
        text: `${t.statsRestoreFailed}: ${e.message}`,
        type: 'error'
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processJson(content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processJson(content);
    };
    reader.readAsText(file);
  };

  return (
    <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '0.5rem', color: '#fff', fontWeight: 600 }}>
        {t.statsBackupRestoreTitle}
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 0, marginBottom: '1.25rem', lineHeight: '1.5' }}>
        {t.statsBackupRestoreDesc}
      </p>

      {/* Select Period Range */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#d1d5db', fontSize: '0.9rem' }}>{t.periodLabel}</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            disabled={backupLoading || restoreLoading}
            className="custom-select"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="7d">{t.period7d}</option>
            <option value="30d">{t.period30d}</option>
            <option value="90d">{t.period90d}</option>
            <option value="custom">{t.periodCustom}</option>
          </select>
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{t.startDateLabel}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={backupLoading || restoreLoading}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{t.endDateLabel}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={backupLoading || restoreLoading}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={handleExport}
          disabled={backupLoading || restoreLoading || !startDate || !endDate}
          style={{
            padding: '0.6rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            cursor: backupLoading ? 'wait' : 'pointer',
            opacity: (backupLoading || !startDate || !endDate) ? 0.6 : 1,
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
          }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.filter = 'brightness(1.1)'; }}
          onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.filter = 'none'; }}
        >
          {backupLoading ? '...' : t.statsBackupBtn}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={restoreLoading || backupLoading}
          style={{
            padding: '0.6rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            color: '#fff',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'; }}
        >
          📂 {t.statsRestoreFileBtn}
        </button>

        <button
          onClick={() => setShowTextArea(!showTextArea)}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#9ca3af',
            fontSize: '0.85rem',
            cursor: 'pointer',
            textDecoration: 'underline',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
        >
          {showTextArea 
            ? (lang === 'zh' ? '隐藏文本粘贴' : 'Hide paste area')
            : (lang === 'zh' ? '通过文本粘贴导入' : 'Import by pasting text')}
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          style={{ display: 'none' }}
        />
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragOver ? '2px dashed #10b981' : '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center',
          backgroundColor: isDragOver ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>
          {isDragOver ? '📥' : '📊'}
        </span>
        <span style={{ color: isDragOver ? '#10b981' : '#9ca3af', fontSize: '0.85rem', fontWeight: 500 }}>
          {isDragOver 
            ? (lang === 'zh' ? '松开鼠标导入统计文件' : 'Drop to import stats file')
            : (lang === 'zh' ? '拖拽统计 JSON 备份文件到此处，或点击浏览选择' : 'Drag & drop stats JSON backup file here, or click to browse')}
        </span>
      </div>

      {/* Paste text area */}
      {showTextArea && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <textarea
            placeholder={t.statsRestorePlaceholder}
            value={pastedJson}
            onChange={(e) => setPastedJson(e.target.value)}
            disabled={restoreLoading}
            style={{
              width: '100%',
              height: '150px',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => processJson(pastedJson)}
            disabled={restoreLoading || !pastedJson.trim()}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#10b981',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: (restoreLoading || !pastedJson.trim()) ? 'not-allowed' : 'pointer',
              opacity: (restoreLoading || !pastedJson.trim()) ? 0.5 : 1,
              transition: 'all 0.2s',
              alignSelf: 'flex-start',
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#059669'; }}
            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#10b981'; }}
          >
            {restoreLoading ? '...' : t.statsRestoreBtn}
          </button>
        </div>
      )}

      {/* Message feedback */}
      {message && (
        <p style={{
          color: message.type === 'error' ? '#ef4444' : '#10b981',
          fontSize: '0.9rem',
          margin: '0.5rem 0 0 0',
          fontWeight: 500
        }}>
          {message.text}
        </p>
      )}

      {/* Warning Area */}
      <div style={{
        marginTop: '0.5rem',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        backgroundColor: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        color: '#fca5a5',
        fontSize: '0.82rem',
        lineHeight: '1.4'
      }}>
        {t.statsRestoreWarning}
      </div>
    </section>
  );
}
