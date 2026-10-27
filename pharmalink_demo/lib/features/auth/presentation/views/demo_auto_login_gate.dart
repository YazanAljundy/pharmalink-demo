import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:pharmalink_demo/features/auth/presentation/managers/auth_cubit.dart';
import 'package:pharmalink_demo/features/auth/presentation/managers/auth_state.dart';

class DemoAutoLoginGate extends StatefulWidget {
  const DemoAutoLoginGate({required this.child, super.key});

  final Widget child;

  @override
  State<DemoAutoLoginGate> createState() => _DemoAutoLoginGateState();
}

class _DemoAutoLoginGateState extends State<DemoAutoLoginGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AuthCubit>().startDemoSession();
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) {
        switch (state.sessionStatus) {
          case SessionStatus.active:
          case SessionStatus.offline:
            return widget.child;
          case SessionStatus.demoLoginFailed:
          case SessionStatus.pendingApproval:
          case SessionStatus.blocked:
            return Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        state.errorMessage ?? 'Could not sign in to the demo.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: state.isSubmitting
                            ? null
                            : () => context.read<AuthCubit>().retryDemoLogin(),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          case SessionStatus.unknown:
          case SessionStatus.unauthenticated:
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
        }
      },
    );
  }
}
