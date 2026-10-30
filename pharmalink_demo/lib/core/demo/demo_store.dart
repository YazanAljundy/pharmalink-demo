import 'dart:convert';

import 'package:flutter/services.dart';

class DemoStore {
  DemoStore._();

  static final DemoStore instance = DemoStore._();

  Map<String, dynamic> _fixture = {};
  final List<Map<String, dynamic>> _orders = [];
  final List<Map<String, dynamic>> _returns = [];
  final List<Map<String, dynamic>> _complaints = [];
  final List<Map<String, dynamic>> _reviews = [];
  final List<Map<String, dynamic>> _notifications = [];
  final Map<String, List<Map<String, dynamic>>> _ledger =
      <String, List<Map<String, dynamic>>>{};
  int _nextOrderNumber = 1100;

  ValueChanged<Map<String, dynamic>>? onNotification;

  List<Map<String, dynamic>> get notifications =>
      List.unmodifiable(_notifications);

  List<Map<String, dynamic>> get warehouses => _list('warehouses');
  List<Map<String, dynamic>> get categories => _list('categories');
  List<Map<String, dynamic>> get manufacturers => _list('manufacturers');
  List<Map<String, dynamic>> get products => _list('products');
  List<Map<String, dynamic>> get offers => _list('offers');
  List<Map<String, dynamic>> get advertisements => _list('advertisements');
  List<Map<String, dynamic>> get bannerList => _list('banners');

  List<Map<String, dynamic>> get manufacturerList => manufacturers;

  List<Map<String, dynamic>> get offerList {
    return _list('offers').map((offer) {
      final source = products.firstWhere(
        (item) => item['id'] == offer['productId'],
      );
      final view = product(source);
      final warehouse = warehouses.first;
      return {
        ...offer,
        'isPermanent': true,
        'warehouseId': warehouse['id'],
        'warehouseNameAr': warehouse['nameAr'],
        'warehouseNameEn': warehouse['nameEn'],
        'productId': source['id'],
        'nameAr': source['nameAr'],
        'nameEn': source['nameEn'],
        'manufacturerAr': view['manufacturerAr'],
        'manufacturerEn': view['manufacturerEn'],
        'image': source['image'],
        'unitAr': source['unitAr'],
        'unitEn': source['unitEn'],
        'priceUsd': source['priceUsd'],
        'discountPriceUsd': view['discountPriceUsd'],
        'isAvailable': source['isAvailable'],
      };
    }).toList();
  }

  List<Map<String, dynamic>> get advertisementList {
    return advertisements.map((ad) {
      final warehouse = warehouses[ad['warehouseIndex'] as int];
      final items = (ad['productIds'] as List).map((id) {
        final source = products.firstWhere((entry) => entry['id'] == id);
        final view = product(source);
        return {
          'productId': source['id'],
          'nameAr': source['nameAr'],
          'nameEn': source['nameEn'],
          'manufacturerAr': view['manufacturerAr'],
          'manufacturerEn': view['manufacturerEn'],
          'image': source['image'],
          'unitAr': source['unitAr'],
          'unitEn': source['unitEn'],
          'priceUsd': source['priceUsd'],
          'quantity': 1,
        };
      }).toList();
      return {
        'id': ad['id'],
        'titleAr': ad['titleAr'],
        'titleEn': ad['titleEn'],
        'warehouseId': warehouse['id'],
        'warehouseNameAr': warehouse['nameAr'],
        'warehouseNameEn': warehouse['nameEn'],
        'items': items,
        'itemsTotalUsd': items.fold<num>(
          0,
          (sum, item) =>
              sum + (item['priceUsd'] as num) * (item['quantity'] as num),
        ),
        'totalPriceUsd': ad['totalPriceUsd'],
        'savingPercentage': 20,
        'imageUrl': ad['imageUrl'],
      };
    }).toList();
  }

