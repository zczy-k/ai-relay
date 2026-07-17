import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Controllable CF signal — the factory must re-read this on every call, not
// cache the first answer. This is the regression guard for the bug where the
// first caller in an isolate permanently pinned the backend (P2).
const cfState = { value: false };
vi.mock('@/lib/cf-env', () => ({
  isCloudflareSync: () => cfState.value,
}));

import {
  getDefaultRequestLogStore,
  setDefaultRequestLogStore,
  __resetDefaultRequestLogStore,
  KVRequestLogStore,
  MemoryRequestLogStore,
} from '../lib/observability/request-log-store';

describe('request log store factory', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    cfState.value = false;
    __resetDefaultRequestLogStore();
  });

  afterEach(() => {
    __resetDefaultRequestLogStore();
  });

  it('re-selects the backend per call when the CF signal flips', () => {
    // First access is OUTSIDE a CF context (e.g. a build-time/module-init
    // caller, or a non-CF isolate). Pre-fix this would lock in MemoryStore.
    cfState.value = false;
    expect(getDefaultRequestLogStore()).toBeInstanceOf(MemoryRequestLogStore);

    // A later request runs inside a CF context: the factory must now hand back
    // the KV store, not the memory store the first caller selected.
    cfState.value = true;
    expect(getDefaultRequestLogStore()).toBeInstanceOf(KVRequestLogStore);

    // And back again — selection always follows the current signal.
    cfState.value = false;
    expect(getDefaultRequestLogStore()).toBeInstanceOf(MemoryRequestLogStore);
  });

  it('returns a stable instance for a given backend across calls', () => {
    cfState.value = true;
    const a = getDefaultRequestLogStore();
    const b = getDefaultRequestLogStore();
    // Same instance so KV/memory state (in-memory logs, append counter) persists.
    expect(a).toBe(b);
  });

  it('honors a test override above environment detection', () => {
    const fake = new MemoryRequestLogStore();
    setDefaultRequestLogStore(fake);
    cfState.value = true; // would otherwise select KV
    expect(getDefaultRequestLogStore()).toBe(fake);
  });
});
