const bool kDemoMockApi = bool.fromEnvironment(
  'DEMO_MOCK_API',
  defaultValue: true,
);
const bool kDemoAutoLogin = bool.fromEnvironment(
  'DEMO_AUTO_LOGIN',
  defaultValue: true,
);
const String kDemoPhone = String.fromEnvironment(
  'DEMO_PHONE',
  defaultValue: '0900000004',
);
const String kDemoPassword = String.fromEnvironment(
  'DEMO_PASSWORD',
  defaultValue: 'Demo@12345',
);

// Override at build/run time with:
// flutter run --dart-define=API_BASE_URL=http://localhost:5000/api
// The Android emulator uses 10.0.2.2 to reach the host machine. For a
// physical device or another platform, pass the machine's LAN IP, for example
// --dart-define=API_BASE_URL=http://192.168.1.10:5000/api.
class AppConfig {
  const AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5000/api',
  );
}
