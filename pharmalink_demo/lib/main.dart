import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pharmalink_demo/core/network/api_client.dart';
import 'package:pharmalink_demo/core/services/app_update_service.dart';
import 'package:pharmalink_demo/core/services/fcm_service.dart';
import 'package:pharmalink_demo/core/services/remote_config_service.dart';
import 'package:pharmalink_demo/core/services/secure_storage_service.dart';
import 'package:pharmalink_demo/core/services/storage_service.dart';
import 'package:pharmalink_demo/core/session/session_scope.dart';
import 'package:pharmalink_demo/features/app_update/presentation/app_update_gate.dart';
import 'package:pharmalink_demo/core/theme/dark_theme.dart';
import 'package:pharmalink_demo/core/theme/light_theme.dart';
import 'package:pharmalink_demo/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:pharmalink_demo/features/auth/presentation/managers/auth_cubit.dart';
import 'package:pharmalink_demo/features/advertisements/data/repositories/advertisements_repository.dart';
import 'package:pharmalink_demo/features/advertisements/data/repositories/advertisements_repository_impl.dart';
import 'package:pharmalink_demo/features/account_history/data/repositories/savings_repository.dart';
import 'package:pharmalink_demo/features/account_history/data/repositories/savings_repository_impl.dart';
import 'package:pharmalink_demo/features/banners/data/repositories/banners_repository.dart';
import 'package:pharmalink_demo/features/banners/data/repositories/banners_repository_impl.dart';
import 'package:pharmalink_demo/features/banners/presentation/managers/banners_cubit.dart';
import 'package:pharmalink_demo/features/cart/data/repositories/order_repository.dart';
import 'package:pharmalink_demo/features/cart/data/repositories/order_repository_impl.dart';
import 'package:pharmalink_demo/features/cart/presentation/managers/cart_cubit.dart';
import 'package:pharmalink_demo/features/catalog/data/repositories/catalog_repository.dart';
import 'package:pharmalink_demo/features/catalog/data/repositories/catalog_repository_impl.dart';
import 'package:pharmalink_demo/features/complaints/data/repositories/complaint_repository.dart';
import 'package:pharmalink_demo/features/complaints/data/repositories/complaint_repository_impl.dart';
import 'package:pharmalink_demo/features/debts/data/repositories/debt_repository.dart';
import 'package:pharmalink_demo/features/debts/data/repositories/debt_repository_impl.dart';
import 'package:pharmalink_demo/features/exchange_rate/data/repositories/exchange_rate_repository.dart';
import 'package:pharmalink_demo/features/exchange_rate/data/repositories/exchange_rate_repository_impl.dart';
import 'package:pharmalink_demo/features/exchange_rate/presentation/managers/exchange_rate_cubit.dart';
import 'package:pharmalink_demo/features/notifications/data/repositories/notification_repository.dart';
import 'package:pharmalink_demo/features/notifications/data/models/notification_model.dart';
import 'package:pharmalink_demo/features/offers/data/repositories/offers_repository.dart';
import 'package:pharmalink_demo/features/offers/data/repositories/offers_repository_impl.dart';
import 'package:pharmalink_demo/features/notifications/presentation/managers/notification_cubit.dart';
import 'package:pharmalink_demo/features/returns/data/repositories/return_repository.dart';
import 'package:pharmalink_demo/features/returns/data/repositories/return_repository_impl.dart';
import 'package:pharmalink_demo/features/reviews/data/repositories/review_repository.dart';
import 'package:pharmalink_demo/features/reviews/data/repositories/review_repository_impl.dart';
import 'package:pharmalink_demo/features/settings/presentation/managers/settings_cubit.dart';
import 'package:pharmalink_demo/features/settings/presentation/managers/settings_state.dart';
import 'package:pharmalink_demo/features/warehouse_selection/data/repositories/warehouse_repository.dart';
import 'package:pharmalink_demo/features/warehouse_selection/data/repositories/warehouse_repository_impl.dart';
import 'package:pharmalink_demo/features/warehouse_selection/presentation/managers/warehouse_selection_cubit.dart';
import 'package:pharmalink_demo/generated/app_localizations.dart';
import 'package:pharmalink_demo/routes/app_router.dart';
import 'package:pharmalink_demo/routes/route_paths.dart';
import 'package:pharmalink_demo/config/app_config.dart';
import 'package:pharmalink_demo/core/demo/demo_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kDemoMockApi) {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    } catch (error, stackTrace) {
      debugPrint('Firebase is unavailable; continuing without push: $error');
      debugPrintStack(stackTrace: stackTrace);
    }
  }

  final prefs = await SharedPreferences.getInstance();
  final storageService = StorageService(prefs);
  if (kDemoMockApi) await DemoStore.instance.initialize();

  final initialState = await _loadInitialSettings(storageService);

  // Update checker (Firebase Remote Config). initialize() only sets config +
  // defaults and activates already-fetched values - it never blocks startup
  // and never hits the network; the once-a-day fetch happens later, inside
  // AppUpdateGate, behind AppUpdateService's own 24h gate.
  final remoteConfigService = RemoteConfigService();
  if (!kDemoMockApi) await remoteConfigService.initialize();
  final appUpdateService = AppUpdateService(
    remoteConfigService: remoteConfigService,
    storageService: storageService,
    currentVersion: await _currentAppVersion(),
  );

  final secureStorage = SecureStorageService();
  final apiClient = ApiClient(secureStorage: secureStorage);
  final authRepository = AuthRepositoryImpl(apiClient: apiClient);
  final notificationRepository = NotificationRepository(storageService);
  if (kDemoMockApi) {
    await notificationRepository.clear();
    for (final notification in DemoStore.instance.notifications) {
      await notificationRepository.add(
        NotificationModel.fromJson(notification),
      );
    }
    DemoStore.instance.onNotification = (notification) {
      unawaited(
        notificationRepository.add(NotificationModel.fromJson(notification)),
      );
    };
  }
  // What a sign-out resets, besides the inbox: shared by AuthCubit (which
  // triggers it) and every member below that registers itself.
  final sessionScope = SessionScope();
  final fcmService = FcmService(
    authRepository: authRepository,
    notificationRepository: notificationRepository,
    sessionScope: sessionScope,
  );
  final warehouseRepository = WarehouseRepositoryImpl(apiClient: apiClient);
  final catalogRepository = CatalogRepositoryImpl(
    apiClient: apiClient,
    sessionScope: sessionScope,
  );
  final exchangeRateRepository = ExchangeRateRepositoryImpl(
    apiClient: apiClient,
  );
  final orderRepository = OrderRepositoryImpl(apiClient: apiClient);
  final savingsRepository = SavingsRepositoryImpl(apiClient: apiClient);
  final returnRepository = ReturnRepositoryImpl(apiClient: apiClient);
  final complaintRepository = ComplaintRepositoryImpl(apiClient: apiClient);
  final reviewRepository = ReviewRepositoryImpl(apiClient: apiClient);
  final debtRepository = DebtRepositoryImpl(apiClient: apiClient);
  final bannersRepository = BannersRepositoryImpl(apiClient: apiClient);
  final advertisementsRepository = AdvertisementsRepositoryImpl(
    apiClient: apiClient,
  );
  final offersRepository = OffersRepositoryImpl(apiClient: apiClient);
  final appRouter = AppRouter();
  runApp(
    MyApp(
      initialState: initialState,
      storageService: storageService,
      appUpdateService: appUpdateService,
      secureStorage: secureStorage,
      authRepository: authRepository,
      warehouseRepository: warehouseRepository,
      catalogRepository: catalogRepository,
      exchangeRateRepository: exchangeRateRepository,
      orderRepository: orderRepository,
      savingsRepository: savingsRepository,
      returnRepository: returnRepository,
      complaintRepository: complaintRepository,
      reviewRepository: reviewRepository,
      debtRepository: debtRepository,
      bannersRepository: bannersRepository,
      advertisementsRepository: advertisementsRepository,
      offersRepository: offersRepository,
      notificationRepository: notificationRepository,
      fcmService: fcmService,
      sessionScope: sessionScope,
      appRouter: appRouter,
    ),
  );
}