  Future<void> initialize() async {
    final raw = await rootBundle.loadString('assets/demo/demo_data.json');
    _fixture = jsonDecode(raw) as Map<String, dynamic>;
    _orders
      ..clear()
      ..addAll(_list('orders').map(_seedOrder));
    _returns
      ..clear()
      ..addAll(_list('returns').map(_seedReturn));
    _complaints
      ..clear()
      ..addAll(_list('complaints').map(_seedComplaint));
    _reviews
      ..clear()
      ..addAll(_list('reviews').map(_seedReview));
    _notifications
      ..clear()
      ..addAll(_list('notifications'));
    _ledger.clear();
    for (final row in _list('ledger')) {
      final warehouse = warehouses[row['warehouseIndex'] as int];
      (_ledger[warehouse['id'] as String] ??= []).add(row);
    }
    _nextOrderNumber = 1100;
  }

  Map<String, dynamic> warehouseProfile(String warehouseId) {
    final warehouse = warehouses.firstWhere(
      (item) => item['id'] == warehouseId,
      orElse: () => warehouses.first,
    );
    return {
      ...warehouse,
      'averageRating': 4.7,
      'reviewsCount': 2,
      'deliveryStartTime': '09:00',
      'deliveryEndTime': '17:00',
      'recentReviews': <Map<String, dynamic>>[],
    };
  }

  List<Map<String, dynamic>> get returnableOrders =>
      _orders.where((order) => order['status'] == 'delivered').map((order) {
        final items = (order['items'] as List).map((raw) {
          final item = raw as Map<String, dynamic>;
          return {
            'orderItemId': item['id'],
            'productId': item['productId'],
            'productNameAr': item['productNameAr'],
            'productNameEn': item['productNameEn'],
            'quantity': item['quantity'],
            'discountPrice': item['discountPrice'],
          };
        }).toList();
        return {
          'id': order['id'],
          'orderNumber': order['orderNumber'],
          'warehouseId': order['warehouseId'],
          'warehouseNameAr': order['warehouseNameAr'],
          'warehouseNameEn': order['warehouseNameEn'],
          'finalPrice': order['finalPrice'],
          'deliveredAt': order['createdAt'],
          'hoursRemaining': 72,
          'items': items,
        };
      }).toList();

  Map<String, dynamic> updateReturn(
    Map<String, dynamic> item,
    Map<String, dynamic> body,
  ) {
    final rawItems = body['items'];
    item['items'] = rawItems is String ? jsonDecode(rawItems) : rawItems;
    item['notes'] = body['notes'];
    return item;
  }

  Map<String, dynamic> reorder(Map<String, dynamic> order) {
    final items = (order['items'] as List).map((raw) {
      final item = raw as Map<String, dynamic>;
      final source = products.firstWhere(
        (entry) => entry['id'] == item['productId'],
        orElse: () => products.first,
      );
      return {...product(source), 'quantity': item['quantity']};
    }).toList();
    final warehouse = warehouses.firstWhere(
      (item) => item['id'] == order['warehouseId'],
      orElse: () => warehouses.first,
    );
    return {
      'warehouseId': warehouse['id'],
      'warehouseNameAr': warehouse['nameAr'],
      'warehouseNameEn': warehouse['nameEn'],
      'items': items,
      'unavailableItems': <Map<String, dynamic>>[],
    };
  }

  Map<String, dynamic> advertisementCart(String advertisementId) {
    final ad = advertisementList.firstWhere(
      (item) => item['id'] == advertisementId,
      orElse: () => advertisementList.first,
    );
    final warehouseId = ad['warehouseId'] as String;
    final items = (ad['items'] as List).map((raw) {
      final item = raw as Map<String, dynamic>;
      final source = products.firstWhere(
        (entry) => entry['id'] == item['productId'],
      );
      return {...product(source), 'quantity': item['quantity']};
    }).toList();
    return {
      'advertisementId': ad['id'],
      'titleAr': ad['titleAr'],
      'titleEn': ad['titleEn'],
      'warehouseId': warehouseId,
      'warehouseNameAr': ad['warehouseNameAr'],
      'warehouseNameEn': ad['warehouseNameEn'],
      'items': items
          .map(
            (item) => {
              'id': item['id'],
              'nameAr': item['nameAr'],
              'nameEn': item['nameEn'],
              'image': item['image'],
              'quantity': item['quantity'],
            },
          )
          .toList(),
      'itemsTotalUsd': ad['itemsTotalUsd'],
      'totalPriceUsd': ad['totalPriceUsd'],
      'isAvailable': true,
      'unavailableItems': <Map<String, dynamic>>[],
    };
  }

