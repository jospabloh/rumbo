import { describe, it, expect } from 'vitest';
import { validateUploadFile } from '@/lib/uploadValidation';

function makeFile(name, sizeBytes, type = 'application/octet-stream') {
  const file = new File([new Uint8Array(Math.max(0, sizeBytes))], name, { type });
  return file;
}

describe('validateUploadFile', () => {
  it('accepts a file with an allowed extension and size', () => {
    const file = makeFile('license.pdf', 1024);
    expect(validateUploadFile(file, { extensions: ['.pdf', '.jpg'], maxSizeMB: 10 })).toBe('');
  });

  it('rejects a disallowed extension', () => {
    const file = makeFile('malware.exe', 1024);
    const err = validateUploadFile(file, { extensions: ['.pdf', '.jpg'], maxSizeMB: 10 });
    expect(err).toMatch(/no permitido/);
  });

  it('rejects a file with no extension', () => {
    const file = makeFile('noextension', 1024);
    const err = validateUploadFile(file, { extensions: ['.pdf'], maxSizeMB: 10 });
    expect(err).toMatch(/no permitido/);
  });

  it('is case-insensitive on the extension', () => {
    const file = makeFile('SCAN.PDF', 1024);
    expect(validateUploadFile(file, { extensions: ['.pdf'], maxSizeMB: 10 })).toBe('');
  });

  it('rejects a file over the size cap', () => {
    const file = makeFile('huge.pdf', 11 * 1024 * 1024);
    const err = validateUploadFile(file, { extensions: ['.pdf'], maxSizeMB: 10 });
    expect(err).toMatch(/máximo/);
  });

  it('accepts a file exactly at the size cap', () => {
    const file = makeFile('exact.pdf', 10 * 1024 * 1024);
    expect(validateUploadFile(file, { extensions: ['.pdf'], maxSizeMB: 10 })).toBe('');
  });

  it('skips extension check when no allowlist is given', () => {
    const file = makeFile('anything.xyz', 1024);
    expect(validateUploadFile(file, { maxSizeMB: 10 })).toBe('');
  });

  it('skips size check when no cap is given', () => {
    const file = makeFile('big.pdf', 50 * 1024 * 1024);
    expect(validateUploadFile(file, { extensions: ['.pdf'] })).toBe('');
  });

  it('returns "" for a null/undefined file (nothing selected)', () => {
    expect(validateUploadFile(null, { extensions: ['.pdf'], maxSizeMB: 10 })).toBe('');
    expect(validateUploadFile(undefined, { extensions: ['.pdf'], maxSizeMB: 10 })).toBe('');
  });
});
