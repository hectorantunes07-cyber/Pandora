# PANDORA — Created by Sonnier

PANDORA is a local Windows desktop utility with a purple-and-black interface,
hardware diagnostics, live resource monitoring, explicit Windows preference
changes, a rollback journal, and a preview-first PC Cleaner. It does not require
an account, collect analytics, or promise FPS improvements.

This is an initial **0.1.0 development release**. The implementation and tests
are useful, but the native Windows flows require validation on real Windows
hardware before broad distribution. See [FEATURES.md](FEATURES.md) for the exact
scope and [the Windows validation checklist](docs/windows-validation.md) for
the remaining release gates. An unsigned installer is not a verified-publisher
release.

## Technical choice

Electron, React, TypeScript, and Vite provide a dependable desktop build pipeline
and a responsive UI in this environment. Electron's larger footprint is a
conscious tradeoff for mature Windows distribution and testable TypeScript
services. The renderer is sandboxed, has no Node access, and communicates through
an explicit typed IPC allowlist. Windows operations live in the main process.
Fixed native scripts call Windows APIs; the renderer cannot send arbitrary shell
commands or registry paths. Details are in [architecture.md](docs/architecture.md).

## Prerequisites and development

- Windows 11 x64 is the primary target. Windows 10 behavior is best effort and
  depends on the installed APIs, OS build, and organizational policy.
- Use Node.js 22 LTS or newer supported LTS and npm. The committed lockfile pins
  the dependency tree.
- A normal user account is sufficient for the implemented per-user preferences.
  Do not launch the whole application as administrator.

```powershell
npm ci
npm run dev
```

The dev launcher builds the main/preload scripts, starts a loopback-only Vite
server, and launches Electron. React changes hot reload. Restart `npm run dev`
after changing Electron services. `npm run dev:web` provides a browser UI
preview: it cannot access Windows or perform system actions, and it labels that
limitation explicitly. Production binaries use only bundled local resources.

```powershell
npm run typecheck
npm test
npx playwright install chromium
npm run test:ui
npm run build
npm start
```

The unit suite uses temporary filesystem fixtures and injected registry
adapters. It never tunes the development host. Passing these tests does not
establish real Windows API compatibility. Browser tests verify UI behavior;
they are separate from native desktop testing.

The Windows workflow additionally opts into `tests/tweaks.windows.test.ts` with
`PANDORA_TEST_WINDOWS_TWEAKS=1` on its disposable hosted runner. That check changes
and restores one real per-user preference. Keep that opt-in off on your daily
PC; it is not needed for development.

## Build a Windows installer

Run from a Windows machine after installing dependencies:

```powershell
npm run dist:win
Get-FileHash .\release\PANDORA-Setup-0.1.0-x64.exe -Algorithm SHA256
```

Expected output: `release/PANDORA-Setup-0.1.0-x64.exe`, an NSIS per-user installer
with a start-menu shortcut, desktop shortcut, uninstaller, original icon, and
PANDORA/Sonnier metadata. `release/win-unpacked/PANDORA.exe` is an unpacked build;
keep its neighboring files with it. Build the single-file portable executable with
`npm run dist:portable`; output is `release/PANDORA-Portable-0.1.0-x64.exe`.
The portable package has been cross-built and integrity checked, but still needs
a Windows launch test. The Windows workflow uploads artifacts without publishing
a release.

The artifact path above is a build output contract, not proof that an installer
has been produced. Consult [docs/VALIDATION.md](docs/VALIDATION.md) for the
recorded build outcome. Linux cross-packaging can require Wine for Windows
resource editing. A local `npm run dist:linux` build is useful for UI testing;
Windows preferences and cleanup remain unavailable there.

No signing certificate or automatic updater is configured. Publisher metadata
does not constitute signing. For public distribution, the owner must choose a
source license, review dependency notices, validate Windows behavior, and set up
trusted code signing. Do not disable Windows security controls to run PANDORA.

## First use and recovery

