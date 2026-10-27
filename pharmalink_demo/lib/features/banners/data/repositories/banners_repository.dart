import 'package:pharmalink_demo/features/banners/data/models/banner_model.dart';

abstract class BannersRepository {
  Future<List<BannerModel>> getActiveBanners();
}
