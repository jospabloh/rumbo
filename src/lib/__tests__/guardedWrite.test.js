import { describe, it, expect, vi, beforeEach } from 'vitest';

// base44.functions.invoke() is plain axios under the hood for this client
// (interceptResponses: false — see guardedWrite.js's own comment), so a
// non-2xx guardedEntityWrite response makes invoke() REJECT rather than
// resolve with an ok:false body. This mock lets each test control exactly
// what that promise does, the same way a real axios call would behave.
const invoke = vi.fn();
vi.mock('@/api/base44Client', () => ({
  base44: { functions: { invoke } },
}));

const { guardedCreate, guardedUpdate, guardedDelete } = await import('../guardedWrite.js');

describe('guardedWrite', () => {
  beforeEach(() => { invoke.mockReset(); });

  it('returns the record on a successful create', async () => {
    invoke.mockResolvedValue({ data: { ok: true, record: { id: '1' } } });
    const record = await guardedCreate('Vehicle', { plate: 'ABC' });
    expect(record).toEqual({ id: '1' });
    expect(invoke).toHaveBeenCalledWith('guardedEntityWrite', {
      entity: 'Vehicle', operation: 'create', data: { plate: 'ABC' },
    });
  });

  it('throws guardedEntityWrite\'s own message for a 2xx response with ok:false', async () => {
    invoke.mockResolvedValue({
      data: { ok: false, code: 'PERMISSION_DENIED', error: 'No tienes permiso para editar vehículos.' },
    });
    await expect(guardedUpdate('Vehicle', '1', {})).rejects.toMatchObject({
      message: 'No tienes permiso para editar vehículos.',
      code: 'PERMISSION_DENIED',
    });
  });

  // The bug this test pins: before the fix, invokeGuarded() had no try/catch
  // at all, so this exact rejection propagated as-is — the caller saw the
  // generic "Request failed with status code 400" instead of the real
  // reason guardedEntityWrite wrote into the response body.
  it('surfaces the real error body when invoke() rejects on a non-2xx response', async () => {
    const axiosError = new Error('Request failed with status code 400');
    axiosError.response = { status: 400, data: { ok: false, code: 'NO_TENANT', error: 'No tenant assigned' } };
    invoke.mockRejectedValue(axiosError);
    await expect(guardedUpdate('Vehicle', '1', {})).rejects.toMatchObject({
      message: 'No tenant assigned',
      code: 'NO_TENANT',
    });
  });

  it('falls back to the raw error message when the rejection carries no parsable body', async () => {
    invoke.mockRejectedValue(new Error('Network Error'));
    await expect(guardedDelete('Vehicle', '1')).rejects.toMatchObject({ message: 'Network Error' });
  });
});
