import 'package:flutter/material.dart';
import 'package:pharmalink_demo/core/constants/app_radius.dart';
import 'package:pharmalink_demo/core/widgets/app_network_image.dart';

// A manufacturer's logo, with a stable local placeholder when no logo exists.
class ManufacturerAvatar extends StatelessWidget {
  const ManufacturerAvatar({
    super.key,
    required this.name,
    this.id,
    this.logoUrl,
  });

  final String name;
  final String? id;
  final String? logoUrl;

  static const List<Color> _palette = [
    Color(0xFF2E7D6B),
    Color(0xFF3B6FB6),
    Color(0xFFB5543A),
    Color(0xFF7A4FA3),
    Color(0xFFC08A1E),
    Color(0xFF3A8F3E),
    Color(0xFFB83B6B),
    Color(0xFF4A7C8C),
  ];

  static Color colorFor(String seed) {
    var hash = 0x811c9dc5;
    for (final unit in seed.codeUnits) {
      hash ^= unit;
      hash = (hash * 0x01000193) & 0xffffffff;
    }
    return _palette[hash % _palette.length];
  }

  static String initialOf(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return '?';
    return String.fromCharCode(trimmed.runes.first).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return AppNetworkImage(
      url: logoUrl,
      fit: BoxFit.contain,
      borderRadius: AppRadius.medium,
      placeholderKind: AppImageKind.manufacturer,
      placeholderSeed: id ?? name,
    );
  }
}
