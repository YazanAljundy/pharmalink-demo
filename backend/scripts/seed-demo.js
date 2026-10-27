#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const { supportsTransactions } = require('../src/utils/transaction');
const { normalizeText } = require('../src/utils/normalizeText');
const { unitNameAr, unitNameEn } = require('../src/config/units');

const User = require('../src/models/user.model');
const Warehouse = require('../src/models/warehouse.model');
const Pharmacy = require('../src/models/pharmacy.model');
const Category = require('../src/models/category.model');
const Manufacturer = require('../src/models/manufacturer.model');
const ProductCatalog = require('../src/models/productCatalog.model');
const Product = require('../src/models/product.model');
const Offer = require('../src/models/offer.model');
const DiscountCode = require('../src/models/discountCode.model');
const Banner = require('../src/models/banner.model');
const Advertisement = require('../src/models/advertisement.model');
const Order = require('../src/models/order.model');
const OrderItem = require('../src/models/orderItem.model');
const Return = require('../src/models/return.model');
const Complaint = require('../src/models/complaint.model');
const Review = require('../src/models/review.model');
const Payment = require('../src/models/payment.model');

const orderService = require('../src/services/order.service');
const warehouseOrderService = require('../src/services/warehouseOrder.service');
const returnService = require('../src/services/return.service');
const paymentService = require('../src/services/payment.service');
const exchangeRateService = require('../src/services/exchangeRate.service');
const warehouseOfferService = require('../src/services/warehouseOffer.service');
const adminOfferService = require('../src/services/adminOffer.service');
const adminBannerService = require('../src/services/adminBanner.service');
const warehouseAdvertisementService = require('../src/services/warehouseAdvertisement.service');
const adminAdvertisementService = require('../src/services/adminAdvertisement.service');
const complaintService = require('../src/services/complaint.service');
const reviewService = require('../src/services/review.service');

const DEMO_DATABASE = 'pharmalink_demo';
const DEMO_PASSWORD = 'Demo@12345';
const USD_TO_SYP = 13000;
const PASSWORD_HASH_ROUNDS = 10;

const CATEGORIES = [
  { nameAr: 'مسكنات الألم', nameEn: 'Pain Relief' },
  { nameAr: 'مضادات الجراثيم', nameEn: 'Antibacterial' },
  { nameAr: 'صحة القلب والأوعية', nameEn: 'Cardiovascular Health' },
  { nameAr: 'صحة الجهاز الهضمي', nameEn: 'Digestive Health' },
  { nameAr: 'صحة الجهاز التنفسي', nameEn: 'Respiratory Health' },
  { nameAr: 'الفيتامينات والمعادن', nameEn: 'Vitamins and Minerals' },
  { nameAr: 'العناية الجلدية', nameEn: 'Dermatology' },
  { nameAr: 'العناية بالعين والأنف والأذن', nameEn: 'Eye, Nose and Ear Care' },
];

const MANUFACTURERS = [
  { nameAr: 'الشركة التجريبية ألف', nameEn: 'Sample Pharma Labs A' },
  { nameAr: 'الشركة التجريبية باء', nameEn: 'Sample Pharma Labs B' },
  { nameAr: 'الشركة التجريبية جيم', nameEn: 'Sample Pharma Labs C' },
  { nameAr: 'الشركة التجريبية دال', nameEn: 'Sample Pharma Labs D' },
  { nameAr: 'الشركة التجريبية هاء', nameEn: 'Sample Pharma Labs E' },
  { nameAr: 'الشركة التجريبية واو', nameEn: 'Sample Pharma Labs F' },
];

