import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pharmalink_demo/core/error/failure.dart';
import 'package:pharmalink_demo/features/cart/data/models/cart_item.dart';
import 'package:pharmalink_demo/features/cart/data/models/cart_quote.dart';
import 'package:pharmalink_demo/features/cart/data/repositories/order_repository.dart';
import 'package:pharmalink_demo/features/cart/presentation/managers/cart_cubit.dart';
import 'package:pharmalink_demo/features/cart/presentation/views/cart_view.dart';
import 'package:pharmalink_demo/features/cart/presentation/widgets/cart_item_tile.dart';
import 'package:pharmalink_demo/features/catalog/data/models/product_model.dart';
import 'package:pharmalink_demo/features/exchange_rate/data/models/exchange_rate_model.dart';
import 'package:pharmalink_demo/features/exchange_rate/data/repositories/exchange_rate_repository.dart';
import 'package:pharmalink_demo/features/exchange_rate/presentation/managers/exchange_rate_cubit.dart';
import 'package:pharmalink_demo/features/warehouse_selection/data/models/warehouse_profile_model.dart';
import 'package:pharmalink_demo/features/warehouse_selection/data/repositories/warehouse_repository.dart';
import 'package:pharmalink_demo/generated/app_localizations.dart';
import 'package:pharmalink_demo/routes/route_names.dart';

import '../../helpers/cart_quote_stub.dart';

class _MockOrderRepository extends Mock implements OrderRepository {}

class _MockWarehouseRepository extends Mock implements WarehouseRepository {}

class _MockExchangeRateRepository extends Mock implements ExchangeRateRepository {}

// $10, on offer at $8.
ProductModel _product(String id) => ProductModel(
  id: id,
  nameAr: 'دواء $id',
  nameEn: 'Product $id',
  manufacturerAr: 'شركة',
  manufacturerEn: 'Pharma',
  priceUsd: 10,
  discountPriceUsd: 8,
  isAvailable: true,
  hasActiveOffer: true,
);

WarehouseProfileModel _profile({num min = 0, num? max}) => WarehouseProfileModel(
  id: 'A',
  nameAr: 'مستودع',
  nameEn: 'Warehouse A',
  address: 'a',
  city: 'Latakia',
  phone: '0940000000',
  deliveryType: 'self',
  minOrderAmountUsd: min,
  maxOrderAmountUsd: max,
  averageRating: 0,
  reviewsCount: 0,
  recentReviews: const [],
);

