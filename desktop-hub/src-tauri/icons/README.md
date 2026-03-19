# App icons

Generate all required icons from the project favicon (run from repo root):

```bash
npm run tauri icon ../public/favicon.svg
```

Or from this directory:

```bash
cd ../.. && npm run tauri icon public/favicon.svg
```

This creates `32x32.png`, `128x128.png`, `icon.ico`, `icon.icns`, etc., in this folder.
