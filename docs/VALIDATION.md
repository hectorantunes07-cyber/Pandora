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

## Earlier installer and portable build — 2026-10-12

The Wine blocker above is resolved: PANDORA now uses its own per-user NSIS installer script, generating the uninstaller at install time. Both compressed packages built successfully on Linux. The package verifier at clean commit `874229d` extracted **both** executables, checked archive integrity, validated the embedded x64 application, compared bundled code/assets against the production build, and checked licenses and the installer’s embedded uninstaller.

- Installer: `PANDORA-Setup-0.1.0-x64.exe`, **164,121,223 bytes**, SHA256 `f4dd7b50d16c76f0b6fcd9688eac568520828776134c4cdb299907e6713ec4bb`.
- Portable: `PANDORA-Portable-0.1.0-x64.exe`, **116,914,084 bytes**, SHA256 `2a8170d53521359256cd07d7a51ad31c2e4bf4a60514101d71c1220caf3d8f1d`.
- Backend: **89 passed**, four native Windows tests skipped locally. UI: **15 passed**. Production build, six PowerShell syntax checks, C# layout checks and read-only Linux Electron smoke passed.
- Both packages remain unsigned. Archive verification is not a Windows launch or installation result. `verification.json` deliberately records `windowsLaunchVerified: false` for these local artifacts.

The initial native packaging failures were resolved: NSIS needs Windows-style include separators, and artifact-only builds must explicitly disable electron-builder's implicit publishing. Public GitHub Actions pages are accessible even though the API route is blocked.

### Native Windows workflow passed

[Windows run 15](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38303810161), source `8ee591f`, completed successfully. Its required steps cover:

- Type checking, native-script parsing/C# compilation, unit tests and all 15 UI journeys.
- Three actual Win32 cleaner fixture tests: stale-file removal/accounting, personal/recent/hardlink/junction protection, changed/missing/replaced files and ancestor replacement/out-of-root rejection.
- Explicit disposable-account registry apply, read-back, service reopening and exact restoration.
- Both Windows package builds, full archive/payload verification and checksums.
- Packaged desktop launch with the secure bridge, no renderer Node access, real Windows CIM CPU/volume inventory and OS memory readings.
- Per-user installation, installed desktop launch, shortcut/registration verification, uninstall and preservation of application data and an unrelated file.
- Artifact upload with the native validation manifest and testing instructions.

This is evidence from a GitHub-hosted Windows runner, not representative physical hardware or a standard-account Windows 11 certification. It does not verify every preference's visible shell effect, sensor accuracy, optional browser/Recycle Bin cleanup, interactive installer choices or all upgrade paths. Those remain manual gates.

A final review also corrected network adapter inventory to read the numeric CIM `TransmitLinkSpeed`, rather than the formatted `LinkSpeed` display property. The actual inventory PowerShell script now has a runtime fixture covering this regression, extended aggregation and numeric serialization. Updated package identities and the latest native run are recorded below.

## Historical adapter-corrected Windows test packages

Application source: `33df09c`. [Windows run 16](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38304399308) passed the complete workflow with the adapter correction, including installation, installed launch, uninstall, data preservation and artifact upload. Later commits add verification fixtures and documentation without changing the packaged application.

The current locally cross-built files are:

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| `PANDORA-Setup-0.1.0-x64.exe` | 164121368 | `aa71a4c8b2e84ae05581827586799ba8ad19bfcde13a9d1e7b52106f0e120e8d` |
| `PANDORA-Portable-0.1.0-x64.exe` | 116914172 | `5cb604978e102625d769ccb0368299c2dd0d5b4b2f971de671981895ccff2e24` |

The adjacent manifest records archive extraction and code comparison against the current production output. Local package hashes differ from native CI package hashes; use only the matching sidecars. The local manifest does not claim these exact cross-built bytes were executed on Windows. Use the successful CI artifact for packages built and launched by the Windows runner.

## Historical recommendations and scaling build — Windows testing ready

Application and packaging source: `a65d6a9`. [Windows run 28](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38335432899) completed successfully with the final configuration. All 17 UI journeys passed, along with type checking, native syntax/runtime fixtures, backend checks, five real Win32 cleaner safety cases, the opt-in registry roundtrip, both package builds and verification, actual desktop hardware/bridge launch, installed launch, uninstall and data preservation. The browser-cache test preserves password/cookie/history fixtures, and the exclusive-lock test confirms zero deleted bytes with a reported failure.

