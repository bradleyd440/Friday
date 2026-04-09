import { describe, expect, it, vi } from 'vitest';
import { FirebaseRestAdapter } from '../services/lockMode/firebaseRestAdapter';

describe('FirebaseRestAdapter', () => {
  it('writes with PUT for set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const adapter = new FirebaseRestAdapter({
      databaseUrl: 'https://example.firebaseio.com/',
      authToken: 'abc123',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await adapter.set('/sessions/s1/lockMode/', { activeMode: 'tease' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.firebaseio.com/sessions/s1/lockMode.json?auth=abc123',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('returns generated key from push', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: '-Nx123' }),
    });

    const adapter = new FirebaseRestAdapter({
      databaseUrl: 'https://example.firebaseio.com',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const key = await adapter.push('sessions/s1/logs', { message: 'hi' });
    expect(key).toBe('-Nx123');
  });

  it('notifies listener when polled value changes', async () => {
    const first = { ok: true, status: 200, json: async () => ({ value: 1 }) };
    const second = { ok: true, status: 200, json: async () => ({ value: 2 }) };
    const fetchMock = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const adapter = new FirebaseRestAdapter({
      databaseUrl: 'https://example.firebaseio.com',
      fetchImpl: fetchMock as unknown as typeof fetch,
      pollIntervalMs: 5,
    });

    const received: unknown[] = [];
    const unsubscribe = adapter.onValue('sessions/s1/timers', (value) => {
      received.push(value);
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    unsubscribe();

    expect(received.length).toBeGreaterThanOrEqual(2);
  });
});
