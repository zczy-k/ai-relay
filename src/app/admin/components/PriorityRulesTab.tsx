'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { detectPriorityRuleConflicts } from '@/lib/admin/priority-rules-core';
import type { PriorityRule, PriorityRuleConflict, ProviderInfo } from '../types';
import HelpIcon from './HelpIcon';

export function movePriorityRule<T>(rules: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= rules.length || toIndex < 0 || toIndex >= rules.length) {
    return rules;
  }
  const next = [...rules];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function normalizeProviderOrder(providerOrder: string[]): string[] {
  const seen = new Set<string>();
  return providerOrder.map((provider) => provider.trim()).filter((provider) => {
    if (!provider || seen.has(provider)) return false;
    seen.add(provider);
    return true;
  });
}

export function addProviderToOrder(providerOrder: string[], providerId: string): string[] {
  return normalizeProviderOrder([...providerOrder, providerId]);
}

export function removeProviderFromOrder(providerOrder: string[], providerId: string): string[] {
  return providerOrder.filter((provider) => provider !== providerId);
}

export function moveProviderInOrder(providerOrder: string[], fromIndex: number, toIndex: number): string[] {
  return movePriorityRule(providerOrder, fromIndex, toIndex);
}

export function createBlankPriorityRule(providerOrder: string[]): PriorityRule {
  const now = new Date().toISOString();
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id: `rule-${random}`,
    name: 'New rule',
    enabled: true,
    modelPattern: 'gpt-*',
    providerOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export function getRuleConflictState(ruleId: string, conflicts: PriorityRuleConflict[]): { severity: 'warning' | 'error' | null; count: number } {
  const matched = conflicts.filter((conflict) => conflict.ruleIds.includes(ruleId));
  if (matched.some((conflict) => conflict.severity === 'error')) {
    return { severity: 'error', count: matched.length };
  }
  if (matched.length > 0) {
    return { severity: 'warning', count: matched.length };
  }
  return { severity: null, count: 0 };
}

interface PriorityRulesTabProps {
  rules?: PriorityRule[];
  providers?: ProviderInfo[];
  conflicts?: PriorityRuleConflict[];
  loading?: boolean;
  message?: string;
  onAddRule?: () => void;
  onDeleteRule?: (id: string) => void;
  onReorderRules?: (rules: PriorityRule[]) => void;
  onSaveRules?: (rules: PriorityRule[]) => void;
}

const inputStyle: React.CSSProperties = {
  padding: '0.55rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.22)',
  color: '#e5e7eb',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.45rem 0.7rem',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#d1d5db',
  cursor: 'pointer',
};

const smallButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: '0.32rem 0.5rem',
  minHeight: 32,
};

function getProviderLabel(providers: ProviderInfo[], providerId: string): string {
  return providers.find((provider) => provider.id === providerId)?.name || providerId;
}

interface ProviderOrderEditorProps {
  providerOrder: string[];
  providers: ProviderInfo[];
  providerIds: string[];
  onChange: (providerOrder: string[]) => void;
}

