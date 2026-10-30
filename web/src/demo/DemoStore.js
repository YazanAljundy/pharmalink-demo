import seed from './fixtures/demoData.json';
import { emitDemoEvent } from './demoEvents';

const clone = (value) => structuredClone(value);
const stamp = () => new Date().toISOString();
let activeRole = 'warehouse';
let sequence = 1;

export class DemoStore {
  constructor(data = seed) {
    this.reset(data);
  }

  reset(data = seed) {
    Object.assign(this, clone(data));
    this.products = this.products.map((product) => {
      const category = this.categories.find((row) => row.id === product.categoryId);
      const maker = this.manufacturers.find((row) => row.id === product.manufacturerId);
      return {
        ...product,
        price: product.priceUsd,
        priceUsd: product.priceUsd,
        discountPriceUsd: product.priceUsd,
        unitAr: product.unit,
        unitEn: product.unit,
        manufacturerAr: maker?.nameAr ?? '',
        manufacturerEn: maker?.nameEn ?? '',
        category: category ? clone(category) : null,
        warehouseId: 'demo-wh-1',
        image: '/images/demo-product.svg',
        imageUrl: '/images/demo-product.svg',
        catalogImageUrl: '/images/demo-product.svg',
        manuallyDisabled: false,
        bonuses: [],
        createdAt: stamp(),
      };
    });
    this.categories = this.categories.map((category) => ({
      ...category,
      catalogItemCount: this.products.filter((product) => product.categoryId === category.id).length,
      productCount: this.products.filter((product) => product.categoryId === category.id).length,
    }));
    this.offers = this.offers.map((offer) => ({
      ...offer,
      titleAr: offer.titleAr ?? 'عرض تجريبي',
      titleEn: offer.titleEn ?? offer.title,
      discountPercentage: offer.discountPercentage ?? offer.discountPercent,
      warehouse: this.warehouses.find((warehouse) => warehouse.id === offer.warehouseId),
      createdAt: stamp(),
      items: [],
    }));
    this.banners = this.banners.map((banner) => ({
      ...banner,
      titleAr: banner.titleAr ?? 'إعلان تجريبي',
      titleEn: banner.titleEn ?? banner.title,
      startDate: banner.startDate ?? stamp(),
      endDate: banner.endDate ?? new Date(Date.now() + 30 * 86400000).toISOString(),
    }));
    this.advertisements = this.advertisements.map((ad) => ({
      ...ad,
      titleAr: ad.titleAr ?? 'باقة تجريبية',
      titleEn: ad.titleEn ?? ad.title,
      createdAt: stamp(),
      items: ad.items ?? [],
    }));
    this.discountCodes = this.discountCodes.map((code) => ({
      ...code,
      startDate: code.startDate ?? stamp(),
      endDate: code.endDate ?? new Date(Date.now() + 30 * 86400000).toISOString(),
      maxUses: code.maxUses ?? 100,
      usedCount: code.usedCount ?? 12,
      ownerRole: code.ownerRole ?? (code.warehouseId ? 'warehouse' : 'admin'),
      warehouse: this.warehouses.find((warehouse) => warehouse.id === code.warehouseId),
      fundedBy: code.fundedBy ?? (code.warehouseId ? 'warehouse' : 'platform'),
      displayStatus: code.displayStatus ?? (code.status === 'approved' ? 'active' : code.status),
    }));
    this.orders = this.orders.map((order) => ({
      ...order,
      finalPrice: order.totalSyp,
      totalPrice: order.totalSyp,
      notes: '',
      pharmacy: this.pharmacies.find((row) => row.id === order.pharmacyId),
      warehouse: this.warehouses.find((row) => row.id === order.warehouseId),
      createdAt: order.createdAt ?? stamp(),
      statusHistory: [{ status: order.status, changedAt: order.createdAt ?? stamp(), note: null }],
      items: order.items?.length
        ? order.items
        : [{
          id: `item-${order.id}`,
          product: this.products[0],
          productId: this.products[0].id,
          productNameAr: this.products[0].nameAr,
          productNameEn: this.products[0].nameEn,
          manufacturerAr: this.products[0].manufacturerAr,
          manufacturerEn: this.products[0].manufacturerEn,
          quantity: 2,
          unitPrice: this.products[0].priceSyp,
          discountPrice: this.products[0].priceSyp,
          priceSyp: this.products[0].priceSyp,
          savingsUsd: 0,
        }],
    }));
    this.returns = this.returns.map((item) => ({
      ...item,
      order: this.orders.find((order) => order.id === item.orderId),
      pharmacy: this.pharmacies.find((pharmacy) => pharmacy.id === this.orders.find((order) => order.id === item.orderId)?.pharmacyId),
      orderNumber: this.orders.find((order) => order.id === item.orderId)?.orderNumber,
      pharmacyNameEn: this.pharmacies.find((pharmacy) => pharmacy.id === this.orders.find((order) => order.id === item.orderId)?.pharmacyId)?.nameEn,
      pharmacyNameAr: this.pharmacies.find((pharmacy) => pharmacy.id === this.orders.find((order) => order.id === item.orderId)?.pharmacyId)?.nameAr,
      pharmacyPhone: this.pharmacies.find((pharmacy) => pharmacy.id === this.orders.find((order) => order.id === item.orderId)?.pharmacyId)?.phone,
      images: item.images ?? [],
      notes: item.notes ?? item.reason ?? '',
      items: item.items ?? [{ orderItemId: `item-${item.orderId}`, productNameEn: this.products[0].nameEn, productNameAr: this.products[0].nameAr, quantity: 1, reasonType: 'other' }],
      createdAt: item.createdAt ?? stamp(),
    }));
    this.complaints = this.complaints.map((complaint, index) => ({
      complaintNumber: 7001 + index,
      subject: complaint.subject ?? complaint.title,
      contextType: complaint.contextType ?? complaint.context ?? 'general',
      relatedOrderNumber: complaint.relatedOrderNumber ?? this.orders.find((order) => order.id === complaint.orderId)?.orderNumber ?? null,
      createdAt: stamp(),
      updatedAt: stamp(),
      pharmacy: this.pharmacies.find((pharmacy) => pharmacy.id === complaint.pharmacyId),
      warehouse: this.warehouses.find((warehouse) => warehouse.id === complaint.warehouseId),
      ...complaint,
    }));
    this.exchangeRateHistory ??= [];
    this.notifications ??= [];
    this.manufacturerDiscounts ??= [];
    this.imports ??= [];
    this.importRows ??= [];
    this.debts = this.calculateBalances();
  }