const CATALOG = [
  ['باراسيتامول 500 ملغ', 'Paracetamol 500 mg', 0, 0, 1.2, 'box'],
  ['باراسيتامول 1 غرام', 'Paracetamol 1 g', 0, 1, 1.8, 'box'],
  ['إيبوبروفين 200 ملغ', 'Ibuprofen 200 mg', 0, 2, 1.5, 'box'],
  ['إيبوبروفين 400 ملغ', 'Ibuprofen 400 mg', 0, 3, 2.1, 'box'],
  ['نابروكسين 250 ملغ', 'Naproxen 250 mg', 0, 4, 2.8, 'box'],
  ['أسبرين 81 ملغ', 'Acetylsalicylic acid 81 mg', 0, 5, 1.1, 'box'],
  ['ديكلوفيناك 50 ملغ', 'Diclofenac 50 mg', 0, 0, 2.4, 'box'],
  ['أموكسيسيلين 500 ملغ', 'Amoxicillin 500 mg', 1, 1, 3.8, 'box'],
  ['أزيثروميسين 250 ملغ', 'Azithromycin 250 mg', 1, 2, 4.5, 'box'],
  ['سيفاليكسين 500 ملغ', 'Cephalexin 500 mg', 1, 3, 4.2, 'box'],
  ['دوكسيسيكلين 100 ملغ', 'Doxycycline 100 mg', 1, 4, 3.6, 'box'],
  ['ميترونيدازول 500 ملغ', 'Metronidazole 500 mg', 1, 5, 2.7, 'box'],
  ['سيفوروكسيم 250 ملغ', 'Cefuroxime 250 mg', 1, 0, 5.1, 'box'],
  ['أملوديبين 5 ملغ', 'Amlodipine 5 mg', 2, 1, 2.2, 'box'],
  ['لوسارتان 50 ملغ', 'Losartan 50 mg', 2, 2, 3.1, 'box'],
  ['ميتفورمين 500 ملغ', 'Metformin 500 mg', 2, 3, 2.4, 'box'],
  ['أتورفاستاتين 10 ملغ', 'Atorvastatin 10 mg', 2, 4, 3.4, 'box'],
  ['أوميبرازول 20 ملغ', 'Omeprazole 20 mg', 3, 5, 2.3, 'box'],
  ['فاموتيدين 20 ملغ', 'Famotidine 20 mg', 3, 0, 1.9, 'box'],
  ['لوبيراميد 2 ملغ', 'Loperamide 2 mg', 3, 1, 1.4, 'box'],
  ['محلول الإماهة الفموية', 'Oral Rehydration Salts', 3, 2, 0.9, 'sachet'],
  ['سالبوتامول بخاخ', 'Salbutamol Inhaler', 4, 3, 5.8, 'spray'],
  ['مونتيلوكاست 10 ملغ', 'Montelukast 10 mg', 4, 4, 4.1, 'box'],
  ['سيتريزين 10 ملغ', 'Cetirizine 10 mg', 4, 5, 1.7, 'box'],
  ['شراب ديكستروميثورفان', 'Dextromethorphan Syrup', 4, 0, 2.6, 'bottle'],
  ['فيتامين ج 500 ملغ', 'Vitamin C 500 mg', 5, 1, 1.6, 'box'],
  ['فيتامين د3 1000 وحدة', 'Vitamin D3 1000 IU', 5, 2, 2.2, 'box'],
  ['حديد 65 ملغ', 'Iron 65 mg', 5, 3, 2.9, 'box'],
  ['حمض الفوليك 1 ملغ', 'Folic Acid 1 mg', 5, 4, 1.3, 'box'],
  ['كربونات الكالسيوم 500 ملغ', 'Calcium Carbonate 500 mg', 5, 5, 2.1, 'box'],
  ['زنك 20 ملغ', 'Zinc 20 mg', 5, 0, 1.8, 'box'],
  ['كريم هيدروكورتيزون 1٪', 'Hydrocortisone Cream 1%', 6, 1, 2.5, 'tube'],
  ['كريم كلوتريمازول 1٪', 'Clotrimazole Cream 1%', 6, 2, 2.3, 'tube'],
  ['محلول مطهر موضعي', 'Topical Antiseptic Solution', 6, 3, 1.9, 'bottle'],
  ['لوشن مرطب للبشرة', 'Moisturizing Skin Lotion', 6, 4, 3.7, 'bottle'],
  ['قطرات دموع اصطناعية', 'Artificial Tears', 7, 5, 2.8, 'bottle'],
  ['قطرات أوفلوكساسين للعين', 'Ofloxacin Eye Drops', 7, 0, 3.1, 'bottle'],
  ['قطرات جلسرين للأذن', 'Glycerin Ear Drops', 7, 1, 2.0, 'bottle'],
  ['بخاخ محلول ملحي للأنف', 'Saline Nasal Spray', 7, 2, 2.4, 'spray'],
  ['مرهم أكسيد الزنك 10٪', 'Zinc Oxide Ointment 10%', 6, 3, 2.2, 'tube'],
];

