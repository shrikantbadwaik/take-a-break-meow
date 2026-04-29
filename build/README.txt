Icons for electron-builder
===========================

Windows (Microsoft Store / MSIX)
--------------------------------
Add: icon.ico — multi-size ICO (256px recommended as largest).

macOS
-----
Add: icon.png — at least 512×512 (1024×1024 preferred).

Until these exist, `npm run dist` may warn or use defaults. Replace the
placeholder strings in package.json under `build.win` and `build.msix` with
values from Microsoft Partner Center before publishing to the Store.