// The installed app version ("1.0.0"), build metadata dropped. Guarded so a
// platform-channel failure here can never stop PharmaLink Demo from starting - an
// empty string just means the update checker does nothing.
Future<String> _currentAppVersion() async {
  try {
    return (await PackageInfo.fromPlatform()).version;
  } catch (_) {
    return '';
  }
}

Future<SettingsState> _loadInitialSettings(
  StorageService storageService,
) async {
  const defaultThemeMode = ThemeMode.system;
  final storedTheme = storageService.getString('settings.theme_mode');
  final storedLocale = storageService.getString('settings.locale');

  ThemeMode themeMode = defaultThemeMode;
  if (storedTheme != null) {
    switch (storedTheme) {
      case 'light':
        themeMode = ThemeMode.light;
        break;
      case 'dark':
        themeMode = ThemeMode.dark;
        break;
      case 'system':
      default:
        themeMode = ThemeMode.system;
        break;
    }
  }

  final locale = storedLocale != null && storedLocale.isNotEmpty
      ? Locale(storedLocale)
      : null;

  return SettingsState(themeMode: themeMode, locale: locale);
}

class MyApp extends StatelessWidget {
  const MyApp({
    required this.initialState,
    required this.storageService,
    required this.appUpdateService,
    required this.secureStorage,
    required this.authRepository,
    required this.warehouseRepository,
    required this.catalogRepository,
    required this.exchangeRateRepository,
    required this.orderRepository,
    required this.savingsRepository,
    required this.returnRepository,
    required this.complaintRepository,
    required this.reviewRepository,
    required this.debtRepository,
    required this.bannersRepository,
    required this.advertisementsRepository,
    required this.offersRepository,
    required this.notificationRepository,
    required this.fcmService,
    required this.sessionScope,
    required this.appRouter,
    super.key,
  });