const ACCOUNTS = {
  admin: { name: 'Demo Administrator', phone: '0900000001', role: 'admin' },
  warehouses: [
    {
      name: 'Demo Warehouse Manager One',
      phone: '0900000002',
      nameAr: 'مستودع تجريبي ١',
      nameEn: 'Demo Warehouse One',
      address: 'Demo Street 1',
      city: 'Latakia',
    },
    {
      name: 'Demo Warehouse Manager Two',
      phone: '0900000003',
      nameAr: 'مستودع تجريبي ٢',
      nameEn: 'Demo Warehouse Two',
      address: 'Demo Street 2',
      city: 'Homs',
    },
  ],
  pharmacies: [
    {
      name: 'Demo Pharmacist One',
      phone: '0900000004',
      nameAr: 'صيدلية تجريبية ١',
      nameEn: 'Demo Pharmacy One',
      ownerName: 'Demo Owner One',
      address: 'Demo Avenue 1',
      city: 'Latakia',
    },
    {
      name: 'Demo Pharmacist Two',
      phone: '0900000005',
      nameAr: 'صيدلية تجريبية ٢',
      nameEn: 'Demo Pharmacy Two',
      ownerName: 'Demo Owner Two',
      address: 'Demo Avenue 2',
      city: 'Homs',
    },
    {
      name: 'Demo Pharmacist Three',
      phone: '0900000006',
      nameAr: 'صيدلية تجريبية ٣',
      nameEn: 'Demo Pharmacy Three',
      ownerName: 'Demo Owner Three',
      address: 'Demo Avenue 3',
      city: 'Latakia',
    },
  ],
};

const ORDER_PLANS = [
  { pharmacy: 0, warehouse: 0, status: 'pending', product: 0, quantity: 2 },
  { pharmacy: 0, warehouse: 0, status: 'confirmed', product: 1, quantity: 1 },
  { pharmacy: 1, warehouse: 0, status: 'preparing', product: 2, quantity: 3 },
  { pharmacy: 2, warehouse: 0, status: 'delivered', product: 3, quantity: 2 },
  { pharmacy: 0, warehouse: 1, status: 'delivered', product: 4, quantity: 1 },
  { pharmacy: 1, warehouse: 1, status: 'out_for_delivery', product: 5, quantity: 2 },
  { pharmacy: 2, warehouse: 1, status: 'cancelled', product: 6, quantity: 1 },
  { pharmacy: 1, warehouse: 0, status: 'confirmed', product: 7, quantity: 2 },
  { pharmacy: 2, warehouse: 0, status: 'pending', product: 8, quantity: 1 },
  { pharmacy: 1, warehouse: 1, status: 'preparing', product: 9, quantity: 3 },
  { pharmacy: 2, warehouse: 1, status: 'out_for_delivery', product: 10, quantity: 1 },
  { pharmacy: 0, warehouse: 1, status: 'delivered', product: 11, quantity: 2 },
];

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function upsertUser(data, passwordHash) {
  let user = await User.findOne({ phone: data.phone }).select('+password');
  if (!user) user = new User({ phone: data.phone });
  user.name = data.name;
  user.role = data.role;
  user.status = 'active';
  user.lang = 'en';
  user.password = passwordHash;
  await user.save();
  return user;
}

async function upsertWarehouse(user, data) {
  let warehouse = await Warehouse.findOne({ userId: user._id });
  if (!warehouse) warehouse = new Warehouse({ userId: user._id });
  Object.assign(warehouse, {
    nameAr: data.nameAr,
    nameEn: data.nameEn,
    address: data.address,
    city: data.city,
    phone: data.phone,
    isActive: true,
  });
  await warehouse.save();
  return warehouse;
}

