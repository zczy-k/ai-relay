import type { ProviderInfo } from '../types';

interface SetupData {
  checks: { adminKey: boolean; relayKey: boolean; kv: boolean; providerKeys: boolean };
  providers: Array<{
    id: string;
    name: string;
    configured: boolean;
    keyCount: number;
    availableKeys: number;
    envKeyField?: string;
    models?: ProviderInfo['models'];
  }>;
  timestamp: string;
  isCloudflare?: boolean;
}

interface Props {
  t: any;
  setupData: SetupData | null;
  loading: boolean;
  onRunChecks: () => void;
  onOpenKeys: (providerId?: string) => void;
}

interface CheckGuide {
  title: string;
  steps: string[];
  envKeys?: string[];
  actionLabel?: string;
  onAction?: () => void;
}

function CheckRow({ label, ok, hint, guide, t }: { label: string; ok: boolean; hint: string; guide?: CheckGuide; t: any }) {
  return (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700 }}>{label}</div>
          <div style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '0.25rem', lineHeight: 1.5 }}>{hint}</div>
        </div>
        <span style={{ color: ok ? '#34d399' : '#f87171', fontWeight: 800, whiteSpace: 'nowrap' }}>{ok ? t.setupPassed : t.setupFailed}</span>
      </div>
      {!ok && guide && (
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}>
          <div style={{ color: '#fbbf24', fontSize: '0.82rem', fontWeight: 700 }}>{guide.title}</div>
          {guide.envKeys && guide.envKeys.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {guide.envKeys.map((envKey) => (
                <code
                  key={envKey}
                  style={{
                    color: '#bfdbfe',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.22)',
                    borderRadius: '6px',
                    padding: '0.18rem 0.42rem',
                    fontSize: '0.78rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {envKey}
                </code>
              ))}
            </div>
          )}
          <ol style={{ margin: 0, paddingLeft: '1.1rem', color: '#d1d5db', fontSize: '0.82rem', lineHeight: 1.6 }}>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {guide.actionLabel && guide.onAction && (
            <button
              className="tab-btn"
              onClick={guide.onAction}
              style={{ alignSelf: 'flex-start', padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
            >
              {guide.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SetupTab({ t, setupData, loading, onRunChecks, onOpenKeys }: Props) {
  const checks = setupData?.checks;
  const providers = setupData?.providers || [];
  const firstUnconfiguredProvider = providers.find((p) => !p.configured && p.keyCount === 0);
  const providerEnvKeys = providers
    .map((p) => p.envKeyField)
    .filter((envKey): envKey is string => Boolean(envKey))
    .slice(0, 4);

  const isCf = setupData?.isCloudflare;

  const guides = {
    adminKey: {
      title: isCf ? (t.setupAdminKeyFixTitleCf || t.setupAdminKeyFixTitle) : t.setupAdminKeyFixTitle,
      envKeys: ['RELAY_ADMIN_KEY'],
      steps: isCf
        ? [t.setupAdminKeyStep1Cf || t.setupAdminKeyStep1, t.setupAdminKeyStep2Cf || t.setupAdminKeyStep2, t.setupAdminKeyStep3Cf || t.setupAdminKeyStep3]
        : [t.setupAdminKeyStep1, t.setupAdminKeyStep2, t.setupAdminKeyStep3],
    },
    relayKey: {
      title: isCf ? (t.setupRelayKeyFixTitleCf || t.setupRelayKeyFixTitle) : t.setupRelayKeyFixTitle,
      envKeys: ['RELAY_API_KEY'],
      steps: isCf
        ? [t.setupRelayKeyStep1Cf || t.setupRelayKeyStep1, t.setupRelayKeyStep2Cf || t.setupRelayKeyStep2, t.setupRelayKeyStep3Cf || t.setupRelayKeyStep3]
        : [t.setupRelayKeyStep1, t.setupRelayKeyStep2, t.setupRelayKeyStep3],
    },
    kv: {
      title: isCf ? (t.setupKvFixTitleCf || t.setupKvFixTitle) : t.setupKvFixTitle,
      envKeys: isCf ? ['KV'] : ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
      steps: isCf
        ? [t.setupKvStep1Cf || t.setupKvStep1, t.setupKvStep2Cf || t.setupKvStep2, t.setupKvStep3Cf || t.setupKvStep3]
        : [t.setupKvStep1, t.setupKvStep2, t.setupKvStep3],
    },
    providerKeys: {
      title: t.setupProviderKeysFixTitle,
      envKeys: providerEnvKeys,
      steps: [
        t.setupProviderKeysStep1,
        isCf ? (t.setupProviderKeysStep2Cf || t.setupProviderKeysStep2) : t.setupProviderKeysStep2,
        t.setupProviderKeysStep3,
      ],
      actionLabel: t.setupOpenKeysAction,
      onAction: () => onOpenKeys(firstUnconfiguredProvider?.id),
    },
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff' }}>{t.setupTitle}</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#9ca3af' }}>{isCf ? (t.setupDescCf || t.setupDesc) : t.setupDesc}</p>
        </div>
        <button className="tab-btn active" onClick={onRunChecks} disabled={loading}>{loading ? t.refreshing : t.setupRunChecks}</button>
      </div>

      {checks ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <CheckRow label="RELAY_ADMIN_KEY" ok={checks.adminKey} hint={t.setupAdminKeyHint} guide={guides.adminKey} t={t} />
          <CheckRow label="RELAY_API_KEY" ok={checks.relayKey} hint={t.setupRelayKeyHint} guide={guides.relayKey} t={t} />
          <CheckRow 
            label={isCf ? (t.setupKvLabelCf || t.setupKvLabel) : t.setupKvLabel} 
            ok={checks.kv} 
            hint={checks.kv ? (isCf ? (t.setupKvReadyCf || t.setupKvReady) : t.setupKvReady) : (isCf ? (t.setupKvFallbackCf || t.setupKvFallback) : t.setupKvFallback)} 
            guide={guides.kv} 
            t={t} 
          />
          <CheckRow label={t.setupProviderKeys} ok={checks.providerKeys} hint={t.setupProviderKeysHint} guide={guides.providerKeys} t={t} />
        </div>
      ) : (
        <div className="stat-card" style={{ color: '#9ca3af' }}>{t.setupEmpty}</div>
      )}

      <div>
        <h3 style={{ color: '#fff', margin: '0 0 0.75rem' }}>{t.setupProviderReadiness}</h3>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {providers.map((p) => (
            <div key={p.id} className="stat-card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#e5e7eb' }}>{p.name}</strong>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                  {p.id} · {p.envKeyField || t.setupNoEnvKeyField} · keys {p.availableKeys}/{p.keyCount}
                </div>
              </div>
              <span style={{ color: p.configured || p.keyCount > 0 ? '#34d399' : '#f87171' }}>
                {p.configured || p.keyCount > 0 ? t.statusOk : t.statusNoKeys}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