  Map<String, dynamic> debtsSummary() {
    final accounts = warehouses.map((warehouse) {
      final rows = ledgerFor(warehouse['id'] as String);
      final balance = rows.fold<num>(0, (current, row) {
        return current +
            (row['debitSyp'] as num? ?? 0) -
            (row['creditSyp'] as num? ?? 0);
      });
      return {
        'warehouseId': warehouse['id'],
        'nameAr': warehouse['nameAr'],
        'nameEn': warehouse['nameEn'],
        'phone': warehouse['phone'],
        'balanceSyp': balance,
        'balanceUsd': balance / usdToSyp,
        'lastActivityAt': DateTime.now().toUtc().toIso8601String(),
      };
    }).toList();
    final debt = accounts
        .map((account) => account['balanceSyp'] as num)
        .where((balance) => balance > 0)
        .fold<num>(0, (sum, balance) => sum + balance);
    final credit = accounts
        .map((account) => account['balanceSyp'] as num)
        .where((balance) => balance < 0)
        .fold<num>(0, (sum, balance) => sum - balance);
    return {
      'totalDebtSyp': debt,
      'totalCreditSyp': credit,
      'netPositionSyp': debt - credit,
      'accounts': accounts,
    };
  }

  Map<String, dynamic> debtDetail(String warehouseId) {
    final warehouse = warehouses.firstWhere(
      (item) => item['id'] == warehouseId,
      orElse: () => warehouses.first,
    );
    var balance = 0;
    var charges = 0;
    var payments = 0;
    final rows = ledgerFor(warehouseId).map((source) {
      final debit = (source['debitSyp'] as num? ?? 0).round();
      final credit = (source['creditSyp'] as num? ?? 0).round();
      balance += debit - credit;
      charges += debit;
      payments += credit;
      return {
        'id': source['id'],
        'kind': source['kind'],
        'effectiveAt':
            source['effectiveAt'] ?? DateTime.now().toUtc().toIso8601String(),
        'debitSyp': debit,
        'creditSyp': credit,
        'balanceSyp': balance,
        'reference': {
          if (source['orderNumber'] != null)
            'orderNumber': source['orderNumber'],
          if (source['orderId'] != null) 'orderId': source['orderId'],
          if (source['paymentNumber'] != null)
            'paymentNumber': source['paymentNumber'],
        },
      };
    }).toList();
    return {
      'statement': {
        'warehouse': {
          'nameAr': warehouse['nameAr'],
          'nameEn': warehouse['nameEn'],
          'phone': warehouse['phone'],
        },
        'period': {'from': null, 'to': null},
        'opening': {'syp': 0},
        'closing': {'syp': balance},
        'outstandingDebtSyp': balance > 0 ? balance : 0,
        'creditBalanceSyp': balance < 0 ? -balance : 0,
        'summary': {
          'chargesSyp': charges,
          'paymentsSyp': payments,
          'returnCreditsSyp': 0,
          'adjustmentsSyp': 0,
        },
        'rows': rows,
      },
    };
  }

  Map<String, dynamic> _seedOrder(Map<String, dynamic> fixture) {
    final warehouse = warehouses[fixture['warehouseIndex'] as int];
    final source = products.firstWhere(
      (item) => item['id'] == fixture['productId'],
    );
    final productView = product(source);
    final quantity = fixture['quantity'] as int;
    final unitPrice = productView['discountPriceUsd'] as num;
    final totalUsd = unitPrice * quantity;
    final createdAt = DateTime.now()
        .subtract(Duration(days: fixture['createdDaysAgo'] as int))
        .toUtc()
        .toIso8601String();
    return {
      'id': fixture['id'],
      'orderNumber': fixture['orderNumber'],
      'status': fixture['status'],
      'totalPrice': (totalUsd * usdToSyp).round(),
      'discountAmount': 0,
      'commissionAmount': 0,
      'advertisementDiscountAmount': 0,
      'finalPrice': (totalUsd * usdToSyp).round(),
      'warehouseId': warehouse['id'],
      'warehouseNameAr': warehouse['nameAr'],
      'warehouseNameEn': warehouse['nameEn'],
      'deliverySealPhotoUrl': fixture['deliverySealPhotoUrl'],
      'createdAt': createdAt,
      'items': [
        {
          'id': '${fixture['id']}-item-1',
          'productId': source['id'],
          'productNameAr': source['nameAr'],
          'productNameEn': source['nameEn'],
          'manufacturerAr': productView['manufacturerAr'],
          'manufacturerEn': productView['manufacturerEn'],
          'quantity': quantity,
          'unitPrice': source['priceUsd'],
          'discountPrice': unitPrice,
          'lineTotal': unitPrice * quantity,
          'freeQuantity': 0,
        },
      ],
      'statusHistory': [
        {'status': fixture['status'], 'changedAt': createdAt},
      ],
    };
  }

