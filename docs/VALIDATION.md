# PANDORA validation record

PANDORA 0.1.0 is being built in a Linux cloud workspace. Windows-specific checks must be distinguished from Linux unit tests and browser tests. No gaming performance gains have been benchmarked.

## Test commands

- `npm test`: backend logic, input validation, settings persistence, Windows provider fixtures, reversible tweak journal, cleanup snapshots and accounting.
- `npm run typecheck`: all TypeScript source and tests.
- `npm run build`: renderer production bundle and Electron main/preload bundles.
- `npm run test:ui`: browser UI journeys with synthetic API responses confined to the tests. Requires Playwright Chromium; set `PANDORA_CHROMIUM` to an existing executable if needed.
- `npm run dist:win`: Windows x64 NSIS package. Successful cross-packaging is not a Windows launch/install validation.

## Windows validation

`tests/cleaner.windows.test.ts` exercises real native file deletion guards only against temporary disposable fixtures on Windows. It skips on Linux. It verifies stale vs recent files, personal extensions, hardlinks, junctions, identity changes, missing files and parent replacement. The workflow in `.github/workflows/windows.yml` executes these tests on Windows when run in GitHub Actions.

Before calling a release production-ready, verify native inventory, graphics counters, each catalog setting apply/read-back/restore, Explorer sign-out effects, user cancel and partial failure of Recycle Bin cleanup, browser cache behavior, per-user installation, relaunch and uninstall on an isolated Windows 11 machine. Test without administrator rights first. Never use the development host's actual settings as disposable fixtures.

Cleanup reports exact logical file sizes at scan time and logical bytes confirmed removed. Compression, allocation, locks, open handles and concurrent disk activity prevent an exact advance guarantee of physical free space recovered. The application explicitly distinguishes these quantities.

## Historical cloud checkpoint

- Fresh lockfile installation, TypeScript and production build passed.
- Backend: 78 passed, four Windows-only checks skipped. Browser journeys: nine passed.
- Five PowerShell scripts parsed; cleaner C# compiled and native structure layouts checked.
- Bundled Electron read-only smoke passed on Linux, with test-only headless/no-sandbox flags. This does not validate the OS sandbox or Windows APIs.
- Portable `PANDORA-Portable-0.1.0-x64.exe`: 100,768,019 bytes.
- SHA256: `aa0ad34b31a7984153c3eda96bcdd88a565672a8ff079f186c2d0392b7ee9a8c`.
- Outer NSIS archive and inner app-64.7z passed 7-Zip integrity checks. Embedded PANDORA.exe is AMD64/x64; the launcher is the normal x86 NSIS stub. Bundled application code/assets match the tested build; Electron and Chromium notices are present. Executables are unsigned.
- NSIS installer cross-build is blocked by the cloud Wine runtime failing to load its Windows system libraries. The incomplete output is not an installer download. Native Windows CI is configured but no remote CI result or Windows launch/install result has been verified here.

The checksum above identifies this checkpoint only. Rebuilt artifacts receive a new checksum sidecar.

## Historical portable test build — 2026-10-12

Source: `cffe3b4ba83b1cc70c0f982f284ee7777ba7cc93` (clean working tree at verification).

- Production build and 79 backend tests passed; four Windows-only tests skipped.
- All 12 Playwright journeys passed, including reviewed batch restoration and immediate hardware refresh. Restore page visually checked at 1280×720 with no horizontal overflow.
- PowerShell/C# syntax and layout checks passed. Real Electron read-only smoke passed on Linux after activating the environment proxy for its deferred runtime download.
- `scripts/verify-package.mjs --portable-only` passed archive integrity, x64 payload, tested source/assets and notice checks. It also correctly rejected the previous artifact when compared with the updated build.
- `PANDORA-Portable-0.1.0-x64.exe`: **100,768,651 bytes**.
- SHA256: `605e003d8eb768b9bc405b0539e4e9cab8c16413ca531a1ea68ecfaffb385666`. The launcher has no signing certificate.
- The adjacent `verification.json` records the source commit, checksum and validation limits.

Windows CI now builds both NSIS installer and portable, verifies artifacts, and runs a read-only launch check against the packaged desktop. Its remote outcome is **unverified**: this cloud environment's GitHub API connection returns an egress 403. Git pushes to the repository succeed. The local Wine bundle's missing kernel32.dll blocks the native installer generation step. A portable package is available; a completed Setup installer is not claimed.

Hardware-provider accuracy, Win32 cleanup guards, registry shell effects, Windows launch, and install/uninstall remain real Windows checks.

## Installer and portable build — 2026-10-12

The Wine blocker above is resolved: PANDORA now uses its own per-user NSIS installer script, generating the uninstaller at install time. Both compressed packages built successfully on Linux. The package verifier at clean commit `874229d` extracted **both** executables, checked archive integrity, validated the embedded x64 application, compared bundled code/assets against the production build, and checked licenses and the installer’s embedded uninstaller.

- Installer: `PANDORA-Setup-0.1.0-x64.exe`, **164,121,223 bytes**, SHA256 `f4dd7b50d16c76f0b6fcd9688eac568520828776134c4cdb299907e6713ec4bb`.
- Portable: `PANDORA-Portable-0.1.0-x64.exe`, **116,914,084 bytes**, SHA256 `2a8170d53521359256cd07d7a51ad31c2e4bf4a60514101d71c1220caf3d8f1d`.
- Backend: **89 passed**, four native Windows tests skipped locally. UI: **15 passed**. Production build, six PowerShell syntax checks, C# layout checks and read-only Linux Electron smoke passed.
- Both packages remain unsigned. Archive verification is not a Windows launch or installation result. `verification.json` deliberately records `windowsLaunchVerified: false` for these local artifacts.

Public GitHub Actions pages are accessible even though the API route is blocked. The Windows workflow's packaging failure is under investigation; it must be resolved before claiming the native build workflow passes. Hardware accuracy and physical-PC behavior remain manual validation gates even after CI succeeds.
