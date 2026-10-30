import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoStore, simulateIncomingOrder } from './DemoStore';
import { mockFetch } from './mockFetch';
import { createDemoSocket } from './demoEvents';
import { RealtimeClient } from '../realtime/realtimeClient';

describe('offline dashboard mock', () => {
  beforeEach(() => {
    demoStore.reset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('authenticates a demo warehouse without using the network', async () => {
    const response = await mockFetch('http://localhost:5000/api/auth/login-password', {
      method: 'POST',
      body: JSON.stringify({ phone: '0900000002', password: 'Demo@12345' }),
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.token).toBe('demo-warehouse-token');
    expect(data.user.role).toBe('warehouse');
    expect(data.warehouse.id).toBe('demo-wh-1');
  });

  it('searches and paginates products', async () => {
    const response = await mockFetch('http://localhost:5000/api/warehouse/products?search=ibuprofen&limit=1');
    const data = await response.json();

    expect(data.products).toHaveLength(1);
    expect(data.products[0].nameEn).toContain('Ibuprofen');
    expect(data.pagination.hasMore).toBe(false);
  });

  it('advances simulated orders and records a delivered-order debit', async () => {
    vi.useFakeTimers();
    const order = demoStore.createOrder();

    await vi.advanceTimersByTimeAsync(8000);
    expect(order.status).toBe('confirmed');
    await vi.advanceTimersByTimeAsync(12000);
    expect(order.status).toBe('delivered');
    expect(demoStore.ledgerEntries.some((entry) => entry.orderId === order.id && entry.type === 'debit')).toBe(true);
  });

  it('keeps the account balance unchanged after a payment is reversed', async () => {
    const before = demoStore.calculateBalances().find((row) => row.pharmacyId === 'demo-ph-1')?.balanceSyp ?? 0;
    const createdResponse = await mockFetch('http://localhost:5000/api/warehouse/payments', {
      method: 'POST',
      body: JSON.stringify({ pharmacyId: 'demo-ph-1', amountSyp: 24000, method: 'cash' }),
    });
    const { payment } = await createdResponse.json();
    await mockFetch(`http://localhost:5000/api/warehouse/payments/${payment.id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Demo correction' }),
    });

    expect(demoStore.calculateBalances().find((row) => row.pharmacyId === 'demo-ph-1')?.balanceSyp).toBe(before);
  });

  it('returns a well-formed success for unknown endpoints', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    await expect(mockFetch('http://localhost:5000/api/not-a-real-endpoint').then((response) => response.json()))
      .resolves.toMatchObject({ success: true, items: [], pagination: { hasMore: false } });
  });

  it('emits an order-created event for the header simulation action', async () => {
    const client = new RealtimeClient({ factory: createDemoSocket, coalesceMs: 0 });
    const received = vi.fn();
    client.connect('demo-warehouse-token');
    client.on('order.created', received);
    await Promise.resolve();

    simulateIncomingOrder();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received).toHaveBeenCalledWith(expect.objectContaining({ orderId: expect.any(String) }), 1, expect.any(Array));
    client.disconnect();
  });
});
