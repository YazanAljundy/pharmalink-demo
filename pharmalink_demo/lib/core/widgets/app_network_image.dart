import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:pharmalink_demo/config/app_config.dart';

import '../constants/app_colors.dart';
import '../utils/cloudinary_image.dart';

enum AppImageKind {
  generic,
  product,
  warehouse,
  manufacturer,
  banner,
  advertisement,
}

/// The one way the app loads a remote image.
///
/// Responsibilities:
///  * **Cache** - on-disk + in-memory via [CachedNetworkImage]; the same URL
///    is downloaded once per device, then served from cache (including when
///    it appears in several widgets at once).
///  * **Right-sizing** - for Cloudinary URLs, rewrites the URL to fetch a
///    version scaled to the widget's real painted size (device pixels), and
///    caps the decoded bitmap with `memCacheWidth`/`memCacheHeight` so an
///    80x80 thumbnail never keeps a 4000px bitmap in RAM. Non-Cloudinary
///    URLs are still cached and decode-capped, just not URL-rewritten.
///  * **Offline demo support** - `asset:` URLs load from the bundled assets;
///    remote URLs in mock mode render a generated local placeholder.
///  * **Graceful failure** - a 404 / dead URL / no connection or missing asset
///    never reaches the user as an exception or Flutter's broken-image glyph.
///
/// Pass [fallback] to override the empty/error widget, or [fallbackIcon] to
/// just change its glyph. Pass [borderRadius] to have the image (and its
/// placeholders) clipped without an extra `ClipRRect` at the call site.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.fallbackIcon,
    this.placeholderKind = AppImageKind.generic,
    this.placeholderSeed,
    this.fallback,
    this.borderRadius,
    this.crop = false,
    this.demoMockApi,
  });

  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final IconData? fallbackIcon;
  final AppImageKind placeholderKind;
  final String? placeholderSeed;
  final Widget? fallback;
  final BorderRadius? borderRadius;

  /// Cloudinary crop strategy: `false` = `c_limit` (keep aspect ratio),
  /// `true` = `c_fill` (crop to the exact box). See [cloudinaryOptimizedUrl].
  final bool crop;
  final bool? demoMockApi;

  // Upper bounds so an unbounded / buggy layout constraint can never turn
  // into a request for (or a decode of) a giant image. 1400 logical px covers
  // a full-width image on the largest tablet; 2400 device px caps the decoded
  // bitmap regardless of pixel ratio.
  static const double _maxTargetLogicalPx = 1400;
  static const int _maxTargetDevicePx = 2400;

  // Shown for missing/remote demo images and failed loads.
  Widget _emptyState(BuildContext context, {String? seed}) {
    if (fallback != null) return fallback!;
    final theme = Theme.of(context);
    final stableSeed = seed ?? placeholderSeed ?? url ?? placeholderKind.name;
    final seedColor = _seedColor(context, stableSeed);
    final iconColor = AppColors.textOf(context).withValues(alpha: 0.72);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.alphaBlend(
              seedColor.withValues(
                alpha: theme.brightness == Brightness.dark ? 0.25 : 0.15,
              ),
              AppColors.surfaceElevatedOf(context),
            ),
            Color.alphaBlend(
              AppColors.primaryOf(context).withValues(
                alpha: theme.brightness == Brightness.dark ? 0.18 : 0.10,
              ),
              AppColors.surfaceOf(context),
            ),
          ],
        ),
      ),
      alignment: Alignment.center,
      child: Icon(
        fallbackIcon ?? _iconForKind,
        color: iconColor,
        size: _iconSize(context),
      ),
    );
  }

  IconData get _iconForKind => switch (placeholderKind) {
    AppImageKind.generic => Icons.image_not_supported_outlined,
    AppImageKind.banner || AppImageKind.advertisement => Icons.image_outlined,
    AppImageKind.product => Icons.medication_outlined,
    AppImageKind.warehouse => Icons.storefront_outlined,
    AppImageKind.manufacturer => Icons.factory_outlined,
  };

  double _iconSize(BuildContext context) {
    final shortestSide = MediaQuery.sizeOf(context).shortestSide;
    if (width != null && height != null) {
      return ((width! < height! ? width! : height!).clamp(20, 64) * 0.42)
          .toDouble();
    }
    return (shortestSide * 0.12).clamp(24, 56).toDouble();
  }

  static Color _seedColor(BuildContext context, String seed) {
    var hash = 0x811c9dc5;
    for (final unit in seed.codeUnits) {
      hash ^= unit;
      hash = (hash * 0x01000193) & 0xffffffff;
    }
    final palette = [
      AppColors.primaryOf(context),
      AppColors.secondaryOf(context),
      AppColors.brandOrangeLight,
      AppColors.brandOrangeDeep,
      AppColors.navyOf(context),
    ];
    return palette[hash % palette.length];
  }

  String? _assetPath(String value) {
    final path = value.substring('asset:'.length);
    if (path.isEmpty || path.startsWith('/') || path.contains('..')) {
      return null;
    }
    return 'assets/$path';
  }

  // Shown while the image is in flight - a calm neutral block, no spinner and
  // no animation (a grid can hold dozens of these at once, and once cached
  // they never appear at all).
  Widget _loadingState(BuildContext context) => Container(
    width: width,
    height: height,
    color: AppColors.surfaceOf(context),
  );

  Widget _clip(Widget child) {
    if (borderRadius == null) return child;
    return ClipRRect(borderRadius: borderRadius!, child: child);
  }

  @override
  Widget build(BuildContext context) {
    final trimmed = url?.trim() ?? '';
    if (trimmed.isEmpty) return _clip(_emptyState(context));

    if (trimmed.startsWith('asset:')) {
      final assetPath = _assetPath(trimmed);
      if (assetPath == null) return _clip(_emptyState(context, seed: trimmed));
      return _clip(
        Image.asset(
          assetPath,
          fit: fit,
          width: width,
          height: height,
          errorBuilder: (context, error, stackTrace) =>
              _emptyState(context, seed: trimmed),
        ),
      );
    }

    if (demoMockApi ?? kDemoMockApi) {
      return _clip(_emptyState(context, seed: placeholderSeed ?? trimmed));
    }

    final dpr = MediaQuery.devicePixelRatioOf(context);

    return _clip(
      LayoutBuilder(
        builder: (context, constraints) {
          final logicalW = _resolveExtent(width, constraints.maxWidth);
          final logicalH = _resolveExtent(height, constraints.maxHeight);

          final targetW = _devicePx(logicalW, dpr);
          final targetH = _devicePx(logicalH, dpr);

          final resolvedUrl = cloudinaryOptimizedUrl(
            trimmed,
            width: targetW,
            height: targetH,
            crop: crop,
          );

          // Decode cap. Cloudinary's `w_`/`h_` already right-sized the bytes;
          // this is the belt-and-suspenders cap for non-Cloudinary URLs.
          //  * crop (c_fill): the image is meant to exactly fill the box, so
          //    both dims are safe to pin.
          //  * no crop (c_limit): only ever pin ONE dimension - passing both
          //    targetWidth+targetHeight to the decoder stretches to that exact
          //    box, ignoring aspect ratio. One dimension scales proportionally.
          final int? memW;
          final int? memH;
          if (crop && targetW != null && targetH != null) {
            memW = targetW;
            memH = targetH;
          } else {
            memW = targetW ?? targetH;
            memH = null;
          }

          return CachedNetworkImage(
            imageUrl: resolvedUrl,
            fit: fit,
            width: width,
            height: height,
            // Advertise WebP so Cloudinary's f_auto actually serves it (the
            // Dart HTTP client sends no image Accept header by default).
            httpHeaders: const {'Accept': 'image/webp,image/*;q=0.8'},
            memCacheWidth: memW,
            memCacheHeight: memH,
            fadeInDuration: const Duration(milliseconds: 200),
            placeholder: (context, _) => _loadingState(context),
            errorWidget: (context, _, __) =>
                _emptyState(context, seed: trimmed),
          );
        },
      ),
    );
  }

  /// Prefers an explicit finite extent; otherwise a finite layout constraint;
  /// otherwise null (apply no size hint). Everything is clamped so a stray
  /// unbounded/huge constraint can't request an oversized image.
  static double? _resolveExtent(double? explicit, double constraint) {
    if (explicit != null && explicit.isFinite && explicit > 0) {
      return explicit.clamp(1.0, _maxTargetLogicalPx);
    }
    if (constraint.isFinite && constraint > 0) {
      return constraint.clamp(1.0, _maxTargetLogicalPx);
    }
    return null;
  }

  static int? _devicePx(double? logical, double dpr) {
    if (logical == null) return null;
    return (logical * dpr).round().clamp(1, _maxTargetDevicePx);
  }
}
