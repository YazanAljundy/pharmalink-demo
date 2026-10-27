import 'package:pharmalink_demo/features/debts/data/models/debt_detail_model.dart';
import 'package:pharmalink_demo/features/debts/data/models/warehouse_debt_model.dart';

abstract class DebtRepository {
  Future<DebtsSummaryModel> getMyDebts();

  Future<DebtDetailModel> getDebtDetail(String warehouseId);
}