  Map<String, dynamic> _seedReturn(Map<String, dynamic> fixture) {
    final order = _orders.firstWhere(
      (item) => item['id'] == fixture['orderId'],
    );
    final line = (order['items'] as List).first as Map<String, dynamic>;
    return {
      'id': fixture['id'],
      'orderId': fixture['orderId'],
      'orderNumber': order['orderNumber'],
      'items': [
        {
          'orderItemId': line['id'],
          'productId': fixture['productId'],
          'quantity': fixture['quantity'],
          'reasonType': fixture['reasonType'],
          'productNameAr': line['productNameAr'],
          'productNameEn': line['productNameEn'],
        },
      ],
      'notes': fixture['notes'],
      'images': fixture['images'] ?? <String>[],
      'status': fixture['status'],
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    };
  }

  Map<String, dynamic> _seedComplaint(Map<String, dynamic> fixture) {
    final now = DateTime.now().toUtc().toIso8601String();
    return {...fixture, 'createdAt': now, 'updatedAt': now};
  }

  Map<String, dynamic> _seedReview(Map<String, dynamic> fixture) {
    final warehouse = warehouses[fixture['warehouseIndex'] as int];
    return {
      'id': fixture['id'],
      'orderId': fixture['orderId'],
      'orderNumber': fixture['orderNumber'],
      'warehouseNameAr': warehouse['nameAr'],
      'warehouseNameEn': warehouse['nameEn'],
      'rating': fixture['rating'],
      'comment': fixture['comment'],
      'createdAt': DateTime.now()
          .subtract(Duration(days: fixture['createdDaysAgo'] as int))
          .toUtc()
          .toIso8601String(),
    };
  }

  Map<String, dynamic> get pharmacy => _map('pharmacy');
  Map<String, dynamic> get savings => _map('savings');
  double get usdToSyp => 13000;

  List<Map<String, dynamic>> _list(String key) =>
      ((_fixture[key] as List?) ?? const [])
          .map((item) => _copy(item as Map<String, dynamic>))
          .toList();

  Map<String, dynamic> _map(String key) =>
      _copy((_fixture[key] as Map?)?.cast<String, dynamic>() ?? {});

  static Map<String, dynamic> _copy(Map<String, dynamic> value) =>
      Map<String, dynamic>.from(value);

  List<Map<String, dynamic>> get orderList => _orders;
  List<Map<String, dynamic>> get returnList => _returns;
  List<Map<String, dynamic>> get complaintList => _complaints;
  List<Map<String, dynamic>> get reviewList => _reviews;

  Map<String, dynamic> pharmacyUser() {
    final user = pharmacy;
    return {
      'id': user['userId'],
      'name': user['ownerName'],
      'phone': user['phone'],
      'role': user['role'],
      'status': user['status'],
      'lang': user['lang'],
    };
  }

  Map<String, dynamic> pharmacyProfile() => {
    'id': pharmacy['id'],
    'nameAr': pharmacy['nameAr'],
    'nameEn': pharmacy['nameEn'],
    'ownerName': pharmacy['ownerName'],
    'address': pharmacy['address'],
    'city': pharmacy['city'],
    'phone': pharmacy['phone'],
    'areaType': pharmacy['areaType'],
  };

  Map<String, dynamic> authResponse() => {
    'token': 'demo-access-token',
    'refreshToken': 'demo-refresh-token',
    'user': pharmacyUser(),
    'pharmacy': pharmacyProfile(),
  };

