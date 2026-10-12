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

Final measured outcomes and artifact checksums are recorded in the release report after the build.