// The cart's line prices are converted at the rate of the quote on screen, so
// the lines and the total always share one rate - the app's cached rate is
// only the fallback until the first quote arrives. Here the app cached 1,000
// SYP/$ and the server quotes at 1,200 (the rate moved within the cache's
// 10 minutes). The warehouse's order-size limits follow the same rule, so a
// limit and the subtotal it is compared against never read at two rates.
void main() {
  late CartCubit cartCubit;
  late ExchangeRateCubit rateCubit;
  late _MockOrderRepository orderRepo;
  late _MockExchangeRateRepository rateRepo;
  late _MockWarehouseRepository warehouseRepo;

  setUpAll(() {
    registerFallbackValue(<CartItem>[]);
  });

  setUp(() async {
    orderRepo = _MockOrderRepository();
    warehouseRepo = _MockWarehouseRepository();
    when(() => warehouseRepo.getWarehouseProfile(any())).thenAnswer((_) async => throw Exception('not exercised'));
    cartCubit = CartCubit(orderRepository: orderRepo, warehouseRepository: warehouseRepo);

    rateRepo = _MockExchangeRateRepository();
    when(() => rateRepo.getExchangeRate()).thenAnswer((_) async => const ExchangeRateModel(usdToSyp: 1000));
    rateCubit = ExchangeRateCubit(exchangeRateRepository: rateRepo);
    await rateCubit.load();

    cartCubit.addProduct(_product('p1'), warehouseId: 'A', warehouseName: 'Warehouse A', quantity: 2);
  });

  tearDown(() {
    cartCubit.close();
    rateCubit.close();
  });

  // The server's first quote, held until the test releases it. Called inside
  // each testWidgets body: a Completer made in setUp belongs to the real zone,
  // and completing it under the widget tester's fake async never delivers.
  Completer<CartQuote> holdFirstQuote() {
    final firstQuote = Completer<CartQuote>();
    when(
      () => orderRepo.quoteCart(
        warehouseId: any(named: 'warehouseId'),
        items: any(named: 'items'),
        code: any(named: 'code'),
      ),
    ).thenAnswer((_) => firstQuote.future);
    return firstQuote;
  }

  CartQuote serverQuote() => quoteForItems(cartCubit.state.items, usdToSyp: 1200, platformPercent: 4);

  Future<void> pumpCart(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/cart',
      routes: [
        GoRoute(path: '/cart', name: RouteNames.cart, builder: (context, state) => const CartView()),
      ],
    );
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<CartCubit>.value(value: cartCubit),
          BlocProvider<ExchangeRateCubit>.value(value: rateCubit),
        ],
        child: MaterialApp.router(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: router,
        ),
      ),
    );
    // Frame by frame, not pumpAndSettle: while the first quote is pending the
    // summary's spinner never settles. The second frame runs the screen's
    // post-frame attach, which asks for the quote.
    await tester.pump();
    await tester.pump();
  }

  Finder onTile(String text) => find.descendant(of: find.byType(CartItemTile), matching: find.text(text));

  testWidgets('before the first quote the lines use the cached rate; once it lands, the rate of the quote', (tester) async {
    final firstQuote = holdFirstQuote();
    await pumpCart(tester);

    // No quote yet: the cached 1,000 SYP/$ - was 10,000, now 8,000, 2 units.
    expect(onTile('10,000 SYP'), findsOneWidget);
    expect(onTile('8,000 SYP'), findsOneWidget);
    expect(onTile('16,000 SYP'), findsOneWidget);

    // The server's quote, at 1,200 SYP/$ with a 4% platform discount.
    firstQuote.complete(serverQuote());
    await tester.pumpAndSettle();

    expect(onTile('12,000 SYP'), findsOneWidget, reason: 'the struck-through price, at the rate of the quote');
    expect(onTile('9,600 SYP'), findsOneWidget);
    expect(onTile('19,200 SYP'), findsOneWidget, reason: 'the line total');
    expect(onTile('8,000 SYP'), findsNothing);
    // And the lines add up to the summary, on the same rate.
    expect(tester.widget<Text>(find.byKey(const Key('cartSubtotal'))).data, '19,200 SYP');
    expect(tester.widget<Text>(find.byKey(const Key('cartTotal'))).data, '18,432 SYP');
  });

  testWidgets('it costs no extra request: one quote, and no rate read beyond the app load', (tester) async {
    final firstQuote = holdFirstQuote();
    await pumpCart(tester);
    firstQuote.complete(serverQuote());
    await tester.pumpAndSettle();

    verify(
      () => orderRepo.quoteCart(
        warehouseId: any(named: 'warehouseId'),
        items: any(named: 'items'),
        code: any(named: 'code'),
      ),
    ).called(1);
    verify(() => rateRepo.getExchangeRate()).called(1); // the setUp load, nothing more
    expect(rateCubit.state.usdToSyp, 1000, reason: 'the cached rate itself is left alone');
  });

  // The limits the screen reads when it opens (the setUp read failed, so it
  // re-reads).
  void warehouseLimits({num min = 0, num? max}) {
    when(() => warehouseRepo.getWarehouseProfile(any())).thenAnswer((_) async => _profile(min: min, max: max));
  }

  testWidgets('the minimum-order line and its hint move to the rate of the quote with everything else', (tester) async {
    // A $50 minimum against a $16 cart: $34 short.
    warehouseLimits(min: 50);
    final firstQuote = holdFirstQuote();
    await pumpCart(tester);
    await tester.pump(); // the limits read lands

    expect(find.text('Minimum order: 50,000 SYP'), findsOneWidget, reason: 'the cached rate, before any quote');
    expect(find.text('Add 34,000 SYP more to reach the minimum'), findsOneWidget);

    firstQuote.complete(serverQuote());
    await tester.pumpAndSettle();

    expect(find.text('Minimum order: 60,000 SYP'), findsOneWidget);
    expect(find.text('Add 40,800 SYP more to reach the minimum'), findsOneWidget);
    expect(find.text('Minimum order: 50,000 SYP'), findsNothing);
    // The subtotal it is measured against, on the same rate.
    expect(tester.widget<Text>(find.byKey(const Key('cartSubtotal'))).data, '19,200 SYP');
  });

  testWidgets('so do the maximum-order line and its hint', (tester) async {
    // A $10 maximum against a $16 cart.
    warehouseLimits(max: 10);
    final firstQuote = holdFirstQuote();
    await pumpCart(tester);
    await tester.pump();

    expect(find.text('Maximum order: 10,000 SYP'), findsOneWidget, reason: 'the cached rate, before any quote');
    expect(find.text('Over the 10,000 SYP maximum — remove some items'), findsOneWidget);

    firstQuote.complete(serverQuote());
    await tester.pumpAndSettle();

    expect(find.text('Maximum order: 12,000 SYP'), findsOneWidget);
    expect(find.text('Over the 12,000 SYP maximum — remove some items'), findsOneWidget);
    expect(find.text('Maximum order: 10,000 SYP'), findsNothing);
  });

  testWidgets("the server's minimum-order refusal quotes the limit at the rate of the quote too", (tester) async {
    // The app holds no limits (the reads fail); the server has a $50 minimum.
    when(
      () => orderRepo.submitOrder(
        warehouseId: any(named: 'warehouseId'),
        items: any(named: 'items'),
        notes: any(named: 'notes'),
        idempotencyKey: any(named: 'idempotencyKey'),
        rateUsed: any(named: 'rateUsed'),
        discountCode: any(named: 'discountCode'),
        discountCodeRevision: any(named: 'discountCodeRevision'),
      ),
    ).thenAnswer(
      (_) async => throw ServerFailure(
        'Order is below the minimum.',
        code: 'ORDER_BELOW_MINIMUM',
        details: {'minOrderAmountUsd': 50},
        statusCode: 400,
      ),
    );
    final firstQuote = holdFirstQuote();
    await pumpCart(tester);
    firstQuote.complete(serverQuote());
    await tester.pumpAndSettle();

    final submit = find.text('Submit order').first;
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Submit order')));
    await tester.pumpAndSettle();

    expect(find.text('The minimum order from this warehouse is 60,000 SYP.'), findsOneWidget);
    // The limit the refusal named is adopted, and its line agrees with it.
    expect(find.text('Minimum order: 60,000 SYP'), findsOneWidget);
    expect(find.textContaining('50,000'), findsNothing, reason: 'nothing on screen at the cached rate');
  });
}