function ProviderOrderEditor({ providerOrder, providers, providerIds, onChange }: ProviderOrderEditorProps) {
  const normalizedOrder = normalizeProviderOrder(providerOrder);
  const selected = normalizedOrder;
  const available = providerIds.filter((providerId) => !selected.includes(providerId));
  const [customProviderId, setCustomProviderId] = useState('');

  const commitCustomProvider = () => {
    const providerId = customProviderId.trim();
    if (!providerId) return;
    onChange(addProviderToOrder(selected, providerId));
    setCustomProviderId('');
  };

  return (
    <div style={{ display: 'grid', gap: '0.55rem' }}>
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {selected.length === 0 ? (
          <span style={{ color: '#fca5a5', fontSize: '0.85rem' }}>至少选择 1 个 provider</span>
        ) : selected.map((providerId, providerIndex) => (
          <div
            key={`${providerId}-${providerIndex}`}
            style={{
              display: 'flex',
              gap: '0.35rem',
              alignItems: 'center',
              border: '1px solid rgba(96,165,250,0.35)',
              borderRadius: 8,
              padding: '0.35rem',
              background: 'rgba(37,99,235,0.12)',
              maxWidth: '100%',
            }}
          >
            <span style={{ color: '#bfdbfe', fontWeight: 700, fontSize: '0.82rem' }}>{providerIndex + 1}</span>
            <span style={{ color: '#e5e7eb', fontSize: '0.86rem', overflowWrap: 'anywhere' }}>{getProviderLabel(providers, providerId)}</span>
            <button type="button" style={smallButtonStyle} onClick={() => onChange(moveProviderInOrder(selected, providerIndex, providerIndex - 1))} disabled={providerIndex === 0} aria-label={`${providerId} 上移`}>↑</button>
            <button type="button" style={smallButtonStyle} onClick={() => onChange(moveProviderInOrder(selected, providerIndex, providerIndex + 1))} disabled={providerIndex === selected.length - 1} aria-label={`${providerId} 下移`}>↓</button>
            <button type="button" style={{ ...smallButtonStyle, color: '#fca5a5' }} onClick={() => onChange(removeProviderFromOrder(selected, providerId))} aria-label={`移除 ${providerId}`}>×</button>
          </div>
        ))}
      </div>

      {available.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>添加</span>
          {available.map((providerId) => (
            <button key={providerId} type="button" style={smallButtonStyle} onClick={() => onChange(addProviderToOrder(selected, providerId))}>
              + {getProviderLabel(providers, providerId)}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        <input
          value={customProviderId}
          onChange={(event) => setCustomProviderId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitCustomProvider();
            }
          }}
          placeholder="自定义 provider id"
          style={{ ...inputStyle, flex: '1 1 180px', minWidth: 0 }}
          aria-label="自定义 provider id"
        />
        <button type="button" style={buttonStyle} onClick={commitCustomProvider} disabled={!customProviderId.trim()}>添加自定义</button>
        {providerIds.length > 0 && (
          <button type="button" style={buttonStyle} onClick={() => onChange(providerIds)} disabled={providerIds.every((providerId) => selected.includes(providerId))}>
            使用全部
          </button>
        )}
      </div>
    </div>
  );
}

export default function PriorityRulesTab({
  rules = [],
  providers = [],
  conflicts = [],
  loading = false,
  message = '',
  onAddRule,
  onDeleteRule,
  onReorderRules,
  onSaveRules,
}: PriorityRulesTabProps) {
  const [draftRules, setDraftRules] = useState<PriorityRule[]>(rules);

  useEffect(() => {
    setDraftRules(rules);
  }, [rules]);

  const configuredProviders = useMemo(() => providers.filter((provider) => provider.configured), [providers]);
  const providerIds = configuredProviders.length > 0 ? configuredProviders.map((provider) => provider.id) : providers.map((provider) => provider.id);
  const realtimeConflicts = useMemo(() => detectPriorityRuleConflicts(draftRules), [draftRules]);
  const visibleConflicts = realtimeConflicts;
  const blockingCount = visibleConflicts.filter((conflict) => conflict.severity === 'error').length;

  const updateDraft = (next: PriorityRule[]) => {
    setDraftRules(next);
    onReorderRules?.(next);
  };

  const updateRule = (id: string, patch: Partial<PriorityRule>) => {
    setDraftRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const addRule = () => {
    const next = [...draftRules, createBlankPriorityRule(providerIds.slice(0, 2))];
    setDraftRules(next);
    onAddRule?.();
  };

  const removeRule = (id: string) => {
    setDraftRules((current) => current.filter((rule) => rule.id !== id));
    onDeleteRule?.(id);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, color: '#fff' }}>优先级规则</h2>
            <HelpIcon tooltip={`解决多个供应商支持相同模型前缀时，首选哪一个的问题。

工作方式：
• 按从上到下的顺序，第一条命中的规则生效
• 规则的 Provider 顺序中，第一个可用的供应商作为首选
• 其余供应商自动作为该请求的故障转移链（失败后依次尝试）

示例：
claude-* → [100xlabs, muyuan, anthropic]
→ 优先用 100xlabs
→ 失败后依次尝试 muyuan、anthropic

注意：
⚠️ 开启智能路由后，本功能将被忽略
⚠️ 与故障转移链同属传统模式，两者协同生效`} />
          </div>
          <p style={{ margin: '0.25rem 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>
            拖拽/箭头排序，第一条命中的规则优先生效，最多 20 条。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {visibleConflicts.length > 0 && (
            <span style={{ color: blockingCount > 0 ? '#f87171' : '#fbbf24', fontWeight: 700 }}>
              ⚠️ 冲突 {visibleConflicts.length}
            </span>
          )}
          <button style={buttonStyle} onClick={addRule} disabled={draftRules.length >= 20 || loading}>新增规则</button>
          <button style={buttonStyle} onClick={() => onSaveRules?.(draftRules)} disabled={loading || blockingCount > 0}>
            {loading ? '保存中...' : '保存规则'}
          </button>
        </div>
      </div>

      {message && <div style={{ color: message.includes('失败') || message.includes('Failed') ? '#f87171' : '#93c5fd', fontSize: '0.9rem' }}>{message}</div>}

      {visibleConflicts.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {visibleConflicts.map((conflict, index) => (
            <div key={`${conflict.type}-${index}`} style={{ border: `1px solid ${conflict.severity === 'error' ? 'rgba(248,113,113,0.55)' : 'rgba(251,191,36,0.55)'}`, borderRadius: 10, padding: '0.75rem', color: conflict.severity === 'error' ? '#fecaca' : '#fde68a', background: conflict.severity === 'error' ? 'rgba(127,29,29,0.18)' : 'rgba(120,53,15,0.18)' }}>
              <strong>{conflict.severity === 'error' ? '错误' : '警告'} · {conflict.type}</strong>
              <div style={{ marginTop: '0.25rem', color: '#d1d5db' }}>{conflict.message}</div>
            </div>
          ))}
        </div>
      )}

      {draftRules.length === 0 ? (
        <div className="stat-card" style={{ color: '#9ca3af', border: '1px dashed rgba(255,255,255,0.15)', padding: '1.5rem', textAlign: 'center' }}>
          暂无优先级规则。点击「新增规则」开始配置。
        </div>
      ) : draftRules.map((rule, index) => {
        const state = getRuleConflictState(rule.id, visibleConflicts);
        const borderColor = state.severity === 'error' ? 'rgba(248,113,113,0.75)' : state.severity === 'warning' ? 'rgba(251,191,36,0.75)' : 'rgba(52,211,153,0.35)';
        const providerOrder = normalizeProviderOrder(rule.providerOrder);
        return (
          <div key={rule.id} className="stat-card" style={{ color: '#d1d5db', border: `1px solid ${borderColor}`, borderRadius: 14, padding: '1rem', background: 'rgba(255,255,255,0.035)', display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>#{index + 1}</span>
                <input value={rule.name} onChange={(event) => updateRule(rule.id, { name: event.target.value })} style={{ ...inputStyle, minWidth: 180 }} aria-label="规则名称" />
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', color: '#9ca3af' }}>
                  <input type="checkbox" checked={rule.enabled} onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })} /> 启用
                </label>
                {state.severity && <span style={{ color: state.severity === 'error' ? '#f87171' : '#fbbf24', fontWeight: 700 }}>{state.severity === 'error' ? '错误' : '警告'} {state.count}</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button style={buttonStyle} onClick={() => updateDraft(movePriorityRule(draftRules, index, index - 1))} disabled={index === 0}>↑</button>
                <button style={buttonStyle} onClick={() => updateDraft(movePriorityRule(draftRules, index, index + 1))} disabled={index === draftRules.length - 1}>↓</button>
                <button style={{ ...buttonStyle, color: '#fca5a5' }} onClick={() => removeRule(rule.id)}>删除</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                model pattern
                <input value={rule.modelPattern} onChange={(event) => updateRule(rule.id, { modelPattern: event.target.value })} placeholder="gpt-*" style={{ ...inputStyle, width: '100%' }} />
              </label>
              <div style={{ display: 'grid', gap: '0.35rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>Provider 顺序</span>
                  <span style={{ color: providerOrder.length > 0 ? '#93c5fd' : '#fca5a5', overflowWrap: 'anywhere' }}>
                    {providerOrder.length > 0 ? providerOrder.join(' → ') : '未选择'}
                  </span>
                </div>
                <ProviderOrderEditor
                  providerOrder={providerOrder}
                  providers={providers}
                  providerIds={providerIds}
                  onChange={(nextProviderOrder) => updateRule(rule.id, { providerOrder: nextProviderOrder })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
