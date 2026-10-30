import { demoStore } from './DemoStore';

const delay = () => new Promise((resolve) => setTimeout(resolve, 180));
const ok = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const envelope = (key, value, extra = {}) => ({ success: true, [key]: value, ...extra });
const message = (text = 'Demo data updated.') => ({ success: true, message: text });
const readBody = async (options) => {
  if (!options?.body) return {};
  if (typeof options.body === 'string') {
    try { return JSON.parse(options.body); } catch { return {}; }
  }
  if (typeof options.body.get === 'function') {
    const body = {};
    for (const [key, value] of options.body.entries()) body[key] = value;
    for (const key of ['items', 'totalPriceUsd', 'mapping']) {
      if (typeof body[key] === 'string') {
        try { body[key] = JSON.parse(body[key]); } catch { /* Keep the submitted text. */ }
      }
    }
    return body;
  }
  return {};
};

function filtered(rows, query) {
  const search = (query.get('search') ?? query.get('q') ?? '').toLocaleLowerCase();
  return rows.filter((row) => {
    const text = JSON.stringify(row).toLocaleLowerCase();
    const date = row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : '';
    const status = row.displayStatus ?? row.status ?? row.user?.status;
    const role = row.role ?? row.user?.role;
    const discount = Number(row.discountPercentage ?? row.discountPercent ?? row.value ?? 0);
    return (!search || text.includes(search))
      && (!query.get('status') || query.get('status') === 'all' || status === query.get('status'))
      && (!query.get('role') || role === query.get('role'))
      && (!query.get('warehouseId') || row.warehouseId === query.get('warehouseId'))
      && (!(query.get('category') ?? query.get('categoryId')) || row.categoryId === (query.get('category') ?? query.get('categoryId')))
      && (!query.get('manufacturerId') || row.manufacturerId === query.get('manufacturerId'))
      && (!query.get('minDiscount') || discount >= Number(query.get('minDiscount')))
      && (!query.get('maxDiscount') || discount <= Number(query.get('maxDiscount')))
      && (!query.get('available') || query.get('available') !== 'true' || row.isAvailable !== false)
      && (!query.get('dateFrom') || !date || date >= query.get('dateFrom'))
      && (!query.get('dateTo') || !date || date <= query.get('dateTo'));
  });
}

function page(rows, query) {
  const limit = Math.max(1, Math.min(Number(query.get('limit')) || 20, 100));
  const cursor = query.get('after');
  const numericOffset = Number(cursor);
  const pageNumber = Math.max(1, Number(query.get('page')) || 1);
  const offset = !cursor ? (pageNumber - 1) * limit : Number.isFinite(numericOffset)
    ? numericOffset
    : Math.max(0, rows.findIndex((row) => row.id === cursor) + 1);
  const slice = rows.slice(offset, offset + limit);
  const hasMore = offset + limit < rows.length;
  return {
    rows: slice,
    pagination: { hasMore, nextCursor: hasMore ? String(slice.at(-1)?.id ?? offset + limit) : null },
  };
}

function withPagination(key, rows, query) {
  const result = page(filtered(rows, query), query);
  return { success: true, [key]: result.rows, pagination: result.pagination };
}

function recordById(rows, id) {
  return rows.find((row) => row.id === id);
}

function dateInRange(value, from, to) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return true;
  if (from && date < new Date(`${from}T00:00:00`)) return false;
  if (to && date > new Date(`${to}T23:59:59.999`)) return false;
  return true;
}

function approvedCreditsForOrder(order) {
  return demoStore.returns
    .filter((item) => item.status === 'approved' && item.orderId === order.id)
    .reduce((sum, item) => sum + (Number(item.creditSyp ?? item.amountSyp) || 0), 0);
}

function makeImportResult(path, body) {
  const isCatalog = path.startsWith('/admin/catalog/import');
  const batch = {
    id: `demo-import-${Date.now()}`,
    status: 'completed',
    fileName: body.file?.name ?? 'demo-import.xlsx',
    totalRows: 12,
    importedRows: 9,
    skippedRows: 2,
    errorRows: 1,
    createdAt: new Date().toISOString(),
    exchangeRateUsed: demoStore.exchangeRate.usdToSyp,
    counts: { added: 9, updated: 1, review: 1, rejected: 1, addedDisabled: 0 },
  };
  if (isCatalog) {
    return {
      success: true,
      imported: 9,
      skipped: 2,
      errors: 1,
      created: 9,
      updated: 0,
      report: { totalRows: 12, importedRows: 9, skippedRows: 2, errors: [] },
    };
  }
  const rows = [
    { id: `${batch.id}-row-1`, rowNumber: 11, bucket: 'review', raw: { name: 'Vitamin blend tablets', manufacturer: 'Summit Wellness', price: '2.10', currency: 'USD', unit: 'bottle' }, parsed: { priceUsd: 2.1, unit: 'bottle', bonuses: [] }, reasons: ['unknown_unit'], suggestions: [] },
    { id: `${batch.id}-row-2`, rowNumber: 12, bucket: 'added', raw: { name: 'Sterile cotton pads', manufacturer: 'Cedar Health Labs', price: '0.85', currency: 'USD', unit: 'pack' }, parsed: { priceUsd: 0.85, unit: 'pack', bonuses: [] }, reasons: [], suggestions: [] },
    { id: `${batch.id}-row-3`, rowNumber: 13, bucket: 'rejected', raw: { name: 'Sample product', manufacturer: 'Atlas Therapeutics', price: '', currency: '', unit: '' }, parsed: { priceUsd: null, unit: '', bonuses: [] }, reasons: ['missing_currency'], suggestions: [] },
  ];
  demoStore.imports.unshift(batch);
  demoStore.importRows.push(...rows);
  return { success: true, batch, import: batch, importId: batch.id, batchId: batch.id };
}

