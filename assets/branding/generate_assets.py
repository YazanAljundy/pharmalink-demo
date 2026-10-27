"""Regenerate neutral placeholder logos and icons without changing dimensions."""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP_ROOT = next(
    os.path.join(ROOT, name)
    for name in os.listdir(ROOT)
    if os.path.isfile(os.path.join(ROOT, name, "pubspec.yaml"))
)
NAVY = (14, 26, 44, 255)
LIGHT = (247, 247, 248, 255)
WHITE = (239, 243, 248, 255)


def is_brand_asset(path):
    name = os.path.basename(path).lower()
    parent = os.path.basename(os.path.dirname(path)).lower()
    return (
        name.startswith(("demo_logo", "demo_mark", "demo_icon", "demo-logo", "demo-mark"))
        or name == "ic_launcher.png"
        or name.startswith("icon-app-")
        or (parent == "icons" and name.startswith("icon-"))
        or name.startswith("favicon")
        or name == "apple-touch-icon.png"
    )


def make_placeholder(path):
    with Image.open(path) as original:
        width, height = original.size

    name = os.path.basename(path).lower()
    parent = os.path.basename(os.path.dirname(path)).lower()
    is_app_icon = (
        name == "ic_launcher.png"
        or name.startswith("icon-app-")
        or (parent == "icons" and name.startswith("icon-"))
        or name == "favicon.png"
    )
    is_light = "light" in name or name.startswith(("favicon-", "apple-touch-icon"))
    background = NAVY if is_app_icon else None
    foreground = WHITE if is_app_icon or not is_light else NAVY
    if name.startswith(("favicon-", "apple-touch-icon")):
        background = LIGHT

    image = Image.new("RGBA", (width, height), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    arm = max(1, round(min(width, height) * 0.2))
    span = max(arm, round(min(width, height) * 0.64))
    center_x, center_y = width // 2, height // 2
    half = span // 2
    draw.rectangle(
        (center_x - arm // 2, center_y - half, center_x + arm // 2, center_y + half),
        fill=foreground,
    )
    draw.rectangle(
        (center_x - half, center_y - arm // 2, center_x + half, center_y + arm // 2),
        fill=foreground,
    )
    image.save(path, "PNG", optimize=True)


def main():
    roots = [
        os.path.join(ROOT, "assets", "branding", "source"),
        os.path.join(APP_ROOT, "assets", "images"),
        os.path.join(APP_ROOT, "android", "app", "src", "main", "res"),
        os.path.join(APP_ROOT, "ios", "Runner", "Assets.xcassets", "AppIcon.appiconset"),
        os.path.join(APP_ROOT, "web"),
        os.path.join(ROOT, "web", "public"),
    ]
    written = []
    for directory in roots:
        if not os.path.isdir(directory):
            continue
        for current, _, filenames in os.walk(directory):
            for filename in filenames:
                path = os.path.join(current, filename)
                if filename.lower().endswith(".png") and is_brand_asset(path):
                    make_placeholder(path)
                    written.append(path)
    for path in written:
        with Image.open(path) as image:
            print(f"{os.path.relpath(path, ROOT)} {image.width}x{image.height}")
    print(f"{len(written)} neutral placeholder assets written.")


if __name__ == "__main__":
    main()
