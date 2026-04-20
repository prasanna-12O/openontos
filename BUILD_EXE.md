# Building OpenOntos as a single Windows .exe

The goal: produce **one `OpenOntos.exe` file** you can email or share directly. New users just double-click it — no install, no folder, no zip.

## One-time setup (on your dev machine)

1. **Get the code locally** — click the GitHub button in Lovable, then `git clone` your repo.
2. Install [Node.js 20+](https://nodejs.org/).
3. In the project folder:
   ```bash
   npm install
   npm install --save-dev electron electron-builder
   ```

## Build the single .exe

```bash
npm run electron:build:win
```

Output: **`electron-release/OpenOntos.exe`** — a single ~150 MB self-contained file.

Send this one file to anyone. They double-click → app runs. No install required.

## Other build options

| Command | Output | Notes |
|---|---|---|
| `npm run electron:build:win` | `OpenOntos.exe` | **Single portable .exe** (recommended for sharing) |
| `npm run electron:build:win-installer` | `OpenOntos-Setup.exe` | Installer wizard, adds Start Menu shortcut |
| `npm run electron:build:mac` | `OpenOntos.dmg` | macOS installer |
| `npm run electron:build:linux` | `OpenOntos.AppImage` | Linux portable |

> **Cross-building from Mac/Linux to Windows works**, but `electron-builder` will download Wine on first run. Easiest: build on Windows.

## What the user sees

1. Receives `OpenOntos.exe` via email / Drive / etc.
2. Double-clicks it.
3. Windows SmartScreen may say *"Windows protected your PC"* (because the .exe isn't code-signed) → user clicks **More info → Run anyway**.
4. App opens. Their data is saved locally to `%APPDATA%/OpenOntos/`.

## Removing the SmartScreen warning

Buy a Windows code-signing certificate (~$100–300/yr, e.g. SSL.com, DigiCert) and add to `package.json` under `"build" → "win"`:
```json
"certificateFile": "cert.pfx",
"certificatePassword": "..."
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank white window | Confirm `vite.config.ts` has `base: './'` (already set) |
| `electron-builder` not found | Run `npm install --save-dev electron electron-builder` |
| Build hangs on Wine download | Run on a Windows machine instead |
| `.exe` is huge (~150 MB) | Normal — Electron bundles Chromium. Cannot be reduced significantly. |
