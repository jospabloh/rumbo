import { describe, it, expect } from 'vitest';
import { shouldPersist, shouldRestore, LAST_PATH_KEY } from '@/lib/routePersistence';

describe('shouldPersist', () => {
  it('persists internal routes', () => {
    expect(shouldPersist('/vehicles')).toBe(true);
    expect(shouldPersist('/')).toBe(true);
  });
  it('skips the public landing and invalid input', () => {
    expect(shouldPersist('/landing')).toBe(false);
    expect(shouldPersist('/Landing/')).toBe(false);
    expect(shouldPersist('vehicles')).toBe(false);
    expect(shouldPersist(null)).toBe(false);
  });
});

describe('shouldRestore', () => {
  it('restores a saved section only when landing on root', () => {
    expect(shouldRestore('/', '/vehicles')).toBe(true);
  });
  it('does not restore when already on a real route', () => {
    expect(shouldRestore('/drivers', '/vehicles')).toBe(false);
  });
  it('does not restore to root, landing, empty or invalid saved paths', () => {
    expect(shouldRestore('/', '/')).toBe(false);
    expect(shouldRestore('/', '/landing')).toBe(false);
    expect(shouldRestore('/', '')).toBe(false);
    expect(shouldRestore('/', null)).toBe(false);
    expect(shouldRestore('/', 'vehicles')).toBe(false);
  });
});

describe('LAST_PATH_KEY', () => {
  it('is a stable namespaced key', () => {
    expect(LAST_PATH_KEY).toBe('rumbo:last-path');
  });
});
