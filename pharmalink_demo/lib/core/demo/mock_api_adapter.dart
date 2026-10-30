import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:pharmalink_demo/core/demo/demo_store.dart';

class MockApiAdapter implements HttpClientAdapter {
  MockApiAdapter({DemoStore? store, Duration? delay})
    : _store = store ?? DemoStore.instance,
      _delay = delay;

  final DemoStore _store;
  final Duration? _delay;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    await Future<void>.delayed(
      _delay ?? Duration(milliseconds: 150 + DateTime.now().microsecond % 251),
    );
    if (cancelFuture != null) {
      await Future.any<void>([
        Future<void>.delayed(Duration.zero),
        cancelFuture,
      ]);
    }

    final path = _path(options.uri.path);
    final method = options.method.toUpperCase();
    final query = <String, dynamic>{...options.queryParameters};
    final body = _body(options.data);
    final result = _dispatch(method, path, query, body);
    if (result == null) {
      debugPrint('Demo mock API: unhandled $method $path');
      return _response({'success': true, 'data': <String, dynamic>{}});
    }
    return _response(result);
  }

  String _path(String path) {
    final normalized = path.startsWith('/api/')
        ? path.substring(4)
        : path == '/api'
        ? '/'
        : path;
    return normalized.endsWith('/') && normalized.length > 1
        ? normalized.substring(0, normalized.length - 1)
        : normalized;
  }

  Map<String, dynamic> _body(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    if (value is FormData) {
      final result = <String, dynamic>{};
      for (final field in value.fields) {
        result[field.key] = field.value;
      }
      return result;
    }
    if (value is String) {
      try {
        final decoded = jsonDecode(value);
        if (decoded is Map) return decoded.cast<String, dynamic>();
      } on FormatException {
        return {};
      }
    }
    return {};
  }

  dynamic _dispatch(
    String method,
    String path,
    Map<String, dynamic> query,
    Map<String, dynamic> body,
  ) {
    if (path == '/auth/login-password' ||
        path == '/auth/login' ||
        path == '/auth/register') {
      return _store.authResponse();
    }
    if (path == '/auth/refresh') {
      return {
        'token': 'demo-access-token-refreshed',
        'refreshToken': 'demo-refresh-token-refreshed',
      };
    }
    if (path == '/auth/me') {
      return {
        'user': _store.pharmacyUser(),
        'pharmacy': _store.pharmacyProfile(),
      };
    }
    if (path == '/auth/otp/send' ||
        path == '/auth/device-token' ||
        path == '/auth/account') {
      return {'success': true, 'message': 'Demo request accepted'};
    }
    if (path == '/warehouses' && method == 'GET') {
      return {
        'warehouses': _store.warehouses,
        'cityFilterApplied': query['cityScope'] == 'mine',
        'pharmacyCity': _store.pharmacy['city'],
      };
    }
    if (path == '/categories' && method == 'GET') {
      return {'categories': _store.categories};
    }
    if (path == '/exchange-rate') return {'usdToSyp': _store.usdToSyp};
    if (path == '/banners/active') return {'banners': _store.bannerList};
    if (path == '/offers/active') return {'offers': _store.offerList};
    if (path == '/advertisements/active') {
      return {
        'advertisements': _store.advertisementList,
        'pagination': {'hasMore': false, 'nextCursor': null},
      };
    }
    if (path == '/orders/savings-summary') return _store.savings;
    if (path == '/discount-codes/preview' && method == 'POST') {
      return _store.quote(body);
    }
    if (path == '/warehouses' || path.startsWith('/warehouses/')) {
      final match = RegExp(
        r'^/warehouses/([^/]+)(?:/(products|manufacturers|profile))?$',
      ).firstMatch(path);
      if (match != null) {
        final warehouseId = match.group(1)!;
        switch (match.group(2)) {
          case 'products':
            final products = _store.filteredProducts(warehouseId, query);
            final start = _store.offset(query);
            final page = _store.page(products, query);
            return {
              'products': page,
              'pagination': _store.pagination(
                products.length,
                start,
                page.length,
                query,
              ),
            };
          case 'manufacturers':
            return {'manufacturers': _store.manufacturerList};
          case 'profile':
            return _store.warehouseProfile(warehouseId);
        }
      }
    }
    if (path == '/orders' && method == 'GET') {
      final limit = int.tryParse(query['limit']?.toString() ?? '') ?? 20;
      final start =
          int.tryParse(query['after']?.toString() ?? '') ??
          ((int.tryParse(query['page']?.toString() ?? '') ?? 1) - 1) * limit;
      final status = query['status']?.toString();
      final warehouse = query['warehouse']?.toString();
      final values = _store.orderList
          .where((order) => status == null || order['status'] == status)
          .where(
            (order) => warehouse == null || order['warehouseId'] == warehouse,
          )
          .map(_store.orderView)
          .toList();
      final page = _store.page(values, query);
      return {
        'orders': page,
        'pagination': _store.pagination(
          values.length,
          start,
          page.length,
          query,
        ),
      };
    }
    if (path == '/orders' && method == 'POST') {
      return {'order': _store.createOrder(body)};
    }
    if (path == '/orders/returnable') {
      return {'orders': _store.returnableOrders};
    }
    final orderMatch = RegExp(
      r'^/orders/([^/]+)(?:/(cancel|confirm-delivery|reorder))?$',
    ).firstMatch(path);
    if (orderMatch != null) {
      final order = _store.orderList.firstWhere(
        (entry) => entry['id'] == orderMatch.group(1),
        orElse: () => _store.orderList.first,
      );
      switch (orderMatch.group(2)) {
        case 'cancel':
          order['status'] = 'cancelled';
          return {'order': _store.orderView(order)};
        case 'reorder':
          return {'reorder': _store.reorder(order)};
        default:
          return {'order': _store.orderView(order)};
      }
    }
    if (path == '/returns' && method == 'GET') {
      final start = _store.offset(query);
      final page = _store.page(_store.returnList, query);
      return {
        'returns': page,
        'pagination': _store.pagination(
          _store.returnList.length,
          start,
          page.length,
          query,
        ),
      };
    }
    if (path == '/returns' && method == 'POST') {
      return {'return': _store.createReturn(body)};
    }
    final returnMatch = RegExp(r'^/returns/([^/]+)$').firstMatch(path);
    if (returnMatch != null) {
      final item = _store.returnList.firstWhere(
        (entry) => entry['id'] == returnMatch.group(1),
        orElse: () => <String, dynamic>{},
      );
      if (method == 'DELETE') {
        _store.returnList.remove(item);
        return {'success': true};
      }
      if (method == 'PUT') return {'return': _store.updateReturn(item, body)};
      return {'return': item};
    }
    if (path == '/complaints' && method == 'GET') {
      final complaints = _store.page(_store.complaintList, query);
      return {
        'complaints': complaints,
        'pagination': _store.pagination(
          _store.complaintList.length,
          _store.offset(query),
          complaints.length,
          query,
        ),
      };
    }
    if (path == '/complaints' && method == 'POST') {
      return {'complaint': _store.createComplaint(body)};
    }
    final complaintMatch = RegExp(r'^/complaints/([^/]+)$').firstMatch(path);
    if (complaintMatch != null) {
      return {
        'complaint': _store.complaintList.firstWhere(
          (entry) => entry['id'] == complaintMatch.group(1),
          orElse: () => <String, dynamic>{},
        ),
      };
    }
    if (path == '/reviews' && method == 'GET') {
      return {'reviews': _store.reviewList, 'averageRating': 4.5};
    }
    if (path == '/reviews' && method == 'POST') {
      return {'review': _store.createReview(body)};
    }
    if (path == '/pharmacy/debts') return _store.debtsSummary();
    final debtMatch = RegExp(r'^/pharmacy/debts/([^/]+)$').firstMatch(path);
    if (debtMatch != null) return _store.debtDetail(debtMatch.group(1)!);
    if (path.startsWith('/advertisements/') && path.endsWith('/cart')) {
      final id = path.split('/')[2];
      return {'advertisementCart': _store.advertisementCart(id)};
    }
    return null;
  }

  ResponseBody _response(dynamic data) => ResponseBody.fromString(
    jsonEncode(data),
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}