async function upsertPharmacy(user, data) {
  let pharmacy = await Pharmacy.findOne({ userId: user._id });
  if (!pharmacy) pharmacy = new Pharmacy({ userId: user._id });
  Object.assign(pharmacy, {
    nameAr: data.nameAr,
    nameEn: data.nameEn,
    ownerName: data.ownerName,
    address: data.address,
    city: data.city,
    areaType: 'city',
    phone: data.phone,
    addedBy: 'admin',
    isActive: true,
  });
  await pharmacy.save();
  return pharmacy;
}

async function upsertCategory(data) {
  let category = await Category.findOne({ key: normalizeText(data.nameAr) });
  if (!category) category = new Category();
  category.nameAr = data.nameAr;
  category.nameEn = data.nameEn;
  category.icon = null;
  await category.save();
  return category;
}

async function upsertManufacturer(data) {
  let manufacturer = await Manufacturer.findOne({ key: normalizeText(data.nameAr) });
  if (!manufacturer) manufacturer = new Manufacturer();
  manufacturer.nameAr = data.nameAr;
  manufacturer.nameEn = data.nameEn;
  manufacturer.isActive = true;
  await manufacturer.save();
  return manufacturer;
}

async function upsertCatalogItem(row, categories, manufacturers) {
  const [nameAr, nameEn, categoryIndex, manufacturerIndex, priceUsd, unit] = row;
  const manufacturer = manufacturers[manufacturerIndex];
  let catalogItem = await ProductCatalog.findOne({
    nameAr,
    manufacturerId: manufacturer._id,
  });
  if (!catalogItem) catalogItem = new ProductCatalog();
  Object.assign(catalogItem, {
    nameAr,
    nameEn,
    manufacturerAr: manufacturer.nameAr,
    manufacturerEn: manufacturer.nameEn,
    manufacturerId: manufacturer._id,
    categoryId: categories[categoryIndex]._id,
    unitAr: unitNameAr(unit),
    unitEn: unitNameEn(unit),
    isActive: true,
    imageUrl: null,
  });
  await catalogItem.save();
  return { catalogItem, priceUsd, unit };
}

async function upsertWarehouseProduct(warehouse, catalogRow, index, warehouseIndex) {
  const { catalogItem, priceUsd, unit } = catalogRow;
  let product = await Product.findOne({
    warehouseId: warehouse._id,
    masterProductId: catalogItem._id,
  });
  if (!product) product = new Product();
  const available = (index + warehouseIndex) % 8 !== 0;
  Object.assign(product, {
    warehouseId: warehouse._id,
    masterProductId: catalogItem._id,
    categoryId: catalogItem.categoryId,
    price: Number((priceUsd * (warehouse.nameEn.endsWith('Two') ? 1.06 : 1)).toFixed(2)),
    unit,
    unitAr: unitNameAr(unit),
    unitEn: unitNameEn(unit),
    isAvailable: available,
    manuallyDisabled: !available,
    image: null,
    isActive: true,
  });
  await product.save();
  return product;
}

async function ensureOffers(warehouses, warehouseProducts, admin) {
  const plans = [
    { warehouse: 0, product: 1, percentage: 12, titleAr: 'عرض تجريبي للألم', titleEn: 'Demo pain relief offer' },
    { warehouse: 0, product: 3, percentage: 8, titleAr: 'عرض تجريبي موسمي', titleEn: 'Demo seasonal offer' },
    { warehouse: 1, product: 5, percentage: 15, titleAr: 'خصم تجريبي للرعاية', titleEn: 'Demo care offer' },
  ];
  for (const [index, plan] of plans.entries()) {
    const product = warehouseProducts[plan.warehouse].filter((row) => row.isAvailable)[plan.product];
    const warehouse = warehouses[plan.warehouse];
    let offer = await Offer.findOne({
      warehouseId: warehouse._id,
      productId: product._id,
      status: { $in: ['pending', 'approved'] },
    });
    if (!offer) {
      const created = await warehouseOfferService.createOffer(warehouse._id, {
        productId: product._id.toString(),
        titleAr: plan.titleAr,
        titleEn: plan.titleEn,
        discountPercentage: plan.percentage,
        startDate: daysFromNow(-1),
        endDate: daysFromNow(45),
      });
      offer = created.offer;
    }
    if (offer.status === 'pending') {
      offer = await adminOfferService.approveOffer(offer._id, admin._id);
    }
    console.log(`Offer ${index + 1}: ${offer.titleEn} (${offer.status}).`);
  }
}

