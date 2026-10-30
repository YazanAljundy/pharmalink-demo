import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pharmalink_demo/core/demo/demo_store.dart';
import 'package:pharmalink_demo/core/demo/mock_api_adapter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late DemoStore store;
  late Dio dio;

  setUp(() async {
    store = DemoStore.instance;
    await store.initialize();
    dio = Dio(BaseOptions(baseUrl: 'http://demo.test/api'));
    dio.httpClientAdapter = MockApiAdapter(store: store);
  });

  tearDown(() {
    dio.close(force: true);
  });

  test('login returns a pharmacy session without a server', () async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/login-password',
      data: {'phone': '0900000004', 'password': 'Demo@12345'},
    );

    expect(response.data?['token'], 'demo-access-token');
    expect(response.data?['user']['role'], 'pharmacy');
    expect(response.data?['pharmacy']['id'], 'pharmacy-demo');
  });

  test('product search returns matching catalog entries', () async {
    final response = await dio.get<Map<String, dynamic>>(
      '/warehouses/warehouse-demo-01/products',
      queryParameters: {'search': 'paracetamol', 'limit': 10},
    );

    final products = response.data?['products'] as List;
    expect(products, hasLength(1));
    expect(products.single['id'], 'product-001');
  });

  test('a placed order advances and adds in-app notifications', () async {
    final response = await dio.post<Map<String, dynamic>>(
      '/orders',
      data: {
        'warehouseId': 'warehouse-demo-01',
        'items': [
          {
            'productId': 'product-001',
            'quantity': 1,
            'displayedUnitPriceUsd': 2.4,
            'displayedBonuses': [],
          },
        ],
      },
    );
    final id = response.data?['order']['id'] as String;
    expect(response.data?['order']['status'], 'pending');

    await Future<void>.delayed(const Duration(milliseconds: 8300));

    final detail = await dio.get<Map<String, dynamic>>('/orders/$id');
    expect(detail.data?['order']['status'], 'preparing');
    expect(
      store.notifications.any(
        (notification) => notification['relatedOrderId'] == id,
      ),
      isTrue,
    );
  });

  test('discount preview applies a fixture code', () async {
    final response = await dio.post<Map<String, dynamic>>(
      '/discount-codes/preview',
      data: {
        'warehouseId': 'warehouse-demo-01',
        'code': 'SAVE10',
        'items': [
          {
            'productId': 'product-001',
            'quantity': 2,
            'displayedUnitPriceUsd': 2.4,
            'displayedBonuses': [],
          },
        ],
      },
    );

    expect(response.data?['discountCode']['code'], 'SAVE10');
    expect(response.data?['totals']['discountSyp'], greaterThan(0));
    expect(
      response.data?['totals']['finalSyp'],
      lessThan(response.data?['totals']['preCodeSyp']),
    );
  });

  test('unknown endpoint returns a successful empty envelope', () async {
    final response = await dio.get<Map<String, dynamic>>('/not-in-demo');

    expect(response.data, {'success': true, 'data': <String, dynamic>{}});
  });
}