  get user() {
    return activeRole === 'admin'
      ? clone(this.admin)
      : clone({ ...this.warehouses[0], name: this.warehouses[0].nameEn });
  }

  get warehouse() {
    return activeRole === 'warehouse' ? clone(this.warehouses[0]) : null;
  }

  setRole(role) {
    activeRole = role === 'admin' ? 'admin' : 'warehouse';
  }

  allAccounts() {
    const accounts = [this.admin, ...this.warehouses, ...this.pharmacies];
    return accounts.map((row) => ({
      user: { id: row.id, name: row.name ?? row.nameEn, phone: row.phone, role: row.role, status: row.status, createdAt: stamp() },
      pharmacy: row.role === 'pharmacy' ? clone(row) : null,
      warehouse: row.role === 'warehouse' ? clone(row) : null,
    }));
  }

  calculateBalances() {
    const balances = new Map();
    for (const entry of this.ledgerEntries ?? []) {
      const key = entry.pharmacyId;
      if (!key) continue;
      balances.set(key, (balances.get(key) ?? 0) + (entry.type === 'debit' ? entry.amountSyp : -entry.amountSyp));
    }
    return [...balances].map(([pharmacyId, balanceSyp]) => ({
      pharmacy: clone(this.pharmacies.find((pharmacy) => pharmacy.id === pharmacyId)),
      pharmacyId,
      balanceSyp,
      balance: balanceSyp,
      entries: (this.ledgerEntries ?? []).filter((entry) => entry.pharmacyId === pharmacyId).map(clone),
    }));
  }

  emit(event, payload) {
    emitDemoEvent(event, { ...payload, eventId: `demo-event-${sequence++}` });
  }

  createOrder(data = {}) {
    const orderNumber = Math.max(1000, ...this.orders.map((order) => Number(order.orderNumber) || 0)) + 1;
    const order = {
      id: `demo-order-${sequence++}`,
      orderNumber,
      status: 'pending',
      pharmacyId: data.pharmacyId ?? this.pharmacies[(sequence - 1) % this.pharmacies.length].id,
      warehouseId: data.warehouseId ?? this.warehouses[0].id,
      totalSyp: Number(data.totalSyp) || 64000,
      items: data.items ?? [{
        id: `item-${sequence}`,
        product: this.products[0],
        productId: this.products[0].id,
        productNameAr: this.products[0].nameAr,
        productNameEn: this.products[0].nameEn,
        manufacturerAr: this.products[0].manufacturerAr,
        manufacturerEn: this.products[0].manufacturerEn,
        quantity: 2,
        unitPrice: this.products[0].priceSyp,
        discountPrice: this.products[0].priceSyp,
        priceSyp: this.products[0].priceSyp,
        savingsUsd: 0,
      }],
      finalPrice: Number(data.totalSyp) || 64000,
      totalPrice: Number(data.totalSyp) || 64000,
      notes: '',
      statusHistory: [{ status: 'pending', changedAt: stamp(), note: null }],
      createdAt: stamp(),
      pharmacy: clone(this.pharmacies.find((pharmacy) => pharmacy.id === (data.pharmacyId ?? this.pharmacies[0].id))),
      warehouse: clone(this.warehouses.find((warehouse) => warehouse.id === (data.warehouseId ?? this.warehouses[0].id))),
    };
    this.orders.push(order);
    this.emit('order.created', { orderId: order.id, warehouseId: order.warehouseId, order });
    setTimeout(() => {
      if (order.status === 'pending') this.advanceOrder(order, 'confirmed');
    }, 8000);
    setTimeout(() => {
      if (order.status !== 'delivered' && order.status !== 'cancelled') this.advanceOrder(order, 'delivered');
    }, 20000);
    return order;
  }

