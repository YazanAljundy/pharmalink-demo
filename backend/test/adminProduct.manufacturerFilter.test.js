// Covers the manufacturer Searchable Dropdown added to Admin Products and
// Admin Catalog: the new GET /admin/catalog/manufacturers type-ahead
// (productCatalog.service.searchManufacturers), and the `manufacturer`
// filter on both pages' list endpoints.
//
// Runs against its own database (pharmalink_demo-admin-manufacturer-test) and drops it
// at the end, same pattern as adminProduct.categoryFilter.test.js.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-admin-manufacturer-tests';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const { startMemoryMongo, stopMemoryMongo } = require('./helpers/mongo');

const User = require('../src/models/user.model');
const Warehouse = require('../src/models/warehouse.model');
const Product = require('../src/models/product.model');
const ProductCatalog = require('../src/models/productCatalog.model');

const adminProductService = require('../src/services/adminProduct.service');
const catalogService = require('../src/services/productCatalog.service');

const ids = {};

test.before(async () => {
  await startMemoryMongo({ dbName: 'pharmalink_demo-admin-manufacturer-test' });

  const warehouseUser = await User.create({
    name: 'WH', phone: '0950000001', role: 'warehouse', status: 'active',
  });
  const warehouse = await Warehouse.create({
    userId: warehouseUser._id, nameAr: 'م', nameEn: 'W',
    address: 'addr', city: 'Latakia', phone: '0950000001', isActive: true,
  });
  ids.warehouseId = warehouse._id;

  const [sampleMedicineAlpha, sampleMedicineBeta, sampleMedicineGamma] = await ProductCatalog.create([
    { nameAr: 'دواء تجريبي ألف', nameEn: 'Sample Medicine Alpha', manufacturerAr: 'مختبر تجريبي ألف', manufacturerEn: 'Sample Pharma Labs A' },
    { nameAr: 'دواء تجريبي باء', nameEn: 'Sample Medicine Beta', manufacturerAr: 'مختبر تجريبي ألف', manufacturerEn: 'Sample Pharma Labs A' },
    { nameAr: 'دواء تجريبي جيم', nameEn: 'Sample Medicine Gamma', manufacturerAr: 'مختبر تجريبي باء', manufacturerEn: 'Sample Pharma Labs B' },
  ]);
  ids.sampleMedicineAlpha = sampleMedicineAlpha._id;
  ids.sampleMedicineBeta = sampleMedicineBeta._id;
  ids.sampleMedicineGamma = sampleMedicineGamma._id;

  await Product.create([
    // Two catalog-linked products from one demo manufacturer.
    { warehouseId: warehouse._id, masterProductId: sampleMedicineAlpha._id, price: 5 },
    { warehouseId: warehouse._id, masterProductId: sampleMedicineBeta._id, price: 6 },
    // One catalog-linked product from another demo manufacturer.
    { warehouseId: warehouse._id, masterProductId: sampleMedicineGamma._id, price: 7 },
    // A legacy product (no catalog link) whose OWN manufacturer field is set -
    // the two-step match (manufacturerMatchClauses) must catch this too.
    {
      warehouseId: warehouse._id, masterProductId: null, price: 8,
      nameAr: 'دواء تجريبي قديم', nameEn: 'Legacy Sample Product',
      manufacturerAr: 'مختبر تجريبي ألف', manufacturerEn: 'Sample Pharma Labs A',
    },
  ]);
});

test.after(async () => {
  await stopMemoryMongo();
});

// ---------------------------------------------------------------------------
// GET /admin/catalog/manufacturers (searchManufacturers)
// ---------------------------------------------------------------------------

test('searchManufacturers with no term returns every distinct manufacturer, sorted', async () => {
  const names = await catalogService.searchManufacturers();
  assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.ok(names.includes('مختبر تجريبي ألف'));
  assert.ok(names.includes('مختبر تجريبي باء'));
  assert.strictEqual(new Set(names).size, names.length, 'must be distinct');
});

test('searchManufacturers matches on the Arabic name', async () => {
  const names = await catalogService.searchManufacturers('مختبر تجريبي ألف');
  assert.deepStrictEqual(names, ['مختبر تجريبي ألف']);
});

test('searchManufacturers matches on the English name too', async () => {
  const names = await catalogService.searchManufacturers('Sample Pharma Labs B');
  assert.deepStrictEqual(names, ['مختبر تجريبي باء']);
});

test('searchManufacturers with no matches returns an empty array, not an error', async () => {
  const names = await catalogService.searchManufacturers('zzzz-no-such-manufacturer');
  assert.deepStrictEqual(names, []);
});

// ---------------------------------------------------------------------------
// The `manufacturer` filter on Admin Products / Admin Catalog
// ---------------------------------------------------------------------------

test('adminProduct.service: manufacturer filter matches catalog-linked AND legacy products', async () => {
  const { rows } = await adminProductService.listPaginatedAllProducts({
    manufacturer: 'مختبر تجريبي ألف',
    limit: 50,
  });
  assert.strictEqual(rows.length, 3);
  const names = rows.map((r) => r.product.nameEn).sort();
  assert.deepStrictEqual(names, ['Legacy Sample Product', 'Sample Medicine Alpha', 'Sample Medicine Beta']);
});

test('adminProduct.service: manufacturer filter excludes a different manufacturer', async () => {
  const { rows } = await adminProductService.listPaginatedAllProducts({
    manufacturer: 'مختبر تجريبي باء',
    limit: 50,
  });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].product.nameEn, 'Sample Medicine Gamma');
});

test('adminProduct.service: manufacturer AND search combine (both must match)', async () => {
  // A medicine name alone matches one product; add a different manufacturer's
  // filter -> no rows.
  const noMatch = await adminProductService.listPaginatedAllProducts({
    search: 'Sample Medicine Alpha',
    manufacturer: 'مختبر تجريبي باء',
    limit: 50,
  });
  assert.deepStrictEqual(noMatch.rows, []);

  const match = await adminProductService.listPaginatedAllProducts({
    search: 'Sample Medicine Alpha',
    manufacturer: 'مختبر تجريبي ألف',
    limit: 50,
  });
  assert.strictEqual(match.rows.length, 1);
  assert.strictEqual(match.rows[0].product.nameEn, 'Sample Medicine Alpha');
});

test('productCatalog.service: manufacturer filter is an exact match on the catalog', async () => {
  const { items } = await catalogService.listCatalog({ manufacturer: 'مختبر تجريبي ألف', limit: 50 });
  assert.strictEqual(items.length, 2);
  const ids2 = items.map((i) => String(i._id)).sort();
  assert.deepStrictEqual(ids2, [String(ids.sampleMedicineAlpha), String(ids.sampleMedicineBeta)].sort());
});