async function ensureDiscountCodes(admin, warehouses) {
  const now = new Date();
  const definitions = [
    {
      code: 'DEMO10',
      ownerRole: 'admin',
      warehouseId: null,
      createdBy: admin._id,
      approvedBy: admin._id,
      type: 'percentage',
      value: 10,
    },
    {
      code: 'WH5DEMO',
      ownerRole: 'warehouse',
      warehouseId: warehouses[0]._id,
      createdBy: warehouses[0].userId,
      approvedBy: admin._id,
      type: 'percentage',
      value: 5,
    },
  ];
  for (const definition of definitions) {
    let code = await DiscountCode.findOne({ code: definition.code });
    if (!code) code = new DiscountCode({ code: definition.code });
    Object.assign(code, {
      ...definition,
      pharmacyId: null,
      startDate: daysFromNow(-1),
      endDate: daysFromNow(90),
      maxUses: 100,
      maxUsesPerPharmacy: 3,
      status: 'approved',
      revision: code.revision || 1,
      pendingUpdate: null,
      approvedAt: code.approvedAt || now,
    });
    await code.save();
  }
}

async function ensureBanners(admin, warehouseProducts) {
  const plans = [
    { title: 'Seasonal wellness | عناية موسمية', product: warehouseProducts[0][0] },
    { title: 'Everyday essentials | أساسيات يومية', product: warehouseProducts[1][1] },
  ];
  for (const plan of plans) {
    const dates = { startDate: daysFromNow(-1), endDate: daysFromNow(60) };
    const existing = await Banner.findOne({ title: plan.title });
    if (existing) {
      await adminBannerService.updateBanner(existing._id, {
        ...dates,
        title: plan.title,
        imageUrl: existing.imageUrl,
        mediaType: existing.mediaType,
      });
    } else {
      await adminBannerService.createAdminBanner(admin._id, {
        ...dates,
        productId: plan.product._id.toString(),
        title: plan.title,
        imageUrl: null,
        mediaType: 'image',
      });
    }
  }
}

async function ensureAdvertisements(warehouses, warehouseProducts, admin) {
  for (let index = 0; index < warehouses.length; index += 1) {
    const warehouse = warehouses[index];
    const products = warehouseProducts[index].filter((product) => product.isAvailable).slice(2, 4);
    const titleEn = `Demo value bundle ${index + 1}`;
    let advertisement = await Advertisement.findOne({ warehouseId: warehouse._id, titleEn });
    if (!advertisement) {
      const subtotal = products.reduce((sum, product) => sum + product.price, 0);
      await warehouseAdvertisementService.createAdvertisement(warehouse._id, {
        titleAr: `حزمة تجريبية ${index + 1}`,
        titleEn,
        items: products.map((product) => ({ productId: product._id.toString(), quantity: 1 })),
        totalPriceUsd: Number((subtotal * 0.9).toFixed(2)),
        startDate: daysFromNow(-1),
        endDate: daysFromNow(60),
        imageUrl: null,
      });
      advertisement = await Advertisement.findOne({ warehouseId: warehouse._id, titleEn });
    }
    if (advertisement.status === 'pending') {
      await adminAdvertisementService.approveAdvertisement(advertisement._id, admin._id);
    }
  }
}

function targetStatusRank(status) {
  return ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'].indexOf(status);
}