  advanceOrder(order, status) {
    const sequenceOrder = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
    const currentIndex = sequenceOrder.indexOf(order.status);
    order.status = status ?? sequenceOrder[Math.min(currentIndex + 1, sequenceOrder.length - 1)];
    order.updatedAt = stamp();
    this.emit('order.status.updated', { orderId: order.id, warehouseId: order.warehouseId, status: order.status });
    order.statusHistory ??= [];
    order.statusHistory.push({ status: order.status, changedAt: order.updatedAt, note: null });
    if (order.status === 'delivered' && !this.ledgerEntries.some((entry) => entry.orderId === order.id)) {
      this.ledgerEntries.push({
        id: `ledger-${sequence++}`,
        orderId: order.id,
        pharmacyId: order.pharmacyId,
        warehouseId: order.warehouseId,
        amountSyp: order.totalSyp,
        type: 'debit',
        createdAt: stamp(),
      });
      this.debts = this.calculateBalances();
    }
    return order;
  }

  approveReturn(item) {
    item.status = 'approved';
    item.approvedAt = stamp();
    const order = this.orders.find((row) => row.id === item.orderId);
    if (order && !this.ledgerEntries.some((entry) => entry.returnId === item.id)) {
      this.ledgerEntries.push({
        id: `ledger-${sequence++}`,
        returnId: item.id,
        orderId: order.id,
        pharmacyId: order.pharmacyId,
        warehouseId: order.warehouseId,
        amountSyp: Number(item.amountSyp) || 0,
        type: 'credit',
        createdAt: stamp(),
      });
      this.debts = this.calculateBalances();
    }
    this.emit('return.status.updated', { returnId: item.id, warehouseId: order?.warehouseId, status: item.status });
    return item;
  }

  createPayment(data = {}) {
    const payment = {
      id: `demo-payment-${sequence++}`,
      pharmacyId: data.pharmacyId ?? this.pharmacies[0].id,
      warehouseId: data.warehouseId ?? this.warehouses[0].id,
      amountSyp: Number(data.amountSyp) || 10000,
      method: data.method ?? 'cash',
      status: 'completed',
      reference: data.reference ?? '',
      createdAt: stamp(),
    };
    this.payments.push(payment);
    this.ledgerEntries.push({
      id: `ledger-${sequence++}`,
      paymentId: payment.id,
      pharmacyId: payment.pharmacyId,
      warehouseId: payment.warehouseId,
      amountSyp: payment.amountSyp,
      type: 'credit',
      createdAt: stamp(),
    });
    this.debts = this.calculateBalances();
    this.emit('payment.created', { paymentId: payment.id, warehouseId: payment.warehouseId });
    return payment;
  }

  reversePayment(paymentId, reason) {
    const payment = this.payments.find((row) => row.id === paymentId);
    if (!payment || payment.status === 'reversed') return payment;
    payment.status = 'reversed';
    payment.reversalReason = reason ?? 'Demo reversal';
    this.ledgerEntries.push({
      id: `ledger-${sequence++}`,
      paymentId: payment.id,
      pharmacyId: payment.pharmacyId,
      warehouseId: payment.warehouseId,
      amountSyp: payment.amountSyp,
      type: 'debit',
      isReversal: true,
      createdAt: stamp(),
    });
    this.debts = this.calculateBalances();
    this.emit('payment.reversed', { paymentId: payment.id, warehouseId: payment.warehouseId });
    return payment;
  }

  addReturn(data = {}) {
    const order = this.orders.find((row) => row.id === data.orderId) ?? this.orders[0];
    const item = {
      id: `demo-return-${sequence++}`,
      orderId: order.id,
      order,
      status: 'pending',
      reason: data.reason ?? 'Demo return request',
      createdAt: stamp(),
      ...data,
    };
    this.returns.unshift(item);
    this.emit('return.created', { returnId: item.id, warehouseId: order.warehouseId });
    return item;
  }

  addNotification(title, body) {
    const item = { id: `notification-${sequence++}`, title, body, createdAt: stamp(), isRead: false };
    this.notifications.unshift(item);
    return item;
  }
}

export const demoStore = new DemoStore();

export function simulateIncomingOrder() {
  return demoStore.createOrder({
    pharmacyId: demoStore.pharmacies[0].id,
    warehouseId: demoStore.warehouses[0].id,
    totalSyp: 73500,
  });
}