export async function mockFetch(input, options = {}) {
  await delay();
  try {
    const url = new URL(input, 'http://localhost');
    const path = url.pathname.replace(/^\/api/, '');
    const query = url.searchParams;
    const method = (options.method ?? 'GET').toUpperCase();
    const body = await readBody(options);
    const id = path.split('/').filter(Boolean).at(-1);
    const role = path === '/auth/login-password' ? (body.role === 'admin' || body.phone === demoStore.admin.phone ? 'admin' : 'warehouse') : null;

    if (path === '/auth/refresh') {
      return ok({ success: true, token: 'demo-access-token', refreshToken: 'demo-refresh-token' });
    }
    if (path === '/auth/login-password' || path === '/auth/login') {
      demoStore.setRole(role ?? 'warehouse');
      return ok({
        success: true,
        token: `demo-${role ?? 'warehouse'}-token`,
        refreshToken: 'demo-refresh-token',
        user: demoStore.user,
        warehouse: demoStore.warehouse,
      });
    }
    if (path === '/auth/me') {
      const token = options.headers?.Authorization ?? '';
      demoStore.setRole(token.includes('admin') ? 'admin' : 'warehouse');
      return ok({ success: true, user: demoStore.user, warehouse: demoStore.warehouse });
    }
    if (path.startsWith('/auth/')) return ok(message('Demo authentication action completed.'));

    if (path === '/warehouses' || path === '/pharmacy/warehouses') {
      return ok({ success: true, warehouses: structuredClone(demoStore.warehouses) });
    }
    if (path === '/categories' || path === '/admin/categories') {
      return ok({ success: true, categories: structuredClone(demoStore.categories) });
    }
    if (path === '/units') {
      return ok({ success: true, units: ['box', 'bottle', 'pack', 'piece', 'tube', 'sachet', 'roll', 'inhaler'] });
    }
    if (path === '/admin/exchange-rate' && method === 'PATCH') {
      const previous = demoStore.exchangeRate.usdToSyp;
      demoStore.exchangeRate.usdToSyp = Number(body.usdToSyp) || previous;
      demoStore.exchangeRate.updatedAt = new Date().toISOString();
      demoStore.exchangeRateHistory.unshift({
        id: `rate-${Date.now()}`,
        usdToSyp: demoStore.exchangeRate.usdToSyp,
        previousUsdToSyp: previous,
        createdAt: demoStore.exchangeRate.updatedAt,
      });
      return ok(message('Exchange rate updated.'));
    }
    if (path === '/admin/exchange-rate/reset' && method === 'PATCH') {
      demoStore.exchangeRate.usdToSyp = 10000;
      demoStore.exchangeRate.updatedAt = new Date().toISOString();
      demoStore.exchangeRateHistory.unshift({
        id: `rate-${Date.now()}`,
        usdToSyp: 10000,
        createdAt: demoStore.exchangeRate.updatedAt,
      });
      return ok(message('Exchange rate reset.'));
    }
    if (path === '/admin/exchange-rate/history') {
      return ok(withPagination('history', demoStore.exchangeRateHistory, query));
    }
    if (path === '/admin/exchange-rate') return ok({ success: true, exchangeRate: { ...demoStore.exchangeRate, source: 'manual', lastUpdated: demoStore.exchangeRate.updatedAt, manualOverride: true } });
    if (path === '/exchange-rate') return ok({ success: true, usdToSyp: demoStore.exchangeRate.usdToSyp });

    if (path === '/warehouse/orders' || path === '/admin/orders') {
      const orders = path.startsWith('/warehouse/')
        ? demoStore.orders.filter((order) => order.warehouseId === demoStore.warehouses[0].id)
        : demoStore.orders;
      return ok(withPagination('orders', orders, query));
    }
    if (/^\/warehouse\/orders\/[^/]+$/.test(path) && method === 'GET') {
      return ok(envelope('order', structuredClone(recordById(demoStore.orders, id) ?? demoStore.orders[0])));
    }
    if (/^\/warehouse\/orders\/[^/]+\/advance-status$/.test(path)) {
      const order = recordById(demoStore.orders, path.split('/')[3]);
      if (order) demoStore.advanceOrder(order);
      return ok(envelope('order', order));
    }
    if (/^\/warehouse\/orders\/[^/]+\/(items|delivery-seal)$/.test(path)) {
      const order = recordById(demoStore.orders, path.split('/')[3]);
      if (order && path.endsWith('/items')) {
        if (Array.isArray(body.items)) order.items = body.items;
        else Object.assign(order.items.find((item) => item.id === body.itemId) ?? {}, body);
      }
      if (order && path.endsWith('/delivery-seal')) Object.assign(order, body);
      return ok(envelope('order', order));
    }
    if ((path === '/warehouse/products' || path === '/admin/products') && method === 'GET') {
      const products = path.startsWith('/warehouse/')
        ? demoStore.products.filter((product) => product.warehouseId === demoStore.warehouses[0].id)
        : demoStore.products;
      return ok(withPagination('products', products, query));
    }
    if ((path === '/warehouse/products' || path === '/admin/products') && ['POST', 'PATCH'].includes(method)) {
      const product = { id: `demo-product-${Date.now()}`, isActive: true, isAvailable: true, stock: 12, imageUrl: '/images/demo-product.svg', ...body };
      demoStore.products.unshift(product);
      demoStore.emit('product.changed', { productId: product.id });
      return ok(envelope('product', product), 201);
    }
    if (path === '/admin/catalog') {
      return ok(withPagination('items', demoStore.products, query));
    }
    if (path === '/warehouse/products/search' || path === '/warehouse/catalog/search') {
      const result = withPagination(
        'products',
        demoStore.products.filter((product) => product.warehouseId === demoStore.warehouses[0].id),
        query
      );
      return ok({ ...result, items: result.products, priceRate: demoStore.exchangeRate.usdToSyp });
    }
    if (path === '/admin/products/count') return ok({ success: true, count: demoStore.products.length });
    if (path === '/admin/products/warehouses') return ok({ success: true, warehouses: demoStore.warehouses });
    if (path === '/warehouse/manufacturers' && query.get('inCatalog') === 'true') {
      const manufacturers = demoStore.manufacturers.map((maker) => ({
        manufacturerAr: maker.nameAr,
        manufacturerEn: maker.nameEn,
        productCount: demoStore.products.filter((product) => product.manufacturerId === maker.id).length,
      }));
      return ok({ success: true, manufacturers });
    }
    if (path === '/warehouse/manufacturers') {
      return ok({ success: true, manufacturers: demoStore.manufacturers.map((maker) => maker.nameAr) });
    }
    if (path === '/admin/catalog/manufacturers' || path === '/admin/manufacturers') {
      return ok(withPagination('manufacturers', demoStore.manufacturers, query));
    }
    if (path.startsWith('/warehouse/products/import') && method === 'POST' && path === '/warehouse/products/import') {
      return ok(makeImportResult(path, body), 201);
    }
    if (path === '/admin/catalog/import' && method === 'POST') return ok(makeImportResult(path, body), 201);
    if (path.endsWith('/template')) {
      return new Response(new Blob(['Demo import template'], { type: 'text/plain' }), { status: 200 });
    }
    if (path === '/warehouse/products/imports') return ok(withPagination('imports', demoStore.imports, query));
    if (/^\/warehouse\/products\/imports\/[^/]+\/rows\/[^/]+\/(resolve|request)$/.test(path)) {
      const rowId = path.split('/')[6];
      const row = recordById(demoStore.importRows, rowId);
      if (row) row.bucket = path.endsWith('/resolve') ? 'added' : 'review';
      return ok(envelope('row', row, { productId: 'demo-product-imported', requestId: 'demo-catalog-request' }));
    }
    if (/^\/warehouse\/products\/imports\/[^/]+\/rows/.test(path)) {
      return ok(withPagination('rows', demoStore.importRows.filter((row) =>
        !query.get('bucket') || row.bucket === query.get('bucket')
      ), query));
    }
    if (/^\/warehouse\/products\/imports\/[^/]+$/.test(path)) {
      return ok(envelope('import', recordById(demoStore.imports, id) ?? demoStore.imports[0]));
    }

    if (path.startsWith('/warehouse/offers') || path.startsWith('/admin/offers')) {
      const admin = path.startsWith('/admin');
      const sourceOffers = !admin
        ? demoStore.offers.filter((offer) => offer.warehouseId === demoStore.warehouses[0].id)
        : demoStore.offers;
      const offers = filtered(sourceOffers, query);
      if (path.includes('/approve') || path.includes('/reject')) {
        const offer = recordById(demoStore.offers, path.split('/')[3]);
        if (offer) offer.status = path.endsWith('/approve') ? 'approved' : 'rejected';
        demoStore.emit('offer.status.updated', { offerId: offer?.id, status: offer?.status });
        return ok(message());
      }
      if (method === 'PATCH') {
        const offer = recordById(demoStore.offers, path.split('/')[3]);
        if (offer) Object.assign(offer, body);
        demoStore.emit('offer.status.updated', { offerId: offer?.id });
        return ok(envelope('offer', offer));
      }
      if (method === 'POST') {
        const offer = { id: `demo-offer-${Date.now()}`, status: admin ? 'approved' : 'pending', version: 1, ...body };
        demoStore.offers.unshift(offer);
        demoStore.emit(admin ? 'offer.status.updated' : 'offer.pending', { offerId: offer.id });
        return ok(envelope('offer', offer), 201);
      }
      if (method === 'DELETE') {
        demoStore.offers = demoStore.offers.filter((offer) => offer.id !== id);
        demoStore.emit('offer.status.updated', { offerId: id });
        return ok(message());
      }
      const visibleOffers = admin && path === '/admin/offers'
        ? offers.filter((offer) => offer.status === 'pending')
        : offers;
      const response = withPagination('offers', visibleOffers, query);
      return ok({ ...response, reviewCount: demoStore.offers.filter((offer) => offer.status === 'pending').length });
    }
    if (path === '/warehouse/discounts' && method === 'GET') {
      return ok({ success: true, discounts: structuredClone(demoStore.manufacturerDiscounts) });
    }
    if (path === '/warehouse/discounts' && method === 'POST') {
      const discount = { id: `demo-discount-${Date.now()}`, createdAt: new Date().toISOString(), ...body };
      demoStore.manufacturerDiscounts.unshift(discount);
      return ok(envelope('discount', discount), 201);
    }
    if (/^\/warehouse\/discounts\/[^/]+$/.test(path) && method === 'PATCH') {
      const discount = recordById(demoStore.manufacturerDiscounts, id);
      if (discount) Object.assign(discount, body);
      return ok(envelope('discount', discount));
    }
    if (path.startsWith('/warehouse/discounts/') && method === 'DELETE') {
      demoStore.manufacturerDiscounts = demoStore.manufacturerDiscounts.filter((row) => row.id !== id);
      return ok(message('Discount removed.'));
    }
    if (path.includes('/discount-codes')) {
      const isAdmin = path.startsWith('/admin');
      const sourceCodes = !isAdmin
        ? demoStore.discountCodes.filter((code) => code.warehouseId === demoStore.warehouses[0].id)
        : demoStore.discountCodes;
      const byView = isAdmin && query.get('view') === 'review'
        ? sourceCodes.filter((code) => code.ownerRole === 'warehouse' && code.status === 'pending')
        : isAdmin && query.get('view') === 'admin'
          ? sourceCodes.filter((code) => code.ownerRole === 'admin')
          : sourceCodes;
      const codes = filtered(byView, query);
      if (/\/(approve|reject|stop)$/.test(path)) {
        const code = recordById(demoStore.discountCodes, path.split('/')[3]);
        if (code) {
          code.status = path.endsWith('/approve') ? 'approved' : path.endsWith('/reject') ? 'rejected' : 'stopped';
          code.displayStatus = code.status === 'approved' ? 'active' : code.status;
        }
        demoStore.emit('discountCode.status.updated', { discountCodeId: code?.id });
        return ok(envelope('discountCode', code));
      }
      if (method === 'PATCH') {
        const code = recordById(demoStore.discountCodes, path.split('/')[3]);
        if (code) Object.assign(code, body);
        return ok(envelope('discountCode', code));
      }
      if (method === 'POST') {
        const owner = isAdmin ? null : demoStore.warehouses[0];
        const code = {
          id: `demo-code-${Date.now()}`,
          code: `DEMO${Date.now() % 10000}`,
          status: isAdmin ? 'approved' : 'pending',
          displayStatus: isAdmin ? 'active' : 'pending',
          ownerRole: isAdmin ? 'admin' : 'warehouse',
          fundedBy: isAdmin ? 'platform' : 'warehouse',
          warehouseId: owner?.id,
          warehouse: owner,
          usedCount: 0,
          version: 1,
          ...body,
        };
        demoStore.discountCodes.unshift(code);
        demoStore.emit(isAdmin ? 'discountCode.status.updated' : 'discountCode.pending', { discountCodeId: code.id });
        return ok(envelope('discountCode', code), 201);
      }
      const response = withPagination('discountCodes', codes, query);
      return ok({ ...response, reviewCount: demoStore.discountCodes.filter((code) => code.status === 'pending').length });
    }

    if (path.includes('/advertisements') || path.includes('/banners')) {
      const isBanner = path.includes('/banners');
      const source = isBanner ? demoStore.banners : demoStore.advertisements;
      const data = path.startsWith('/warehouse/')
        ? source.filter((row) => row.warehouseId === demoStore.warehouses[0].id)
        : source;
      const listKey = isBanner ? 'banners' : 'advertisements';
      if (/\/(approve|reject|availability)$/.test(path)) {
        const row = recordById(data, path.split('/')[3]);
        if (row && path.endsWith('/approve')) row.status = 'approved';
        if (row && path.endsWith('/reject')) row.status = 'rejected';
        if (row && path.endsWith('/availability')) row.isAvailable = body.isAvailable;
        demoStore.emit(`${isBanner ? 'banner' : 'advertisement'}.status.updated`, { id: row?.id });
        return ok(message());
      }
      if (method === 'PATCH') {
        const row = recordById(data, path.split('/')[3]);
        if (row) Object.assign(row, body);
        return ok(envelope(isBanner ? 'banner' : 'advertisement', row));
      }
      if (method === 'POST') {
        const row = { id: `demo-${isBanner ? 'banner' : 'ad'}-${Date.now()}`, title: body.title ?? 'Demo promotion', status: path.startsWith('/admin') ? 'approved' : 'pending', imageUrl: '/images/demo-product.svg', ...body };
        data.unshift(row);
        return ok(envelope(isBanner ? 'banner' : 'advertisement', row), 201);
      }
      if (method === 'DELETE') {
        const index = data.findIndex((row) => row.id === id);
        if (index >= 0) data.splice(index, 1);
        return ok(message());
      }
      return ok(withPagination(listKey, data, query));
    }

    if (path.startsWith('/warehouse/returns')) {
      if (/\/(approve|reject)$/.test(path)) {
        const item = recordById(demoStore.returns, path.split('/')[3]);
        if (item && path.endsWith('/approve')) demoStore.approveReturn(item);
        else if (item) {
          item.status = 'rejected';
          demoStore.emit('return.status.updated', { returnId: item.id, status: item.status });
        }
        return ok(message());
      }
      if (path.endsWith('/credit-preview')) {
        return ok({ success: true, preview: { creditSyp: 12000, creditUsd: 1.2, alreadyResolved: false, breakdown: { commissionClawbackSyp: 600 } } });
      }
      if (method === 'POST') return ok(envelope('return', demoStore.addReturn(body)), 201);
      if (path.split('/').length > 3) return ok(envelope('return', structuredClone(recordById(demoStore.returns, id) ?? demoStore.returns[0])));
      return ok(withPagination('returns', demoStore.returns.filter((item) => item.order?.warehouseId === demoStore.warehouses[0].id), query));
    }
    if (path === '/warehouse/reviews' && method === 'POST') {
      const review = { id: `demo-review-${Date.now()}`, status: 'published', ...body };
      demoStore.reviews.unshift(review);
      demoStore.emit('review.created', { reviewId: review.id });
      return ok(envelope('review', review), 201);
    }
    if (path === '/warehouse/reviews') {
      const reviews = demoStore.reviews.filter((review) =>
        demoStore.orders.find((order) => order.id === review.orderId)?.warehouseId === demoStore.warehouses[0].id
      ).map((review) => ({
        ...review,
        orderNumber: demoStore.orders.find((order) => order.id === review.orderId)?.orderNumber,
        pharmacyNameAr: demoStore.pharmacies.find((pharmacy) => pharmacy.id === demoStore.orders.find((order) => order.id === review.orderId)?.pharmacyId)?.nameAr,
        pharmacyNameEn: demoStore.pharmacies.find((pharmacy) => pharmacy.id === demoStore.orders.find((order) => order.id === review.orderId)?.pharmacyId)?.nameEn,
        reviewerName: 'Demo Pharmacy Owner',
        reviewerType: 'pharmacy',
      }));
      const response = withPagination('reviews', reviews, query);
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const review of reviews) distribution[review.rating] = (distribution[review.rating] ?? 0) + 1;
      return ok({ ...response, averageRating: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0, totalCount: reviews.length, distribution });
    }
    if (path.startsWith('/admin/complaints') || path.startsWith('/warehouse/complaints')) {
      if (method === 'POST' || method === 'PATCH') {
        const complaint = recordById(demoStore.complaints, path.split('/')[3]);
        if (complaint) Object.assign(complaint, body, { status: body.status ?? complaint.status });
        demoStore.emit('complaint.updated', { complaintId: complaint?.id });
        return ok(envelope('complaint', complaint));
      }
      if (path.split('/').length > 3) return ok(envelope('complaint', structuredClone(recordById(demoStore.complaints, id) ?? demoStore.complaints[0])));
      const complaints = path.startsWith('/warehouse/')
        ? demoStore.complaints.filter((complaint) => complaint.warehouseId === demoStore.warehouses[0].id)
        : demoStore.complaints;
      const response = withPagination('complaints', complaints, query);
      return ok({
        ...response,
        counts: Object.fromEntries(['pending', 'in_review', 'resolved', 'closed'].map((status) => [
          status,
          complaints.filter((complaint) => complaint.status === status).length,
        ])),
      });
    }

    if (path === '/warehouse/balances') {
      const pharmacies = demoStore.calculateBalances().filter((row) =>
        row.entries.some((entry) => entry.warehouseId === demoStore.warehouses[0].id)
      ).map((row) => ({
        accountId: `account-${row.pharmacyId}`,
        pharmacyId: row.pharmacyId,
        nameAr: row.pharmacy?.nameAr,
        nameEn: row.pharmacy?.nameEn,
        phone: row.pharmacy?.phone,
        balanceSyp: row.balanceSyp,
        balanceUsd: row.balanceSyp / demoStore.exchangeRate.usdToSyp,
        outstandingDebtSyp: Math.max(0, row.balanceSyp),
        creditBalanceSyp: Math.max(0, -row.balanceSyp),
        lastActivityAt: new Date().toISOString(),
      }));
      return ok({ success: true, pharmacies, pagination: { hasMore: false, nextCursor: null } });
    }
    if (/^\/warehouse\/balances\/[^/]+$/.test(path)) {
      const balance = demoStore.calculateBalances().find((row) => row.pharmacyId === id) ?? demoStore.calculateBalances()[0];
      const rows = (balance?.entries ?? []).map((entry, index) => ({
        id: entry.id,
        entryNumber: index + 1,
        kind: entry.returnId ? 'return_credit' : entry.isReversal ? 'payment_reversal' : entry.type === 'debit' ? 'charge' : 'payment',
        effectiveAt: entry.createdAt,
        debitSyp: entry.type === 'debit' ? entry.amountSyp : 0,
        creditSyp: entry.type === 'credit' ? entry.amountSyp : 0,
        amountUsd: entry.amountSyp / demoStore.exchangeRate.usdToSyp,
        balanceSyp: balance.balanceSyp,
        balanceUsd: balance.balanceSyp / demoStore.exchangeRate.usdToSyp,
        reference: entry.orderId ?? entry.paymentId ?? null,
      }));
      return ok({
        success: true,
        statement: {
          period: { from: null, to: null },
          opening: { syp: 0, usd: 0 },
          closing: { syp: balance?.balanceSyp ?? 0, usd: (balance?.balanceSyp ?? 0) / demoStore.exchangeRate.usdToSyp },
          summary: {
            chargesSyp: rows.filter((row) => row.kind === 'charge').reduce((sum, row) => sum + row.debitSyp, 0),
            paymentsSyp: rows.filter((row) => row.kind === 'payment').reduce((sum, row) => sum + row.creditSyp, 0),
            returnCreditsSyp: rows.filter((row) => row.kind === 'return_credit').reduce((sum, row) => sum + row.creditSyp, 0),
          },
          outstandingDebtSyp: Math.max(0, balance?.balanceSyp ?? 0),
          creditBalanceSyp: Math.max(0, -(balance?.balanceSyp ?? 0)),
          rows,
          pharmacy: balance?.pharmacy,
        },
      });
    }
    if (path === '/warehouse/settlement') {
      const delivered = demoStore.orders.filter((order) =>
        order.status === 'delivered'
        && order.warehouseId === demoStore.warehouses[0].id
        && dateInRange(order.deliveredAt ?? order.createdAt, query.get('from'), query.get('to'))
      );
      const grossSalesSyp = delivered.reduce((sum, order) => sum + order.totalSyp, 0);
      const grossCommissionSyp = Math.round(grossSalesSyp * 0.05);
      const creditedSalesSyp = delivered.reduce((sum, order) => sum + approvedCreditsForOrder(order), 0);
      const commissionClawbackSyp = grossSalesSyp > 0 ? Math.round(grossCommissionSyp * creditedSalesSyp / grossSalesSyp) : 0;
      const netCommissionSyp = grossCommissionSyp - commissionClawbackSyp;
      return ok({ success: true, settlement: { period: { from: query.get('from'), to: query.get('to') }, totals: { grossSalesSyp, orderCount: delivered.length, creditedSalesSyp, grossCommissionSyp, netCommissionSyp, commissionClawbackSyp, warehouseNetSyp: grossSalesSyp - creditedSalesSyp - netCommissionSyp, grossCompensationSyp: 0, netCompensationSyp: 0 }, orders: delivered.map((order) => {
        const creditedSyp = approvedCreditsForOrder(order);
        const commissionSyp = Math.round(order.totalSyp * 0.05);
        const commissionClawbackSyp = order.totalSyp ? Math.round(commissionSyp * creditedSyp / order.totalSyp) : 0;
        return { orderId: order.id, orderNumber: order.orderNumber, salesSyp: order.totalSyp, commissionSyp: commissionSyp - commissionClawbackSyp, creditedSyp, warehouseNetSyp: order.totalSyp - creditedSyp - commissionSyp + commissionClawbackSyp };
      }) } });
    }
    if (path === '/warehouse/payments' && method === 'POST') return ok(envelope('payment', demoStore.createPayment(body)), 201);
    if (/^\/warehouse\/payments\/[^/]+\/reverse$/.test(path)) return ok(envelope('payment', demoStore.reversePayment(path.split('/')[3], body.reason)));
    if (path === '/warehouse/payments') return ok(withPagination(
      'payments',
      demoStore.payments.filter((payment) => payment.warehouseId === demoStore.warehouses[0].id),
      query
    ));
    if (path === '/warehouse/settings' && method === 'PATCH') {
      Object.assign(demoStore.settings, body);
      return ok(envelope('settings', demoStore.settings));
    }
    if (path === '/warehouse/settings') {
      return ok(envelope('settings', { ...demoStore.settings, minOrderAmountUsd: 10, maxOrderAmountUsd: 2000, requireDeliverySealPhoto: false }));
    }
    if (path === '/warehouse/balances' && method !== 'GET') {
      return ok({ success: true, accounts: demoStore.calculateBalances(), balances: demoStore.calculateBalances() });
    }
    if (path === '/admin/commission/overview') {
      const rows = demoStore.warehouses.map((warehouse) => {
        const orders = demoStore.orders.filter((order) => order.warehouseId === warehouse.id
          && order.status === 'delivered'
          && dateInRange(order.deliveredAt ?? order.createdAt, query.get('from'), query.get('to')));
        const salesSyp = orders.reduce((sum, order) => sum + order.totalSyp, 0);
        const returnsSyp = orders.reduce((sum, order) => sum + approvedCreditsForOrder(order), 0);
        const grossCommissionSyp = Math.round(salesSyp * warehouse.commissionRate / 100);
        const commissionSyp = grossCommissionSyp - (salesSyp ? Math.round(grossCommissionSyp * returnsSyp / salesSyp) : 0);
        return { warehouse: structuredClone(warehouse), warehouseId: warehouse.id, orderCount: orders.length, grossSalesSyp: salesSyp, returnsSyp, grossCommissionSyp: commissionSyp, outstandingSyp: commissionSyp };
      });
      return ok({ success: true, overview: { period: { from: query.get('from'), to: query.get('to') }, totals: { salesSyp: rows.reduce((sum, row) => sum + row.grossSalesSyp, 0), returnsSyp: rows.reduce((sum, row) => sum + row.returnsSyp, 0), commissionOwedSyp: rows.reduce((sum, row) => sum + row.grossCommissionSyp, 0), compensationOwedSyp: 0, alreadyCollectedSyp: 0, paidOutSyp: 0, outstandingSyp: rows.reduce((sum, row) => sum + row.grossCommissionSyp, 0) }, warehouses: rows.map((row) => ({ warehouseId: row.warehouseId, nameAr: row.warehouse.nameAr, nameEn: row.warehouse.nameEn, phone: row.warehouse.phone, isActive: true, orderCount: row.orderCount, salesSyp: row.grossSalesSyp, returnsSyp: row.returnsSyp, commissionOwedSyp: row.grossCommissionSyp, compensationOwedSyp: 0, alreadyCollectedSyp: 0, paidOutSyp: 0, outstandingSyp: row.grossCommissionSyp })) } });
    }
    if (path.startsWith('/admin/commission/warehouses/')) {
      const warehouse = demoStore.warehouses.find((row) => row.id === path.split('/')[4]) ?? demoStore.warehouses[0];
      const orders = demoStore.orders.filter((order) => order.warehouseId === warehouse.id
        && order.status === 'delivered'
        && dateInRange(order.deliveredAt ?? order.createdAt, query.get('from'), query.get('to')));
      const salesSyp = orders.reduce((sum, order) => sum + order.totalSyp, 0);
      const returnsSyp = orders.reduce((sum, order) => sum + approvedCreditsForOrder(order), 0);
      const grossCommissionSyp = Math.round(salesSyp * warehouse.commissionRate / 100);
      const commissionOwedSyp = grossCommissionSyp - (salesSyp ? Math.round(grossCommissionSyp * returnsSyp / salesSyp) : 0);
      return ok({
        success: true,
        detail: {
          period: { from: query.get('from'), to: query.get('to') },
          warehouse: { id: warehouse.id, nameAr: warehouse.nameAr, nameEn: warehouse.nameEn, phone: warehouse.phone },
          summary: { warehouseId: warehouse.id, nameAr: warehouse.nameAr, nameEn: warehouse.nameEn, isActive: true, orderCount: orders.length, salesSyp, returnsSyp, commissionOwedSyp, compensationOwedSyp: 0, alreadyCollectedSyp: 0, paidOutSyp: 0, outstandingSyp: commissionOwedSyp },
          orders: orders.map((order) => {
            const creditedSyp = approvedCreditsForOrder(order);
            const commissionSyp = Math.round(order.totalSyp * warehouse.commissionRate / 100);
            const commissionClawbackSyp = order.totalSyp ? Math.round(commissionSyp * creditedSyp / order.totalSyp) : 0;
            return { orderId: order.id, orderNumber: order.orderNumber, deliveredAt: order.deliveredAt ?? order.createdAt, salesSyp: order.totalSyp, creditedSyp, commissionSyp, commissionClawbackSyp, netCommissionSyp: commissionSyp - commissionClawbackSyp, discountCode: null, discountCodeSyp: 0, platformCompensationSyp: 0, compensationClawbackSyp: 0, netCompensationSyp: 0 };
          }),
          collections: [],
          pagination: { hasMore: false, nextCursor: null },
        },
      });
    }
    if (path === '/admin/commission/collections' && method === 'POST') return ok({ success: true, collection: { id: `collection-${Date.now()}`, ...body } }, 201);
    if (path.includes('/admin/commission/collections/') && path.endsWith('/reverse')) return ok(message('Collection reversed.'));

    if (/^\/admin\/ledger\/accounts\/[^/]+\/[^/]+\/statement$/.test(path)) {
      const pharmacyId = path.split('/')[4];
      const balance = demoStore.calculateBalances().find((row) => row.pharmacyId === pharmacyId) ?? demoStore.calculateBalances()[0];
      const statement = await mockFetch(`http://local/api/warehouse/balances/${balance?.pharmacyId ?? ''}`, { method: 'GET' });
      const data = await statement.json();
      return ok({ success: true, statement: { ...data.statement, warehouse: demoStore.warehouses[0], pharmacy: balance?.pharmacy } });
    }
    if (path === '/admin/accounts' || path === '/admin/pending-accounts') {
      const accounts = demoStore.allAccounts().filter((account) =>
        path !== '/admin/pending-accounts' || account.user.status === 'pending'
      );
      return ok(withPagination('accounts', accounts, query));
    }
    if (path === '/admin/warehouses' && method === 'POST') {
      const warehouse = { id: `demo-wh-${Date.now()}`, role: 'warehouse', status: 'active', ...body };
      demoStore.warehouses.push(warehouse);
      return ok(envelope('account', warehouse), 201);
    }
    if (/^\/admin\/accounts\/[^/]+\//.test(path)) {
      const [, , , accountId, action] = path.split('/');
      const account = [demoStore.admin, ...demoStore.warehouses, ...demoStore.pharmacies]
        .find((row) => row.id === accountId);
      if (account && action === 'approve') account.status = 'active';
      if (account && action === 'reject') account.status = 'rejected';
      if (account && action === 'block') account.status = 'blocked';
      if (account && action === 'unblock') account.status = 'active';
      demoStore.emit('account.status.updated', { accountId, status: account?.status });
      return ok(message());
    }
    if (path === '/admin/notifications' && method === 'POST') {
      demoStore.addNotification(body.titleEn ?? body.title ?? 'Demo update', body.bodyEn ?? body.body ?? 'A demo notification was sent.');
      return ok({ success: true, message: 'Notification sent.', recipientCount: demoStore.pharmacies.length });
    }

    if (path.startsWith('/admin/catalog/duplicates')) {
      if (method === 'POST') return ok(message());
      return ok({ success: true, groups: demoStore.duplicates, pagination: { hasMore: false, nextCursor: null } });
    }
    if (path.startsWith('/admin/catalog/requests') || path.startsWith('/warehouse/catalog/requests')) {
      if (method !== 'GET') {
        const req = recordById(demoStore.catalogRequests, path.split('/')[4]);
        if (req) req.status = path.endsWith('/reject') ? 'rejected' : 'approved';
        return ok(envelope('request', req));
      }
      return ok(withPagination('requests', demoStore.catalogRequests, query));
    }
    if (path.startsWith('/warehouse/catalog/suggestions')) return ok({ success: true, suggestions: [] });
    if (path.startsWith('/admin/catalog/') || path.startsWith('/warehouse/products/') || path.startsWith('/admin/products/')) {
      const product = recordById(demoStore.products, id);
      if (product && method === 'PATCH') Object.assign(product, body);
      if (product && method === 'DELETE') product.isActive = false;
      if (product && method !== 'GET') {
        demoStore.emit('product.changed', { productId: product.id });
        return ok(envelope('item', product));
      }
      if (path.endsWith('/image') || path.endsWith('/logo')) return ok(message('Image updated.'));
    }
    if (path.startsWith('/admin/manufacturers/') || path.startsWith('/admin/categories/')) {
      const collection = path.includes('categories') ? demoStore.categories : demoStore.manufacturers;
      const target = recordById(collection, path.split('/')[3]);
      if (target && method === 'PATCH') Object.assign(target, body);
      if (path.endsWith('/merge')) return ok({ success: true, message: 'Records merged.', moved: 1 });
      return ok(envelope(path.includes('categories') ? 'category' : 'manufacturer', target));
    }
    if (path === '/admin/notifications') return ok({ success: true, notifications: demoStore.notifications });

    console.debug(`[demo mock] Unhandled ${method} ${path}`);
    return ok({ success: true, items: [], products: [], orders: [], pagination: { hasMore: false, nextCursor: null } });
  } catch (error) {
    console.debug('[demo mock] Returning empty success after mock handler error:', error);
    return ok({ success: true, items: [], products: [], orders: [], pagination: { hasMore: false, nextCursor: null } });
  }
}