async function ensureOrders(pharmacies, warehouses, warehouseProducts) {
  const orders = [];
  for (const [index, plan] of ORDER_PLANS.entries()) {
    const pharmacy = pharmacies[plan.pharmacy];
    const warehouse = warehouses[plan.warehouse];
    const product = warehouseProducts[plan.warehouse].filter((row) => row.isAvailable)[plan.product];
    let order = await orderService.createOrder({
      userId: pharmacy.userId.toString(),
      pharmacyId: pharmacy._id.toString(),
      warehouseId: warehouse._id.toString(),
      items: [{ productId: product._id.toString(), quantity: plan.quantity }],
      notes: `Demo order ${index + 1}`,
      idempotencyKey: `pharmalink-demo-order-${String(index + 1).padStart(2, '0')}`,
    });

    if (plan.status === 'cancelled') {
      if (order.status !== 'cancelled') {
        const result = await orderService.cancelOrder(order._id, pharmacy._id, pharmacy.userId);
        order = result.order;
      }
    } else {
      const targetRank = targetStatusRank(plan.status);
      while (targetStatusRank(order.status) < targetRank) {
        order = await warehouseOrderService.advanceOrderStatus(
          order._id,
          warehouse._id,
          warehouse.userId
        );
      }
    }
    orders.push(order);
  }
  return orders;
}

async function ensureReturns(orders, pharmacies) {
  for (const index of [3, 4]) {
    const order = orders[index];
    if (await Return.exists({ orderId: order._id })) continue;
    const [item] = await OrderItem.find({ orderId: order._id }).sort({ _id: 1 }).limit(1);
    await returnService.createReturn({
      pharmacyId: pharmacies[ORDER_PLANS[index].pharmacy]._id.toString(),
      orderId: order._id.toString(),
      items: [{ orderItemId: item._id.toString(), quantity: 1, reasonType: 'damaged' }],
      notes: 'Demo return request for a damaged package.',
      images: [],
    });
  }
}

async function ensureReviews(orders, pharmacies) {
  for (const [index, orderIndex] of [3, 4].entries()) {
    const order = orders[orderIndex];
    if (await Review.exists({ orderId: order._id, reviewerType: 'pharmacy' })) continue;
    const pharmacy = pharmacies[ORDER_PLANS[orderIndex].pharmacy];
    await reviewService.createWarehouseReview(pharmacy._id, pharmacy.userId, {
      orderId: order._id.toString(),
      rating: index === 0 ? 5 : 4,
      comment: index === 0 ? 'Demo review: smooth delivery.' : 'Demo review: helpful service.',
    });
  }
}

async function ensureComplaint(orders, pharmacies) {
  const subject = 'Demo request: delivery coordination';
  if (await Complaint.exists({ subject })) return;
  const order = orders[5];
  const pharmacy = pharmacies[ORDER_PLANS[5].pharmacy];
  await complaintService.createComplaint({
    pharmacyId: pharmacy._id.toString(),
    pharmacyUserId: pharmacy.userId.toString(),
    relatedOrderId: order._id.toString(),
    subject,
    description: 'Demo complaint linked to an order for the admin support queue.',
    extraDetails: 'Seeded presentation data.',
  });
}

async function ensurePayments(pharmacies, warehouses) {
  const pharmacy = pharmacies[0];
  const warehouse = warehouses[1];
  let original = await Payment.findOne({ idempotencyKey: 'pharmalink-demo-payment-reversed' });
  if (!original) {
    original = await paymentService.createPayment(warehouse._id, warehouse.userId, {
      pharmacyId: pharmacy._id.toString(),
      amount: 5000,
      currency: 'SYP',
      method: 'cash',
      paidAt: new Date(),
      reference: 'DEMO-REVERSED',
      note: 'Demo payment recorded in error for reversal walkthrough.',
      idempotencyKey: 'pharmalink-demo-payment-reversed',
    });
  }
  await paymentService.reversePayment(original._id, warehouse._id, warehouse.userId, {
    reason: 'Demo reversal walkthrough.',
    idempotencyKey: 'pharmalink-demo-payment-reversal',
  });

  const existing = await Payment.findOne({ idempotencyKey: 'pharmalink-demo-payment-posted' });
  if (!existing) {
    await paymentService.createPayment(warehouse._id, warehouse.userId, {
      pharmacyId: pharmacy._id.toString(),
      amount: 7500,
      currency: 'SYP',
      method: 'bank_transfer',
      paidAt: new Date(),
      reference: 'DEMO-TRANSFER',
      note: 'Demo posted payment.',
      idempotencyKey: 'pharmalink-demo-payment-posted',
    });
  }
}