  final SettingsState initialState;
  final StorageService storageService;
  final AppUpdateService appUpdateService;
  final SecureStorageService secureStorage;
  final AuthRepositoryImpl authRepository;
  final WarehouseRepository warehouseRepository;
  final CatalogRepositoryImpl catalogRepository;
  final ExchangeRateRepository exchangeRateRepository;
  final OrderRepositoryImpl orderRepository;
  final SavingsRepositoryImpl savingsRepository;
  final ReturnRepositoryImpl returnRepository;
  final ComplaintRepositoryImpl complaintRepository;
  final ReviewRepositoryImpl reviewRepository;
  final DebtRepositoryImpl debtRepository;
  final BannersRepositoryImpl bannersRepository;
  final AdvertisementsRepositoryImpl advertisementsRepository;
  final OffersRepositoryImpl offersRepository;
  final NotificationRepository notificationRepository;
  final FcmService fcmService;
  final SessionScope sessionScope;
  final AppRouter appRouter;
  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<CatalogRepository>.value(value: catalogRepository),
        RepositoryProvider<OrderRepository>.value(value: orderRepository),
        RepositoryProvider<SavingsRepository>.value(value: savingsRepository),
        RepositoryProvider<ReturnRepository>.value(value: returnRepository),
        RepositoryProvider<ComplaintRepository>.value(
          value: complaintRepository,
        ),
        RepositoryProvider<ReviewRepository>.value(value: reviewRepository),
        RepositoryProvider<WarehouseRepository>.value(
          value: warehouseRepository,
        ),
        RepositoryProvider<ExchangeRateRepository>.value(
          value: exchangeRateRepository,
        ),
        RepositoryProvider<DebtRepository>.value(value: debtRepository),
        RepositoryProvider<BannersRepository>.value(value: bannersRepository),
        // Read by the shared package -> cart flow to re-fetch a tapped package
        // before it reaches the cart (advertisement_cart_launcher.dart), and
        // by the Offers & Ads tab to list what is running.
        RepositoryProvider<AdvertisementsRepository>.value(
          value: advertisementsRepository,
        ),
        RepositoryProvider<OffersRepository>.value(value: offersRepository),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(
            create: (context) => SettingsCubit(
              storageService: storageService,
              initialState: initialState,
            ),
          ),
          BlocProvider(
            create: (context) => AuthCubit(
              authRepository: authRepository,
              secureStorage: secureStorage,
              fcmService: fcmService,
              notificationRepository: notificationRepository,
              sessionScope: sessionScope,
            ),
          ),
          // Global, but reset on every sign-out through sessionScope - they
          // hold the signed-in pharmacy's warehouse list and cart.
          BlocProvider(
            create: (context) => WarehouseSelectionCubit(
              warehouseRepository: warehouseRepository,
              sessionScope: sessionScope,
            ),
          ),
          BlocProvider(
            create: (context) => CartCubit(
              orderRepository: orderRepository,
              warehouseRepository: warehouseRepository,
              sessionScope: sessionScope,
            ),
          ),
          BlocProvider(
            create: (context) => ExchangeRateCubit(
              exchangeRateRepository: exchangeRateRepository,
              // Remembers the last rate so prices still render in SYP when
              // the app opens offline - see the cubit's own comments.
              storageService: storageService,
            ),
          ),
          BlocProvider(
            create: (context) =>
                BannersCubit(bannersRepository: bannersRepository),
          ),
          BlocProvider(
            create: (context) =>
                NotificationCubit(repository: notificationRepository),
          ),
        ],
        // Audit P5: revalidate the session when the app is brought back to
        // the foreground after being backgrounded. Placed inside the provider
        // scope so it can reach AuthCubit; throttling + "only when it matters"
        // logic lives in AuthCubit.revalidateOnResume.
        child: _SessionLifecycleObserver(
          child: AppUpdateGate(
            service: appUpdateService,
            isAppShellReady: () {
              try {
                return appRouter
                        .router
                        .routerDelegate
                        .currentConfiguration
                        .uri
                        .path !=
                    RoutePaths.splash;
              } catch (_) {
                return true;
              }
            },
            child: Builder(
              builder: (context) => BlocBuilder<SettingsCubit, SettingsState>(
                builder: (context, state) {
                  // TEMP DIAGNOSTIC (router-lifecycle) - remove after verifying.
                  debugPrint(
                    'ROUTER_DEBUG: MyApp build/rebuild - '
                    'locale=${state.locale?.languageCode ?? 'null'} '
                    'themeMode=${state.themeMode.name} '
                    'router=#${identityHashCode(appRouter.router)}',
                  );
                  return MaterialApp.router(
                    themeMode: state.themeMode,
                    darkTheme: DarkTheme.data,
                    // Stable instance created once in main() - NOT `AppRouter().router`,
                    // which builds a brand-new GoRouter (resetting navigation to the
                    // splash route) on every SettingsCubit rebuild.
                    routerConfig: appRouter.router,
                    debugShowCheckedModeBanner: false,
                    theme: LightTheme.data,
                    locale: state.locale,
                    localizationsDelegates: const [
                      AppLocalizations.delegate,
                      GlobalMaterialLocalizations.delegate,
                      GlobalWidgetsLocalizations.delegate,
                      GlobalCupertinoLocalizations.delegate,
                    ],
                    supportedLocales: AppLocalizations.supportedLocales,
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// Watches the OS app-lifecycle and asks AuthCubit to re-check the session
// when the app returns from the background (audit P5), and re-reads the
// exchange rate if it has gone stale while the app was away
// (ExchangeRateCubit.isStale / kExchangeRateTtl - moved in from a listener
// the cubit used to own itself, so there is one place watching app-resume,
// not two). Only a full backgrounding -> resume round trip counts, so a
// brief permission dialog / camera / app-switcher glance does not trigger a
// network call; AuthCubit adds its own time-based throttle on top and never
// signs the user out on a resume network failure, and refreshIfStale is
// itself the 'only when it matters' gate for the rate.
//
// 'A full round trip' means the app actually reached
// AppLifecycleState.paused, not just that the previous callback happened to
// report it: per Flutter's own transition graph (see
// AppLifecycleListener.didChangeAppLifecycleState in the framework),
// [AppLifecycleState.resumed] is only ever reached FROM
// [AppLifecycleState.inactive] (or [AppLifecycleState.detached]) - never
// directly from [AppLifecycleState.paused]. The real backgrounding round
// trip is paused -> hidden -> inactive -> resumed, so the state immediately
// before every resumed event is inactive, always - whether the app was
// truly backgrounded or just glanced away from for a moment. A naive
// "was the previous state paused?" check can therefore never be true, on
// any device, under any circumstance - the two calls below did not fire on
// a real resume event before this was found and fixed here. [_wasPaused]
// instead remembers whether [AppLifecycleState.paused] was reached at any
// point since the last resume, which is exactly the 'was truly backgrounded'
// signal the check was meant to capture.
class _SessionLifecycleObserver extends StatefulWidget {
  const _SessionLifecycleObserver({required this.child});

  final Widget child;

  @override
  State<_SessionLifecycleObserver> createState() =>
      _SessionLifecycleObserverState();
}

class _SessionLifecycleObserverState extends State<_SessionLifecycleObserver>
    with WidgetsBindingObserver {
  bool _wasPaused = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _wasPaused = true;
      return;
    }
    if (state != AppLifecycleState.resumed || !_wasPaused) return;
    _wasPaused = false;
    context.read<AuthCubit>().revalidateOnResume();
    // Pick up any notification the FCM background isolate saved while the
    // app was away, so the badge is right the moment the user is back.
    context.read<NotificationCubit>().refresh();
    context.read<ExchangeRateCubit>().refreshIfStale();
    // Same idea for the cart's order-size limits, if a cart happens to be
    // open (CartCubit.refreshLimitsIfStale is itself a no-op with no
    // warehouse bound, so this is safe to call unconditionally too).
    context.read<CartCubit>().refreshLimitsIfStale();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
