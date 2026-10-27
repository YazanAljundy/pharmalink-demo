import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pharmalink_demo/features/auth/presentation/managers/auth_cubit.dart';
import 'package:pharmalink_demo/features/auth/presentation/managers/auth_state.dart';
import 'package:pharmalink_demo/features/auth/presentation/views/demo_auto_login_gate.dart';

class _MockAuthCubit extends MockCubit<AuthState> implements AuthCubit {}

void main() {
  late _MockAuthCubit authCubit;

  setUp(() {
    authCubit = _MockAuthCubit();
    when(() => authCubit.startDemoSession()).thenAnswer((_) async {});
    when(() => authCubit.retryDemoLogin()).thenAnswer((_) async {});
  });

  Future<void> pumpGate(WidgetTester tester, AuthState state) async {
    when(() => authCubit.state).thenReturn(state);
    await tester.pumpWidget(
      MaterialApp(
        home: BlocProvider<AuthCubit>.value(
          value: authCubit,
          child: const DemoAutoLoginGate(
            child: Scaffold(body: Text('PHARMACY HOME')),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('a signed-in demo session shows the pharmacy home', (
    tester,
  ) async {
    await pumpGate(
      tester,
      const AuthState(sessionStatus: SessionStatus.active),
    );

    expect(find.text('PHARMACY HOME'), findsOneWidget);
    expect(find.text('Login'), findsNothing);
    verify(() => authCubit.startDemoSession()).called(1);
  });

  testWidgets('failed demo sign-in shows its error and Retry', (tester) async {
    await pumpGate(
      tester,
      const AuthState(
        sessionStatus: SessionStatus.demoLoginFailed,
        errorMessage: 'API is unavailable',
      ),
    );

    expect(find.text('API is unavailable'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    verify(() => authCubit.retryDemoLogin()).called(1);
  });
}