async function seedDemo() {
  const dbName = mongoose.connection.name;
  if (dbName !== DEMO_DATABASE) {
    throw new Error(
      `Refusing to seed database "${dbName}". Configure MONGODB_URI to use "${DEMO_DATABASE}".`
    );
  }

  const reset = process.argv.includes('--reset');
  if (reset) {
    await mongoose.connection.dropDatabase();
    console.log(`Dropped demo database "${DEMO_DATABASE}".`);
  }

  if (!(await supportsTransactions())) {
    throw new Error(
      'MongoDB transactions are required. Start backend/scripts/start-dev-replset.js or use a replica-set Atlas cluster.'
    );
  }

  await Promise.all(
    mongoose.modelNames().map((name) => mongoose.model(name).createIndexes())
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, PASSWORD_HASH_ROUNDS);
  const admin = await upsertUser(ACCOUNTS.admin, passwordHash);
  const warehouses = [];
  for (const definition of ACCOUNTS.warehouses) {
    const user = await upsertUser({ ...definition, role: 'warehouse' }, passwordHash);
    const warehouse = await upsertWarehouse(user, definition);
    warehouse.userId = user._id;
    warehouses.push(warehouse);
  }

  const pharmacies = [];
  for (const definition of ACCOUNTS.pharmacies) {
    const user = await upsertUser({ ...definition, role: 'pharmacy' }, passwordHash);
    const pharmacy = await upsertPharmacy(user, definition);
    pharmacy.userId = user._id;
    pharmacies.push(pharmacy);
  }

  const categories = [];
  for (const definition of CATEGORIES) categories.push(await upsertCategory(definition));
  const manufacturers = [];
  for (const definition of MANUFACTURERS) manufacturers.push(await upsertManufacturer(definition));

  const catalogRows = [];
  for (const row of CATALOG) {
    catalogRows.push(await upsertCatalogItem(row, categories, manufacturers));
  }

  const warehouseProducts = [];
  for (const [warehouseIndex, warehouse] of warehouses.entries()) {
    const products = [];
    for (const [index, catalogRow] of catalogRows.entries()) {
      products.push(await upsertWarehouseProduct(warehouse, catalogRow, index, warehouseIndex));
    }
    warehouseProducts.push(products);
  }

  const currentRate = await exchangeRateService.getRate();
  if (!currentRate || currentRate.usdToSyp !== USD_TO_SYP) {
    await exchangeRateService.setManualRate(USD_TO_SYP, admin._id);
  }

  await ensureOffers(warehouses, warehouseProducts, admin);
  await ensureDiscountCodes(admin, warehouses);
  await ensureBanners(admin, warehouseProducts);
  await ensureAdvertisements(warehouses, warehouseProducts, admin);

  const orders = await ensureOrders(pharmacies, warehouses, warehouseProducts);
  await ensureReturns(orders, pharmacies);
  await ensureReviews(orders, pharmacies);
  await ensureComplaint(orders, pharmacies);
  await ensurePayments(pharmacies, warehouses);

  console.log(
    `Seeded ${CATEGORIES.length} categories, ${MANUFACTURERS.length} manufacturers, ` +
      `${CATALOG.length} catalog medicines across ${warehouses.length} warehouses, and ${orders.length} orders.`
  );
  console.table([
    { Role: 'Admin', Account: ACCOUNTS.admin.name, Phone: ACCOUNTS.admin.phone, Password: DEMO_PASSWORD },
    ...ACCOUNTS.warehouses.map((account, index) => ({
      Role: `Warehouse ${index + 1}`,
      Account: account.nameEn,
      Phone: account.phone,
      Password: DEMO_PASSWORD,
    })),
    ...ACCOUNTS.pharmacies.map((account, index) => ({
      Role: `Pharmacy ${index + 1}`,
      Account: account.nameEn,
      Phone: account.phone,
      Password: DEMO_PASSWORD,
    })),
  ]);
}

async function main() {
  await mongoose.connect(env.mongodbUri);
  try {
    await seedDemo();
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Demo seed failed:', error);
  process.exitCode = 1;
});
