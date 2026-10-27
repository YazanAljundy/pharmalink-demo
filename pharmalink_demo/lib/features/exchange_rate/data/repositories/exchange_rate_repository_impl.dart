import 'package:dio/dio.dart';
import 'package:pharmalink_demo/core/error/failure.dart';
import 'package:pharmalink_demo/core/network/api_client.dart';
import 'package:pharmalink_demo/core/network/endpoints.dart';
import 'package:pharmalink_demo/features/exchange_rate/data/models/exchange_rate_model.dart';

import 'exchange_rate_repository.dart';

class ExchangeRateRepositoryImpl implements ExchangeRateRepository {
  ExchangeRateRepositoryImpl({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  @override
  Future<ExchangeRateModel> getExchangeRate() async {
    try {
      final response = await _apiClient.dio.get(Endpoints.exchangeRate);
      return ExchangeRateModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ServerFailure.fromDioError(e);
    }
  }
}