1. Open **System Monitor** to review detected devices and unavailable providers.
2. Open an optimization, review its exact target and tradeoffs, then confirm the
   selected changes. A durable original-value snapshot precedes every write.
3. Open **Restore & History** to inspect results and
   restore PANDORA-managed changes. A successful setting write is not evidence of
   an FPS improvement. Retest a comparable game workload yourself.
4. Open **PC Cleaner**, choose **Scan & Clean**, review categories and measured
   candidate bytes, then confirm. Browser cache and Recycle Bin are separate
   opt-in flows. Recycle Bin emptying covers all current items across drives and
   retains the Windows confirmation. Locked or changed files are skipped and
   reported. Cleanup is
   irreversible and is not covered by preference backups.

PANDORA stores settings and its rollback journal in Electron's per-user
application-data directory, normally `%APPDATA%\PANDORA` on Windows. The journal
is `backups\tweaks-v1.json`; settings are `settings.json`. Preserve the entire
directory when backing up. Do not edit the journal or delete it while changes
remain applied. PANDORA refuses to overwrite a later external preference change;
a conflict needs manual review of the saved original and actual Windows setting.

Before uninstalling, revert changes you no longer want from inside PANDORA.
Uninstalling does not revert Windows preferences and leaves user data in place,
so a later installation can still find the rollback history. Preference backups
are not Windows System Restore points or file backups.

## Troubleshooting

- **No native data in a browser:** launch the Electron app with `npm run dev` or
  the installed application. A web page cannot access this native API.
- **Unknown or missing hardware fields:** sensor and driver providers vary.
  Missing temperatures or GPU load are shown as unavailable, not estimated.
- **A setting is unavailable, blocked, or unchanged:** Windows policies and
  versions can override preferences. The operation is verified by rereading its
  stored value; review the history message. No security bypass is attempted.
- **A cleanup file was skipped:** close the app using it and rescan. Do not grant
  broad extra privileges or delete system folders manually.
- **Backup cannot be written:** free space in the application-data volume and
  check the current user's access. PANDORA stops before changing a preference if
  its original state cannot be saved.
- **Electron cannot open on Linux:** a graphical session and Chromium runtime
  libraries are required. A Linux UI check is not Windows integration validation.

## Repository map

| Location | Purpose |
| --- | --- |
| `src/` | React pages, UI state, components, styles, browser fallback |
| `shared/types.ts` | Typed renderer-to-desktop contract |
| `electron/` | Desktop lifecycle, allowlisted IPC, system services, cleanup and rollback |
| `tests/` | Isolated unit, safety and UI checks |
| `build/` | Original editable SVG, PNG/ICO assets, installer text |
| `scripts/` | Development launcher, Electron bundling, icon generation |
| `docs/` | Architecture, validation status and Windows release checklist |
| `.github/workflows/windows.yml` | Reproducible Windows build and unsigned artifact upload |

Regenerate icon assets with `bash scripts/generate-icons.sh` where Inkscape and
ImageMagick are installed. The ICO contains 16, 24, 32, 48, 64, 128 and 256 px
images. No competitor imagery is shipped. Source licensing is **UNLICENSED**
pending the owner's decision; see [LICENSE](LICENSE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Additional integration checks

`node scripts/check-native-syntax.mjs` parses the fixed PowerShell queries and
compiles the cleaner’s C# declarations without invoking Windows APIs. It needs
PowerShell (`powershell.exe` on Windows or `pwsh` elsewhere); set `PANDORA_PWSH` to
an explicit executable path when necessary. This catches syntax errors, not
Windows runtime compatibility.

After `npm run build`, `node scripts/smoke-desktop.mjs` opens the bundled desktop
interface and checks the real preload bridge and read-only hardware service.
It never applies tweaks or deletes files. In an isolated Linux container only,
`PANDORA_CONTAINER_SMOKE=1` uses headless Chromium test flags including
`--no-sandbox`; those flags are never part of the normal app, installer or
development launcher. Such a test does not validate Chromium’s OS sandbox.