  Map<String, dynamic> product(Map<String, dynamic> source) {
    final manufacturer = manufacturers[source['manufacturerIndex'] as int];
    final offer = offers.where((entry) => entry['productId'] == source['id']);
    final discount = offer.isEmpty
        ? (manufacturer['discountPercentage'] as num) / 100
        : (offer.first['discountPercentage'] as num) / 100;
    final price = source['priceUsd'] as num;
    final discounted = price * (1 - discount);
    return {
      'id': source['id'],
      'categoryId': source['categoryId'],
      'nameAr': source['nameAr'],
      'nameEn': source['nameEn'],
      'manufacturerAr': manufacturer['manufacturerAr'],
      'manufacturerEn': manufacturer['manufacturerEn'],
      'image': source['image'],
      'unit': source['unit'],
      'unitAr': source['unitAr'],
      'unitEn': source['unitEn'],
      'priceUsd': price,
      'discountPriceUsd': discounted,
      'finalPriceSyp': (discounted * usdToSyp).round(),
      'priceRate': usdToSyp,
      'offerDiscountPercentage': offer.isEmpty
          ? 0
          : offer.first['discountPercentage'],
      'manufacturerDiscountPercentage': offer.isEmpty
          ? manufacturer['discountPercentage']
          : 0,
      'isAvailable': source['isAvailable'],
      'offer': offer.isEmpty ? null : offer.first,
      'bonuses': <Map<String, dynamic>>[],
    };
  }

  Map<String, dynamic> createOrder(Map<String, dynamic> body) {
    final id = 'order-demo-${DateTime.now().microsecondsSinceEpoch}';
    final warehouseId =
        body['warehouseId'] as String? ?? warehouses.first['id'] as String;
    final rawItems = (body['items'] as List?) ?? const [];
    final lines = <Map<String, dynamic>>[];
    var totalUsd = 0.0;
    for (final raw in rawItems) {
      final line = (raw as Map).cast<String, dynamic>();
      final productId = line['productId'] as String;
      final item = products.firstWhere(
        (entry) => entry['id'] == productId,
        orElse: () => products.first,
      );
      final model = product(item);
      final quantity = (line['quantity'] as num).toInt();
      final unit = (model['discountPriceUsd'] as num).toDouble();
      final lineTotal = unit * quantity;
      totalUsd += lineTotal;
      lines.add({
        'id': '$id-item-${lines.length + 1}',
        'productId': productId,
        'productNameAr': item['nameAr'],
        'productNameEn': item['nameEn'],
        'manufacturerAr': model['manufacturerAr'],
        'manufacturerEn': model['manufacturerEn'],
        'quantity': quantity,
        'unitPrice': item['priceUsd'],
        'discountPrice': unit,
        'lineTotal': lineTotal,
        'freeQuantity': 0,
      });
    }
    final quote = this.quote({'items': rawItems, 'code': body['discountCode']});
    final totalSyp =
        ((quote['totals'] as Map<String, dynamic>)['finalSyp'] as num).round();
    final totals = quote['totals'] as Map<String, dynamic>;
    final code = quote['discountCode'] as Map<String, dynamic>?;
    final order = {
      'id': id,
      'orderNumber': _nextOrderNumber++,
      'status': 'pending',
      'totalPrice': (totalUsd * usdToSyp).round(),
      'discountAmount': totals['discountSyp'],
      'commissionAmount': 0,
      'advertisementDiscountAmount': 0,
      'finalPrice': totalSyp,
      if (code != null)
        'discountCode': {...code, 'discountSyp': totals['discountSyp']},
      'notes': body['notes'],
      'warehouseId': warehouseId,
      'warehouseNameAr': warehouses.firstWhere(
        (entry) => entry['id'] == warehouseId,
        orElse: () => warehouses.first,
      )['nameAr'],
      'warehouseNameEn': warehouses.firstWhere(
        (entry) => entry['id'] == warehouseId,
        orElse: () => warehouses.first,
      )['nameEn'],
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'items': lines,
      'statusHistory': [
        {
          'status': 'pending',
          'changedAt': DateTime.now().toUtc().toIso8601String(),
        },
      ],
    };
    _orders.insert(0, order);
    _scheduleOrderProgress(order);
    return order;
  }

  void _scheduleOrderProgress(Map<String, dynamic> order) {
    Future<void>.delayed(const Duration(seconds: 8), () {
      if (!_orders.contains(order) || order['status'] != 'pending') return;
      _setOrderStatus(order, 'preparing');
    });
    Future<void>.delayed(const Duration(seconds: 20), () {
      if (!_orders.contains(order) || order['status'] == 'cancelled') return;
      _setOrderStatus(order, 'delivered');
      _addLedgerCharge(order);
    });
  }

