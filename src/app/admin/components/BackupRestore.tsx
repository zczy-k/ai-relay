'use client';

import React, { useState, useRef } from 'react';

interface BackupRestoreProps {
  apiKey: string;
  lang: 'zh' | 'en';
  t: any;
  onRefreshData?: () => Promise<void>;
}

export default function BackupRestore({ apiKey, lang, t, onRefreshData }: BackupRestoreProps) {
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pastedJson, setPastedJson] = useState('');
  const [showTextArea, setShowTextArea] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setBackupLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/backup', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || t.backupFailed);
      }
      const data = await res.json();
      
      // Trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute('href', url);
      downloadAnchor.setAttribute('download', `ai-relay-backup-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
      
      setMessage({
        text: lang === 'zh' ? '🎉 配置备份导出成功！' : '🎉 Configuration backup exported successfully!',
        type: 'success'
      });
    } catch (e: any) {
      setMessage({
        text: `${t.backupFailed}: ${e.message}`,
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

      if (parsedData.version !== 1 || !parsedData.exportedAt) {
        throw new Error(t.restoreInvalidFormat);
      }

      const confirmMsg = lang === 'zh' 
        ? '确认要恢复该备份吗？这会完全覆盖并重置所有已配置的密钥、回退链、服务商等信息且不可逆！' 
        : 'Are you sure you want to restore this backup? This will completely overwrite and reset all keys, fallbacks, providers, etc., and CANNOT be undone!';
      
      if (!confirm(confirmMsg)) {
        setRestoreLoading(false);
        return;
      }

      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(parsedData),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error?.message || t.restoreFailed);
      }

      setMessage({ text: t.restoreSuccess, type: 'success' });
      setPastedJson('');
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (e: any) {
      setMessage({
        text: `${t.restoreFailed}: ${e.message}`,
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
        {t.backupRestoreTitle}
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 0, marginBottom: '1rem', lineHeight: '1.5' }}>
        {t.backupRestoreDesc}
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={handleExport}
          disabled={backupLoading || restoreLoading}
          style={{
            padding: '0.6rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            cursor: backupLoading ? 'wait' : 'pointer',
            opacity: backupLoading ? 0.6 : 1,
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
          }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.filter = 'brightness(1.1)'; }}
          onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.filter = 'none'; }}
        >
          {backupLoading ? '...' : t.backupBtn}
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
          📂 {t.restoreFileBtn || (lang === 'zh' ? '选择备份文件' : 'Select Backup File')}
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
          border: isDragOver ? '2px dashed #3b82f6' : '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center',
          backgroundColor: isDragOver ? 'rgba(59, 130, 246, 0.05)' : 'rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>
          {isDragOver ? '📥' : '📄'}
        </span>
        <span style={{ color: isDragOver ? '#3b82f6' : '#9ca3af', fontSize: '0.85rem', fontWeight: 500 }}>
          {isDragOver 
            ? (lang === 'zh' ? '松开鼠标导入文件' : 'Drop to import file')
            : (lang === 'zh' ? '拖拽备份 JSON 文件到此处，或点击浏览选择' : 'Drag & drop backup JSON file here, or click to browse')}
        </span>
      </div>

      {/* Paste text area */}
      {showTextArea && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <textarea
            placeholder={t.restorePlaceholder}
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
            {restoreLoading ? '...' : t.restoreBtn}
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
        {t.restoreWarning}
      </div>
    </section>
  );
}
