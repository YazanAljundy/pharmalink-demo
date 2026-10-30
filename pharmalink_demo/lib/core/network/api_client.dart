import 'package:dio/dio.dart';
import 'package:pharmalink_demo/config/app_config.dart';
import 'package:pharmalink_demo/core/demo/mock_api_adapter.dart';
import 'package:pharmalink_demo/core/network/interceptors/auth_interceptor.dart';
import 'package:pharmalink_demo/core/services/secure_storage_service.dart';

class ApiClient {
  ApiClient({
    required SecureStorageService secureStorage,
    Duration? mockApiDelay,
  }) : _dio = Dio(_baseOptions()) {
    if (kDemoMockApi) {
      _dio.httpClientAdapter = MockApiAdapter(delay: mockApiDelay);
    }
    _dio.interceptors.add(
      AuthInterceptor(
        secureStorage: secureStorage,
        // Replays a request through this same client after a refresh, so the
        // replay goes back through the interceptor and picks up the new token.
        retryClient: _dio,
        // A bare client with no interceptors for POST /auth/refresh itself -
        // see the note in AuthInterceptor about why it must not re-enter.
        refreshClient: _newRefreshClient(mockApiDelay),
      ),
    );
  }

  static Dio _newRefreshClient(Duration? mockApiDelay) {
    final client = Dio(_baseOptions());
    if (kDemoMockApi) {
      client.httpClientAdapter = MockApiAdapter(delay: mockApiDelay);
    }
    return client;
  }

  static BaseOptions _baseOptions() => BaseOptions(
    baseUrl: AppConfig.apiBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  );

  final Dio _dio;

  Dio get dio => _dio;
}
