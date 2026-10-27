import 'package:flutter/material.dart';

import '../extensions/build_context_extensions.dart';

/// Neutral placeholder mark in the variant suited to its background.
///
/// Light and dark variants keep the mark legible on either surface. Three
/// constructors cover the cases the app actually has:
///
///  * [BrandLogo] follows the active theme.
///  * [BrandLogo.onDark] selects the light mark for dark surfaces.
///  * [BrandLogo.mark] selects the compact symbol for tight spaces.
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.width, this.height})
    : _variant = _Variant.themed,
      _markOnly = false;

  /// For surfaces that are dark regardless of the active theme.
  const BrandLogo.onDark({super.key, this.width, this.height})
    : _variant = _Variant.silver,
      _markOnly = false;

  /// Compact symbol for tight slots such as app bars and avatars.
  const BrandLogo.mark({super.key, this.width, this.height, bool onDark = false})
    : _variant = onDark ? _Variant.silver : _Variant.themed,
      _markOnly = true;

  final double? width;
  final double? height;
  final _Variant _variant;
  final bool _markOnly;

  @override
  Widget build(BuildContext context) {
    final silver = switch (_variant) {
      _Variant.silver => true,
      _Variant.themed => context.isDarkMode,
    };
    final name = _markOnly ? 'demo_mark' : 'demo_logo';
    final tone = silver ? 'dark' : 'light';

    return Image(
      image: AssetImage('assets/images/${name}_$tone.png'),
      width: width,
      height: height,
      fit: BoxFit.contain,
    );
  }
}

enum _Variant { themed, silver }