  void _setOrderStatus(Map<String, dynamic> order, String status) {
    order['status'] = status;
    final changedAt = DateTime.now().toUtc().toIso8601String();
    (order['statusHistory'] as List).add({
      'status': status,
      'changedAt': changedAt,
    });
    final notification = {
      'id': 'notification-${order['id']}-$status',
      'title': 'Order update',
      'body': 'Demo order ${order['orderNumber']} is now $status.',
      'receivedAt': changedAt,
      'isRead': false,
      'type': 'orderUpdate',
      'relatedOrderId': order['id'],
      'data': {'type': 'order_update', 'relatedOrderId': order['id']},
    };
    _notifications.insert(0, notification);
    onNotification?.call(notification);
  }

  void _addLedgerCharge(Map<String, dynamic> order) {
    final warehouseId = order['warehouseId'] as String;
    final rows = _ledger.putIfAbsent(warehouseId, () => []);
    if (rows.any((row) => row['orderId'] == order['id'])) return;
    rows.add({
      'id': 'ledger-${order['id']}',
      'kind': 'charge',
      'effectiveAt': DateTime.now().toUtc().toIso8601String(),
      'debitSyp': order['finalPrice'],
      'creditSyp': 0,
      'orderId': order['id'],
      'orderNumber': order['orderNumber'],
      'paymentNumber': null,
    });
  }

  Map<String, dynamic> orderView(Map<String, dynamic> source) {
    final order = _copy(source);
    order['items'] = List<Map<String, dynamic>>.from(
      (source['items'] as List? ?? const []).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    );
    order['statusHistory'] = List<Map<String, dynamic>>.from(
      (source['statusHistory'] as List? ?? const []).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    );
    final linked = _returns.where((entry) => entry['orderId'] == source['id']);
    order['linkedReturn'] = linked.isEmpty
        ? null
        : {
            'id': linked.first['id'],
            'status': linked.first['status'],
            'creditSyp': linked.first['creditSyp'],
            'creditUsd': linked.first['creditUsd'],
          };
    return order;
  }

  Map<String, dynamic> createReturn(Map<String, dynamic> body) {
    final rawItems = body['items'];
    final items = rawItems is String
        ? (jsonDecode(rawItems) as List)
        : (rawItems as List? ?? const []);
    final returnValue = {
      'id': 'return-demo-${DateTime.now().microsecondsSinceEpoch}',
      'orderId': body['orderId'],
      'items': items,
      'notes': body['notes'],
      'images': <String>[],
      'status': 'pending',
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    };
    _returns.insert(0, returnValue);
    return returnValue;
  }

  Map<String, dynamic> createComplaint(Map<String, dynamic> body) {
    final now = DateTime.now().toUtc().toIso8601String();
    final complaint = {
      'id': 'complaint-demo-${DateTime.now().microsecondsSinceEpoch}',
      'complaintNumber': 600 + _complaints.length,
      'contextType': body['contextType'] ?? 'general',
      'subject': body['subject'] ?? 'Demo feedback',
      'description': body['description'] ?? '',
      'extraDetails': body['extraDetails'],
      'status': 'pending',
      'relatedOrderId': body['relatedOrderId'],
      'relatedOrderNumber': null,
      'createdAt': now,
      'updatedAt': now,
    };
    _complaints.insert(0, complaint);
    return complaint;
  }

  Map<String, dynamic> createReview(Map<String, dynamic> body) {
    final order = _orders.firstWhere(
      (entry) => entry['id'] == body['orderId'],
      orElse: () => _orders.first,
    );
    final warehouse = warehouses.firstWhere(
      (entry) => entry['id'] == order['warehouseId'],
      orElse: () => warehouses.first,
    );
    final review = {
      'id': 'review-demo-${DateTime.now().microsecondsSinceEpoch}',
      'orderId': body['orderId'],
      'orderNumber': order['orderNumber'],
      'warehouseNameAr': warehouse['nameAr'],
      'warehouseNameEn': warehouse['nameEn'],
      'rating': body['rating'] ?? 5,
      'comment': body['comment'],
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    };
    _reviews.insert(0, review);
    order['myReview'] = {
      'id': review['id'],
      'rating': review['rating'],
      'comment': review['comment'],
      'createdAt': review['createdAt'],
    };
    return review;
  }

