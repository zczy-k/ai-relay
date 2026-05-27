'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================
// Types
// ============================================================

interface KeyHealth {
  provider: string;
  providerId: string;
  keyHash: string;
  keyIndex: number;
  totalKeys: number;
  status: 'healthy' | 'warning' | 'critical' | 'cooldown';
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  errorsByCode: Record<string, { count: number; reason: string }>;
}

interface SecurityData {
  overview: {
    totalKeys: number;
    encryptedKeys: number;
    needsRotation: number;
    todayRequests: number;
    globalErrorRate: number;
  };
  keys: KeyHealth[];
  timestamp: string;
}

interface RotationLogEntry {
  id: string;
  time: string;
  provider: string;
  keyHash: string;
  type: 'rotate' | 'add' | 'pause' | 'alert';
  detail: string;
  actor: string;
  result: 'success' | 'failed' | 'partial';
}

interface SecurityTabProps {
  apiKey: string;
  lang: 'zh' | 'en';
}

// ============================================================
// Translations
// ============================================================

const T = {
  zh: {
    title: '🛡️ Key 安全',
    overview: '安全概览',
    encryption: '加密状态',
    encrypted: '已加密',
    partialEncrypted: '部分未加密',
    allEncrypted: '全部 Key 已加密',
    needsRotation: '需要轮换',
    todayRequests: '今日请求',
    keyList: 'API Key 列表',
    provider: 'Provider',
    key: 'Key',
    encryptionShort: '加密',
    health: '健康',
    usage: '使用量',
    errorRate: '错误率',
    lastUsed: '最后使用',
    actions: '操作',
    healthy: '健康',
    warning: '警告',
    critical: '需轮换',
    cooldown: '冷却中',
    rotate: '轮换',
    pause: '暂停',
    delete: '删除',
    rotationModal: '轮换 API Key',
    inputNewKey: '输入新 Key',
    confirmSwitch: '确认切换',
    done: '完成',
    newApiKey: '新 API Key',
    show: '显示',
    hide: '隐藏',
    testConnection: '测试连接',
    testing: '测试中...',
    immediateSwitch: '立即切换',
    gradualSwitch: '渐进切换（灰度 10%）',
    confirm: '确认切换',
    cancel: '取消',
    success: '切换成功',
    switchTime: '切换时间',
    oldKeyStatus: '旧 Key 状态',
    deactivated: '已停用',
    rotationLog: '轮换日志',
    expandLog: '展开日志',
    collapseLog: '收起日志',
    noKeys: '暂无 Key 数据',
    addFirstKey: '添加第一个 Key',
    loading: '加载中...',
    retry: '重试',
    error: '请求失败',
    manualRotate: '手动轮换',
    autoRotate: '自动轮换',
    keyAdded: 'Key 添加',
    keyPaused: 'Key 暂停',
    testResult: '测试结果',
    latency: '延迟',
    models: '支持模型',
    permissions: '权限',
    testSuccess: '连接测试通过',
    testFailed: '连接测试失败',
    comparing: '对比',
    oldKey: '旧 Key',
    newKey: '新 Key',
    alert401: '401 错误率上升',
    oldKeyDeleteFailed: '旧 Key 删除失败，请手动移除',
    noRotationRecords: '暂无轮换记录',
    logRotate: '轮换',
    logAdd: '添加',
    logPause: '暂停',
    logAlert: '告警',
    nextStep: '下一步',
    switchStrategy: '切换策略',
    prevStep: '上一步',
    switching: '切换中...',
    doneBtn: '完成',
  },
  en: {
    title: '🛡️ Key Security',
    overview: 'Security Overview',
    encryption: 'Encryption',
    encrypted: 'Encrypted',
    partialEncrypted: 'Partially Unencrypted',
    allEncrypted: 'All Keys Encrypted',
    needsRotation: 'Needs Rotation',
    todayRequests: "Today's Requests",
    keyList: 'API Key List',
    provider: 'Provider',
    key: 'Key',
    encryptionShort: 'Encrypted',
    health: 'Health',
    usage: 'Usage',
    errorRate: 'Error Rate',
    lastUsed: 'Last Used',
    actions: 'Actions',
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Needs Rotation',
    cooldown: 'Cooling Down',
    rotate: 'Rotate',
    pause: 'Pause',
    delete: 'Delete',
    rotationModal: 'Rotate API Key',
    inputNewKey: 'Enter New Key',
    confirmSwitch: 'Confirm Switch',
    done: 'Done',
    newApiKey: 'New API Key',
    show: 'Show',
    hide: 'Hide',
    testConnection: 'Test Connection',
    testing: 'Testing...',
    immediateSwitch: 'Immediate Switch',
    gradualSwitch: 'Gradual (10% traffic)',
    confirm: 'Confirm Switch',
    cancel: 'Cancel',
    success: 'Switch Successful',
    switchTime: 'Switch Time',
    oldKeyStatus: 'Old Key Status',
    deactivated: 'Deactivated',
    rotationLog: 'Rotation Log',
    expandLog: 'Expand Log',
    collapseLog: 'Collapse Log',
    noKeys: 'No Key Data',
    addFirstKey: 'Add First Key',
    loading: 'Loading...',
    retry: 'Retry',
    error: 'Request Failed',
    manualRotate: 'Manual Rotate',
    autoRotate: 'Auto Rotate',
    keyAdded: 'Key Added',
    keyPaused: 'Key Paused',
    testResult: 'Test Result',
    latency: 'Latency',
    models: 'Models',
    permissions: 'Permissions',
    testSuccess: 'Connection Test Passed',
    testFailed: 'Connection Test Failed',
    comparing: 'Compare',
    oldKey: 'Old Key',
    newKey: 'New Key',
    alert401: '401 Error Rate Rising',
    oldKeyDeleteFailed: 'Failed to delete old key, please remove manually',
    noRotationRecords: 'No rotation records',
    logRotate: 'Rotate',
    logAdd: 'Add',
    logPause: 'Pause',
    logAlert: 'Alert',
    nextStep: 'Next',
    switchStrategy: 'Switch Strategy',
    prevStep: 'Back',
    switching: 'Switching...',
    doneBtn: 'Done',
  },
};

