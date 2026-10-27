# Demo placeholder assets

Logo and icon PNGs use a simple medical-cross placeholder and retain their
existing dimensions. To regenerate them, run from the repository root:

```powershell
python assets/branding/generate_assets.py
```

The generator locates the Flutter app by its `pubspec.yaml`, so it does not
depend on the app folder name.