  List<Map<String, dynamic>> ledgerFor(String warehouseId) =>
      _ledger[warehouseId] ?? const [];

  int get balanceSyp =>
      _ledger.values.expand((rows) => rows).fold<int>(0, (balance, row) {
        final debit = (row['debitSyp'] as num?)?.round() ?? 0;
        final credit = (row['creditSyp'] as num?)?.round() ?? 0;
        return balance + debit - credit;
      });

  Map<String, dynamic> quote(Map<String, dynamic> body) {
    final rawItems = body['items'] as List? ?? const [];
    var subtotal = 0;
    for (final raw in rawItems) {
      final line = (raw as Map).cast<String, dynamic>();
      final id = line['productId'];
      final productSource = products.firstWhere(
        (entry) => entry['id'] == id,
        orElse: () => products.first,
      );
      final quantity = (line['quantity'] as num).toInt();
      subtotal +=
          ((product(productSource)['discountPriceUsd'] as num) *
                  quantity *
                  usdToSyp)
              .round();
    }
    final code = (body['code'] as String?)?.toUpperCase();
    final codeFixture = (_list(
      'discountCodes',
    )).where((item) => item['code'] == code);
    var discount = 0;
    Map<String, dynamic>? codeResponse;
    if (codeFixture.isNotEmpty) {
      final found = codeFixture.first;
      discount = found['type'] == 'percentage'
          ? (subtotal * (found['value'] as num) / 100).round()
          : (found['value'] as num).round();
      if (discount > subtotal) discount = subtotal;
      codeResponse = {
        'code': found['code'],
        'type': found['type'],
        'value': found['value'],
        'revision': found['revision'],
      };
    }
    final preCode = subtotal;
    return {
      if (codeResponse != null) 'discountCode': codeResponse,
      'totals': {
        'subtotalSyp': subtotal,
        'platformDiscountSyp': 0,
        'preCodeSyp': preCode,
        'discountSyp': discount,
        'finalSyp': preCode - discount,
        'usdToSyp': usdToSyp,
      },
    };
  }

  List<Map<String, dynamic>> filteredProducts(
    String warehouseId,
    Map<String, dynamic> query,
  ) {
    final search = (query['search']?.toString() ?? '').toLowerCase();
    final category =
        query['categoryId']?.toString() ?? query['category']?.toString();
    final manufacturer = query['manufacturer']?.toString();
    final selectedWarehouse = query['warehouse']?.toString();
    return products
        .where((entry) {
          final productView = product(entry);
          final searchMatches =
              search.isEmpty ||
              '${entry['nameAr']} ${entry['nameEn']} ${productView['manufacturerAr']}'
                  .toLowerCase()
                  .contains(search);
          return searchMatches &&
              (selectedWarehouse == null || selectedWarehouse == warehouseId) &&
              (category == null || entry['categoryId'] == category) &&
              (manufacturer == null ||
                  productView['manufacturerAr'] == manufacturer);
        })
        .map(product)
        .toList();
  }

  List<Map<String, dynamic>> page(
    List<Map<String, dynamic>> values,
    Map<String, dynamic> query,
  ) {
    final limit = _limit(query);
    final start = offset(query);
    final end = (start + limit).clamp(0, values.length);
    if (start >= values.length) return [];
    return [...values.skip(start).take(end - start)];
  }

  int offset(Map<String, dynamic> query) {
    final after = int.tryParse(query['after']?.toString() ?? '');
    if (after != null) return after < 0 ? 0 : after;
    final pageNumber = int.tryParse(query['page']?.toString() ?? '') ?? 1;
    return (pageNumber < 1 ? 0 : pageNumber - 1) * _limit(query);
  }

  int _limit(Map<String, dynamic> query) {
    final limit = int.tryParse(query['limit']?.toString() ?? '') ?? 20;
    return limit.clamp(1, 100);
  }

  Map<String, dynamic> pagination(
    int total,
    int start,
    int count,
    Map<String, dynamic> query,
  ) {
    final next = start + count;
    final hasMore = next < total;
    return {'hasMore': hasMore, 'nextCursor': hasMore ? '$next' : null};
  }
}