// ============================================================
// Helper: relative time
// ============================================================

function relativeTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ============================================================
// Component: Status Badge
// ============================================================

function StatusBadge({ status, t }: { status: KeyHealth['status']; t: typeof T['zh'] }) {
  const map = {
    healthy: { cls: 'status-healthy', label: t.healthy },
    warning: { cls: 'status-warning', label: t.warning },
    critical: { cls: 'status-critical', label: t.critical },
    cooldown: { cls: 'status-warning', label: t.cooldown },
  };
  const { cls, label } = map[status];
  return (
    <span className={`status-badge ${cls}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
      <span className="dot" />
      {label}
    </span>
  );
}

// ============================================================
// Component: Error Rate Display
// ============================================================

function ErrorRateDisplay({ rate }: { rate: number }) {
  let color = '#6b7280';
  let fontWeight = 400;
  if (rate > 10) { color = '#f87171'; fontWeight = 700; }
  else if (rate > 5) { color = '#fbbf24'; fontWeight = 600; }
  return (
    <span style={{ fontSize: '12px', color, fontWeight }}>
      {rate.toFixed(1)}%
    </span>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function SecurityTab({ apiKey, lang }: SecurityTabProps) {
  const t = T[lang];
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Rotation modal state
  const [rotateTarget, setRotateTarget] = useState<KeyHealth | null>(null);
  const [rotateStep, setRotateStep] = useState<1 | 2 | 3>(1);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latency?: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [switchMode, setSwitchMode] = useState<'immediate' | 'gradual'>('immediate');
  const [rotating, setRotating] = useState(false);

  // Rotation log
  const [logEntries, setLogEntries] = useState<RotationLogEntry[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);

  // Fetch security data
  const fetchSecurity = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/security', {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch security data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchSecurity();
  }, [fetchSecurity]);

  // Load rotation log from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('airelay_rotation_log');
      if (saved) setLogEntries(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // ============================================================
  // Rotation flow
  // ============================================================

  const openRotate = (key: KeyHealth) => {
    setRotateTarget(key);
    setRotateStep(1);
    setNewKeyValue('');
    setShowNewKey(false);
    setTestResult(null);
    setSwitchMode('immediate');
  };

  const closeRotate = () => {
    setRotateTarget(null);
    setRotateStep(1);
    setNewKeyValue('');
    setTestResult(null);
  };

  const testNewKey = async () => {
    if (!newKeyValue.trim() || !rotateTarget) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/keys/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider: rotateTarget.providerId, key: newKeyValue.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.valid) {
        setTestResult({ ok: true, latency: json.latency });
      } else {
        setTestResult({ ok: false, error: json.error || 'Test failed' });
      }
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Network error' });
    } finally {
      setTesting(false);
    }
  };

  const confirmRotate = async () => {
    if (!rotateTarget || !newKeyValue.trim()) return;
    setRotating(true);
    try {
      // Step 1: Add the new key
      const addRes = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: rotateTarget.providerId,
          key: newKeyValue.trim(),
        }),
      });
      if (!addRes.ok) {
        const err = await addRes.json();
        throw new Error(err.error?.message || 'Failed to add new key');
      }

      // Step 2: Delete old key (by hash)
      // Note: The existing delete API uses key hash
      let deleteOldFailed = false;
      const delRes = await fetch(`/api/admin/keys?provider=${rotateTarget.providerId}&keyHash=${rotateTarget.keyHash}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!delRes.ok) {
        deleteOldFailed = true;
      }

      // Log the rotation
      const entry: RotationLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toISOString(),
        provider: rotateTarget.provider,
        keyHash: rotateTarget.keyHash,
        type: 'rotate',
        detail: deleteOldFailed
          ? `${t.manualRotate}: key-${rotateTarget.keyIndex} → ${t.newKey} (${t.oldKeyDeleteFailed})`
          : `${t.manualRotate}: key-${rotateTarget.keyIndex} → ${t.newKey} (${switchMode === 'gradual' ? t.gradualSwitch : t.immediateSwitch})`,
        actor: 'admin',
        result: deleteOldFailed ? 'partial' : 'success',
      };
      const updatedLog = [entry, ...logEntries].slice(0, 100);
      setLogEntries(updatedLog);
      localStorage.setItem('airelay_rotation_log', JSON.stringify(updatedLog));

      setRotateStep(3);
      await fetchSecurity();
    } catch (e) {
      const entry: RotationLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toISOString(),
        provider: rotateTarget.provider,
        keyHash: rotateTarget.keyHash,
        type: 'rotate',
        detail: `${t.manualRotate} ${t.error}: ${e instanceof Error ? e.message : String(e)}`,
        actor: 'admin',
        result: 'failed',
      };
      const updatedLog = [entry, ...logEntries].slice(0, 100);
      setLogEntries(updatedLog);
      localStorage.setItem('airelay_rotation_log', JSON.stringify(updatedLog));
    } finally {
      setRotating(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
        <span className="spin" style={{ fontSize: '1.5rem' }}>🔄</span>
        <p style={{ marginTop: '0.5rem' }}>{t.loading}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#f87171', marginBottom: '1rem' }}>{t.error}: {error}</p>
        <button className="btn-ghost" onClick={fetchSecurity}>{t.retry}</button>
      </div>
    );
  }

  if (!data) return null;

  const { overview, keys } = data;

  return (
    <div>
      {/* ===== Section 1: Security Overview Cards ===== */}
      <div style={{
        fontSize: '14px', fontWeight: 600, color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: '1px',
        margin: '0 0 16px', paddingBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {t.overview}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
        marginBottom: '24px',
      }}>
        {/* Card 1: Encryption Status */}
        <div className="stat-card" style={{
          background: 'rgba(30,41,59,0.45)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '20px', backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔒</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', lineHeight: 1.2 }}>
            {overview.encryptedKeys} / {overview.totalKeys}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            {t.encryption}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
            <span className="status-badge status-encrypted" style={{ fontSize: '10px', padding: '2px 8px' }}>
              <span className="dot" />
              AES-256-GCM
            </span>
            {' '}{t.allEncrypted}
          </div>
        </div>

        {/* Card 2: Needs Rotation */}
        <div className="stat-card" style={{
          background: 'rgba(30,41,59,0.45)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '20px', backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔄</div>
          <div style={{
            fontSize: '28px', fontWeight: 800, lineHeight: 1.2,
            color: overview.needsRotation > 0 ? '#fbbf24' : '#34d399',
          }}>
            {overview.needsRotation}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            {t.needsRotation}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
            {overview.needsRotation > 0 ? (
              <>
                {t.alert401}
                {keys.filter(k => k.status === 'critical').slice(0, 2).map(k => (
                  <div key={k.keyHash} style={{ marginTop: '4px' }}>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>●</span>{' '}
                    {k.provider} key-{k.keyIndex} · 401 {k.errorRate}%
                  </div>
                ))}
              </>
            ) : (
              <span style={{ color: '#34d399' }}>✓</span>
            )}
          </div>
        </div>

        {/* Card 3: Today's Requests */}
        <div className="stat-card" style={{
          background: 'rgba(30,41,59,0.45)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '20px', backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>📊</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#e5e7eb', lineHeight: 1.2 }}>
            {overview.todayRequests.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            {t.todayRequests}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
            {t.errorRate}:{' '}
            <span style={{
              color: overview.globalErrorRate > 5 ? '#f87171' : overview.globalErrorRate > 2 ? '#fbbf24' : '#34d399',
              fontWeight: 600,
            }}>
              {overview.globalErrorRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ===== Section 2: Key List ===== */}
      <div style={{
        fontSize: '14px', fontWeight: 600, color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: '1px',
        margin: '28px 0 16px', paddingBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {t.keyList}
      </div>

      {keys.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem',
          background: 'rgba(30,41,59,0.45)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔑</div>
          <p style={{ color: '#9ca3af' }}>{t.noKeys}</p>
        </div>
      ) : (
        <div style={{
          background: 'rgba(30,41,59,0.45)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: 0, overflowX: 'auto',
          backdropFilter: 'blur(12px)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t.provider, t.key, t.encryptionShort, t.health, t.errorRate, t.actions].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: '11px', color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const isCritical = k.status === 'critical';
                return (
                  <tr
                    key={k.keyHash}
                    style={{
                      transition: 'background 0.15s',
                      position: 'relative',
                      borderLeft: isCritical ? '3px solid #f87171' : undefined,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>
                          {k.status === 'healthy' ? '🟢' : k.status === 'warning' || k.status === 'cooldown' ? '🟡' : '🔴'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{k.provider}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            key-{k.keyIndex}{k.totalKeys > 1 ? ` / ${k.totalKeys}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                      <span style={{
                        fontFamily: "'SF Mono', Monaco, monospace", fontSize: '12px',
                        color: isCritical ? '#f87171' : '#9ca3af',
                        letterSpacing: '1px',
                        ...(isCritical ? { animation: 'pulse-r 2s infinite' } : {}),
                      }}>
                        {k.keyHash.slice(0, 4)}{'*'.repeat(8)}{k.keyHash.slice(-4)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                      <span style={{ fontSize: '14px' }} title="AES-256-GCM">🔒</span>
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                      <StatusBadge status={k.status} t={t} />
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                      <ErrorRateDisplay rate={k.errorRate} />
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openRotate(k)}
                          style={{
                            padding: '4px 10px', fontSize: '11px', borderRadius: '8px',
                            border: `1px solid ${isCritical ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.06)'}`,
                            background: isCritical ? 'rgba(248,113,113,0.15)' : 'transparent',
                            color: isCritical ? '#f87171' : '#9ca3af',
                            cursor: 'pointer',
                            fontWeight: isCritical ? 600 : 400,
                          }}
                        >
                          🔄 {isCritical ? t.rotate : ''}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Section 3: Rotation Log ===== */}
      <div
        onClick={() => setLogExpanded(!logExpanded)}
        style={{
          fontSize: '14px', fontWeight: 600, color: '#9ca3af',
          textTransform: 'uppercase', letterSpacing: '1px',
          margin: '28px 0 16px', paddingBottom: '8px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        {t.rotationLog}
        <span style={{ fontSize: '12px' }}>{logExpanded ? '▼' : '▶'}</span>
        {logEntries.length > 0 && (
          <span style={{
            fontSize: '11px', background: 'rgba(96,165,250,0.15)',
            color: '#60a5fa', padding: '2px 8px', borderRadius: '999px',
          }}>
            {logEntries.length}
          </span>
        )}
      </div>

      {logExpanded && (
        <div style={{
          background: 'rgba(30,41,59,0.45)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '20px', backdropFilter: 'blur(12px)',
        }}>
          {logEntries.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem', fontSize: '13px' }}>
              {t.noRotationRecords}
            </p>
          ) : (
            logEntries.slice(0, 20).map((entry) => {
              const typeColors = {
                rotate: { bg: 'rgba(96,165,250,0.1)', color: '#60a5fa', label: t.logRotate },
                add: { bg: 'rgba(52,211,153,0.1)', color: '#34d399', label: t.logAdd },
                pause: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', label: t.logPause },
                alert: { bg: 'rgba(248,113,113,0.1)', color: '#f87171', label: t.logAlert },
              };
              const tc = typeColors[entry.type];
              return (
                <div key={entry.id} style={{
                  display: 'flex', gap: '16px', padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  fontSize: '13px', alignItems: 'flex-start',
                }}>
                  <span style={{
                    color: '#6b7280', fontSize: '12px', minWidth: '140px',
                    fontFamily: "'SF Mono', Monaco, monospace",
                  }}>
                    {new Date(entry.time).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '999px',
                    fontSize: '11px', fontWeight: 600, minWidth: '64px', textAlign: 'center',
                    background: tc.bg, color: tc.color,
                  }}>
                    {tc.label}
                  </span>
                  <span style={{ flex: 1, color: '#e5e7eb' }}>{entry.detail}</span>
                  <span style={{
                    color: entry.result === 'success' ? '#34d399' : '#f87171',
                    fontSize: '12px', fontWeight: 600,
                  }}>
                    {entry.result === 'success' ? '✓' : '✗'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===== Rotation Modal ===== */}
      {rotateTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) closeRotate(); }}
        >
          <div style={{
            background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '32px',
            backdropFilter: 'blur(20px)', width: '520px', maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              fontSize: '18px', fontWeight: 700, marginBottom: '4px',
              background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {t.rotationModal}
            </div>
            <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
              {rotateTarget.provider} · key-{rotateTarget.keyIndex} ·{' '}
              <span style={{ fontFamily: "'SF Mono', Monaco, monospace", letterSpacing: '1px' }}>
                {rotateTarget.keyHash.slice(0, 4)}{'*'.repeat(8)}{rotateTarget.keyHash.slice(-4)}
              </span>
            </div>

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              {[1, 2, 3].map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {s > 1 && <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)', width: '24px' }} />}
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%', fontSize: '12px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...(s === rotateStep
                      ? { background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', color: '#fff' }
                      : { border: '1.5px solid rgba(255,255,255,0.08)', color: '#6b7280' }),
                  }}>
                    {s}
                  </span>
                  <span style={{ fontSize: '12px', color: s === rotateStep ? '#e5e7eb' : '#6b7280' }}>
                    {s === 1 ? t.inputNewKey : s === 2 ? t.confirmSwitch : t.done}
                  </span>
                </div>
              ))}
            </div>

            {/* Step 1: Input new key */}
            {rotateStep === 1 && (
              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  {t.newApiKey}
                </label>
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <input
                    type={showNewKey ? 'text' : 'password'}
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    placeholder="sk-..."
                    style={{
                      width: '100%', padding: '10px 14px', paddingRight: '80px',
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px', color: '#e5e7eb', fontSize: '13px', outline: 'none',
                    }}
                  />
                  <span
                    onClick={() => setShowNewKey(!showNewKey)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      fontSize: '12px', color: '#60a5fa', cursor: 'pointer',
                    }}
                  >
                    {showNewKey ? t.hide : t.show}
                  </span>
                </div>

                <button
                  onClick={testNewKey}
                  disabled={!newKeyValue.trim() || testing}
                  style={{
                    padding: '8px 20px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', color: '#fff',
                    fontSize: '13px', fontWeight: 600, border: 'none',
                    cursor: testing ? 'wait' : 'pointer', opacity: !newKeyValue.trim() ? 0.5 : 1,
                    marginBottom: '16px',
                  }}
                >
                  {testing ? t.testing : t.testConnection}
                </button>

                {testResult && (
                  <div style={{
                    padding: '12px', borderRadius: '8px', marginBottom: '16px',
                    background: testResult.ok ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                    border: `1px solid ${testResult.ok ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                  }}>
                    <div style={{
                      fontSize: '13px', fontWeight: 600,
                      color: testResult.ok ? '#34d399' : '#f87171', marginBottom: '4px',
                    }}>
                      {testResult.ok ? `✓ ${t.testSuccess}` : `✗ ${t.testFailed}`}
                    </div>
                    {testResult.ok && testResult.latency && (
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {t.latency}: {testResult.latency}ms
                      </div>
                    )}
                    {testResult.error && (
                      <div style={{ fontSize: '12px', color: '#f87171' }}>
                        {testResult.error}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={closeRotate} style={{
                    padding: '8px 20px', borderRadius: '8px', background: 'transparent',
                    color: '#9ca3af', fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                  }}>
                    {t.cancel}
                  </button>
                  <button
                    onClick={() => setRotateStep(2)}
                    disabled={!testResult?.ok}
                    style={{
                      padding: '8px 20px', borderRadius: '8px',
                      background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', color: '#fff',
                      fontSize: '13px', fontWeight: 600, border: 'none',
                      cursor: testResult?.ok ? 'pointer' : 'not-allowed',
                      opacity: testResult?.ok ? 1 : 0.4,
                    }}
                  >
                    {t.nextStep}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Confirm switch */}
            {rotateStep === 2 && (
              <div>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px',
                  marginBottom: '20px', alignItems: 'center',
                }}>
                  {/* Old Key card */}
                  <div style={{
                    padding: '16px', borderRadius: '12px',
                    background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)',
                  }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>{t.oldKey}</div>
                    <div style={{
                      fontFamily: "'SF Mono', Monaco, monospace", fontSize: '12px',
                      color: '#9ca3af', letterSpacing: '1px',
                    }}>
                      {rotateTarget.keyHash.slice(0, 4)}{'*'.repeat(8)}{rotateTarget.keyHash.slice(-4)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#f87171', marginTop: '8px' }}>
                      {t.deactivated}
                    </div>
                  </div>
                  <span style={{ fontSize: '20px', color: '#6b7280' }}>→</span>
                  {/* New Key card */}
                  <div style={{
                    padding: '16px', borderRadius: '12px',
                    background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)',
                  }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>{t.newKey}</div>
                    <div style={{
                      fontFamily: "'SF Mono', Monaco, monospace", fontSize: '12px',
                      color: '#34d399', letterSpacing: '1px',
                    }}>
                      {newKeyValue.slice(0, 7)}****{newKeyValue.slice(-4)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#34d399', marginTop: '8px' }}>
                      ✓ {t.testSuccess}
                    </div>
                  </div>
                </div>

                {/* Switch mode */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                    {t.switchStrategy}
                  </div>
                  {(['immediate', 'gradual'] as const).map(mode => (
                    <label key={mode} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0',
                      cursor: 'pointer', fontSize: '13px', color: '#e5e7eb',
                    }}>
                      <input
                        type="radio"
                        checked={switchMode === mode}
                        onChange={() => setSwitchMode(mode)}
                        style={{ accentColor: '#60a5fa' }}
                      />
                      {mode === 'immediate' ? t.immediateSwitch : t.gradualSwitch}
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setRotateStep(1)} style={{
                    padding: '8px 20px', borderRadius: '8px', background: 'transparent',
                    color: '#9ca3af', fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                  }}>
                    {t.prevStep}
                  </button>
                  <button
                    onClick={confirmRotate}
                    disabled={rotating}
                    style={{
                      padding: '8px 20px', borderRadius: '8px',
                      background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', color: '#fff',
                      fontSize: '13px', fontWeight: 600, border: 'none',
                      cursor: rotating ? 'wait' : 'pointer',
                    }}
                  >
                    {rotating ? t.switching : t.confirm}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Done */}
            {rotateStep === 3 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>
                  {t.success}
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>
                  {t.switchTime}: {new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
                  {t.oldKeyStatus}: {t.deactivated}
                </div>
                <button onClick={closeRotate} style={{
                  padding: '8px 24px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', color: '#fff',
                  fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
                }}>
                  {t.doneBtn}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