Local validation: 93 backend tests passed, six native cases skipped on Linux. Seventeen distinct browser journeys were validated, including scaled compact navigation. The real Linux desktop smoke and native-script/runtime fixture checks passed. Local archives were extracted, their x64 payloads and bundled code/assets compared with the tested production output, licenses checked, and installer/portable checksums generated from a clean working tree.

| Current local artifact | Bytes | SHA256 |
| --- | ---: | --- |
| `PANDORA-Setup-0.1.0-x64.exe` | 158199987 | `ea284fbbe42a099879acd311020d21a8924ffc17ea673703f2fc765b734b91e8` |
| `PANDORA-Portable-0.1.0-x64.exe` | 111462380 | `3ee8bbd522b0767d2279aaddeb5d0982c523ba53ee9b1a0a4aca73d1476b7dec` |

The final file list contains 85 owned files instead of 4489, because already bundled UI dependencies are excluded from distribution. An attempted solid-compression change exceeded the builder's four-minute compiler budget; the final build uses the standard compressor and passes both local and Windows builds without modifying the tool timeout.

`verification.json` identifies the exact local files and keeps `windowsLaunchVerified: false`: these cross-built bytes were archive-verified, while the successful Windows runner built and launched its own artifacts from the same source. Download that run's `PANDORA-Windows-x64-unsigned` artifact for native-built files and their native validation manifest. The local Windows test kit includes both local executables, sidecars, manifest, CI evidence and guides. Hashes from different builds are not interchangeable.

This is a Windows test handoff, not complete implementation of the entire master specification or production certification. Physical hardware accuracy, every preference's visible Windows effect, interactive/standard-account installation and upgrade paths, optional Recycle Bin behavior and broader machine compatibility still need manual testing. Missing features are listed separately in WINDOWS-HANDOFF.md and FEATURES.md.


## Current frame-analysis build — Windows testing ready

Application source: `d345c7a00c8c54b2f75f13a96e40d1a94bf6166e`. [Windows run 30](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38337985591) passed all required checks and uploaded `PANDORA-Windows-x64-unsigned`. All **20 interface journeys** passed. Native cleaner safety fixtures, disposable registry apply/exact restoration, hardware CIM reads, packaged desktop launch, sandboxed file-capture import, installer launch/uninstall and user-data preservation passed. These are hosted-runner results, not physical-PC certification.

Local validation: production/typecheck passed; **122 backend tests passed, six Windows-only tests skipped**. All 19 earlier interface journeys plus the new snapshot/reload/clear journey passed; the three affected benchmark journeys were rerun after configuration snapshots were added. The real Linux desktop smoke passed with hardware reads and the disposable capture import. Parser tests cover exact formulas, retained stalls, stream identity, malformed and bounded input; context tests cover fixed-schema privacy and condition changes.

Both local archives were extracted, integrity checked, and compared against the built application from a clean source tree. Embedded application architecture is x64; the NSIS launcher stub is x86. Both packages are unsigned.

| Current local artifact | Bytes | SHA256 |
| --- | ---: | --- |
| `PANDORA-Setup-0.1.0-x64.exe` | 158204303 | `a956a13854594a7c70cae966ecf6f5e10465c873b6663cab406e4fbef5d8a3bb` |
| `PANDORA-Portable-0.1.0-x64.exe` | 111465994 | `5d699e01b7e09149e32c606d0888d8cd5100ef530509dcbcfb05ee5e0534b849` |

`verification.json` intentionally keeps `windowsLaunchVerified: false` for the exact local cross-built executables. `windows-ci-evidence.json` links the successful native build of the same source. Native artifact hashes may differ; always use the sidecar supplied with your downloaded file. The local test-kit ZIP bundles both executables, sidecars, evidence, scope and Windows testing instructions. Earlier builds remain in `release/checkpoints/`.

Full-spec completion remains approximately **74%** (planning estimate). Core implementation is ready for controlled Windows testing. Missing advanced actions, broader hardware/sensor support, full game presets, Windows restore points, signing/updating and physical-PC validation remain separate unfinished requirements. Imported frame intervals and configuration snapshots provide evidence for comparisons; no FPS improvement or input-latency measurement is claimed.
