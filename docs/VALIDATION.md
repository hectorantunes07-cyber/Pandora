# PANDORA validation record

PANDORA 0.1.0 is being built in a Linux cloud workspace. Windows-specific checks must be distinguished from Linux unit tests and browser tests. No gaming performance gains have been benchmarked.

## Current Fortnite-display Windows test build — 2026-10-30

Application source: `501c28da7367a7ac71c5cf4eb658ff072b553971`. Later documentation commits do not change packaged runtime code.

- **335 backend tests passed on Linux; 15 Windows-only checks skipped there. All 48 UI journeys passed.** Production build, native script syntax/isolated fixtures and real Electron bridge/report/activity smoke passed. The game-control panel was visually inspected at desktop width; layout checks cover 1440, 1024 and 800 logical pixels.
- [Native Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/41036430165) passed all required stages at this exact source: real filesystem and process-query tests, existing disposable Windows controls/rollback, UI, installer/portable build, archive/source verification, unpacked/installed bridge checks, installation lifecycle and the actual portable launcher. These are isolated file round trips, not live Fortnite validation.
- New backend tests cover UTF-8 and UTF-16LE, formatting/unrelated-byte preservation, absent/duplicate/unsupported keys, bounds, real file replacement and exact originals, per-owned-value restoration after game-like unrelated changes, relaunch, stale/expired/replayed reviews, process start/refusal, journal failures, interrupted/unconfirmed writes, conflicts, location binding, read-only/hardlinked/junction paths and canonical Windows base aliases. Combined restoration and report privacy are checked separately.
- Windows CI exposed an overly strict raw-versus-canonical path comparison. The corrected guard accepts the trusted base's legitimate 8.3 alias while requiring the exact fixed configuration suffix and rejecting symbolic ancestors. A regression fixture was also normalized to Windows canonical paths. The final Windows workflow passes both fixes; earlier failed runs are retained in GitHub history.
- Controls edit existing FrameRateLimit, bUseVSync and bUseDynamicResolution values only. There is no Epic automation API, game injection, forced read-only setting, live reading or established FPS benefit. The current game release, rendering modes, cloud sync, updates and true concurrent-writer/power-loss scenarios require real-PC tests. Process checks do not lock another app's launch.
- Both local EXEs passed archive integrity, x64 payload, bundled-code and SHA256 verification at clean source. Their exact bytes were not launched on Windows; CI builds and launches separate bytes. Local windowsLaunchVerified stays false. Prior verified packages/kit remain at release/checkpoints/b987f87-before-fortnite-settings.
- PANDORA-Setup-0.1.0-x64.exe: **158,367,257 bytes**, SHA256 `5c8a97e8d896a5b9d200d889f80e45d79f63f92b8fe6afc53e5b95f538196cc2`.
- PANDORA-Portable-0.1.0-x64.exe: **111,596,180 bytes**, SHA256 `6afb3288d193d64f863fc47d088a22bc882a0e40ecf53b1a4964659ba45d3c19`.
- Overall full requested scope is approximately **90% implemented** by rough estimate. There are 27 Windows tuning/preference targets plus three Fortnite display preferences, not 30 proven FPS improvements. Broader GPU/network automation, app removal, sensor coverage, game automation/capture, signing/updating and physical-PC validation remain incomplete.

## Previous persistent-activity Windows test build — 2026-10-30

Application source: `b987f879ab55975f6a691be7616460695237edc3`. Later documentation commits do not change packaged runtime code.

- **303 backend tests passed on Linux; 14 Windows-only checks skipped there. All 46 UI journeys passed**, with the two activity journeys rerun after the final control styling. Production build and real Electron integration passed. The activity panel was visually inspected.
- [Native Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/41021036720) passed all required stages at this exact source: backend/native apply-restore checks, all 46 UI journeys, both package builds, archive/source verification, unpacked/installed launch, managed-report/activity integration, installer lifecycle and the actual portable self-extracting launcher. The installed lifecycle test verifies completed sign-in/app-setting events survive process relaunch. The packaged smoke verifies local-setting activity, report inclusion, clear preview and confirmed clearing through the actual preload bridge.
- Twelve new activity tests cover persistence, pending state before execution, interrupted sessions, partial batches, thrown/unconfirmed outcomes, picker cancellation, Recycle Bin failure with zero skipped files, malformed results, unreadable logs, final recording failure, retention/backup isolation, stale/expired/forged/replayed clearing, concurrency and persistent gap indication. Report tests verify activity redaction and unavailable-state handling.
- Activity uses a bounded separate activity-v1.json file and durable atomic writes. It retains the latest 500 events, protects currently running records from pruning/clearing, records discard/clear metadata, and refuses corrupt-file clearing. Recording failures do not change the underlying operation result or block rollback. Previously pending entries with no current operation are displayed as unconfirmed, never inferred successful.
- Only fixed action names, timestamps, status/counts and logical cleanup summaries are stored. Arguments, tokens, commands, filenames, paths and raw error/result payloads are excluded. It is an operation-level timeline from this implementation onward, not a reconstruction of older activity, third-party changes or every individual file result. Storage failures, retention and user clearing can leave gaps.
- Both local EXEs passed archive integrity, x64 payload, bundled-code and SHA256 verification at clean source. Their exact bytes were not launched on Windows; CI builds and launches separate bytes. Local windowsLaunchVerified stays false. Prior verified packages/kit are preserved at release/checkpoints/aac5863-before-activity-history.
- PANDORA-Setup-0.1.0-x64.exe: **158,350,218 bytes**, SHA256 `666b5d8afa38cd7404cefd6bcc15c6da26ebbad8d2b52f5e2b8c6eaaadaebfea`.
- PANDORA-Portable-0.1.0-x64.exe: **111,583,507 bytes**, SHA256 `b5553ce30b02bfeb1c4cc6e6d95b737a31754db1ef0388ed51b8c8516f40c412`.
- Overall requested scope is approximately **89% implemented** by rough estimate, with 27 tuning/preference targets. Activity is not another FPS tweak. Physical Windows sign-in/tray behavior, client restore-point creation/UAC, sensors, driver effects, power-loss/storage-failure scenarios and actual gaming benefits still require client/hardware validation. Broader unfinished features remain in FEATURES and WINDOWS-HANDOFF.

## Previous managed-report and portable-launch test build — 2026-10-30

Application source: `aac58630f5ac51c999a3026f0a1a25fdf36a3ed6`. Later documentation commits do not change packaged runtime code.

- **290 distinct backend cases passed locally** across the full suite and the focused cross-feature relaunch/export/restore integration rerun; 14 Windows-only checks skip on Linux. **All 44 UI journeys passed.** Production build and actual Linux Electron export integration passed, including native-dialog cancellation and schema-v2 file output.
- [Native Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/41015274494) passed all required stages at this exact source: backend/native apply-restore checks, all 44 UI journeys, both package builds, archive/source verification, unpacked/installed launch and report export, installer lifecycle, and the **actual portable self-extracting launcher**. The portable launches its own extracted app with an isolated profile; the test checks sandboxed preload, actual Windows inventory, cursor pixels, PC Cleaner navigation, disabled portable sign-in registration and clean launcher exit. No tuning or cleanup is performed by that portable test.
- Reports now include nine explicit sections: preference history, current preferences, preset ownership, power-plan backup, AC policies, launcher entries, pointer behavior, visual effects and normal cursor. Tests retain null versus zero, original values, conflicts, unavailable native readings, per-section errors and collection interval. A relaunch/export/restore integration verifies originals remain usable and export performs no native mutation.
- Only fixed fields and catalog labels are exported. Commands, local paths, cursor pixels, tokens, internal record IDs, custom plan names and raw provider errors are omitted. Invalid identities fail the section. collectionComplete describes collection success, not universal provider support. Current snapshots are not a complete chronological event log; the report cannot be imported to restore settings.
- Export waits behind PANDORA mutations, native save cancellation stops before collection, and the renderer prevents duplicate requests and refreshes review tokens afterward. External Windows changes remain possible during collection and are disclosed.
- Both local EXEs passed archive integrity, x64 payload, bundled-code comparison and SHA256 verification at clean source. Local `windowsLaunchVerified` remains false: these are cross-built bytes, while Windows CI builds and launches its own separate bytes. Prior packages/kit are preserved at `release/checkpoints/9bcbfab-before-managed-reports`.
- PANDORA-Setup-0.1.0-x64.exe: **158,341,304 bytes**, SHA256 `712adb4b382fbe3b3ca11c17840fcd4d7dd5056669e0a4c6a1d74f3185a5acd6`.
- PANDORA-Portable-0.1.0-x64.exe: **111,576,273 bytes**, SHA256 `7dc5b03674ea0356db815118a9fdd75cbd3877806795aec7a4fa8b66557904c5`.
- Overall implementation remains roughly **88% of the broad requested scope**, not a finished or signed public release. There are still 27 tuning/preference targets; report export and launcher verification do not add FPS tweaks. Actual Windows sign-in, tray presentation, client restore-point creation/UAC, physical sensors, driver effects and measured gaming benefits still need client/hardware testing.

## Previous startup-and-tray Windows test build — 2026-10-27

Application source: `9bcbfabb06a7e35d32bd12ef4eec59da49b50d11`. Later documentation commits do not change packaged runtime code.

- **283 backend tests pass on Linux; 14 Windows-only checks skip there. All 43 UI journeys pass.** Production build, native helper parsing/compilation and Linux Electron integration passed. The new Settings panel was visually inspected; its preference labels are at least 14px.
- [Native Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/40604270328) passed all required stages at this exact source, including existing native apply/restore checks, all 43 UI journeys, both package builds, archive/source verification, unpacked/installed app launch and the expanded installer lifecycle test. The portable self-extracting launcher still requires a Windows client launch check.
- The installed-app integration verified actual per-user Run registration, disable/re-enable, persistence across process relaunch, native tray window hide/reopen, explicit quit, matching-command cleanup on uninstall, preservation of an external replacement, and retained user data/unrelated files. It did not perform a Windows sign-out/in or visually certify the notification-area icon.
- Sign-in launch is off by default and restricted to a packaged executable matching the current-user installation record and marker. Requests use single-use five-minute review tokens, fresh state checks and read-back. Foreign entries, portable paths and stale reviews are refused. Windows StartupApproved values are not changed; unknown approval is distinct from enabled.
- Close-to-tray is optional and defaults off for old settings. Tray creation must succeed before enabling hidden-window behavior; explicit exit and second-instance reopening are supported. Active mutations block ordinary close/quit. Forced OS shutdown is not guaranteed graceful. Actual sign-in, Windows approval UI, Explorer restart and tray appearance remain physical-PC checks.
- Both local executables passed archive integrity, x64 payload, bundled-code comparison and SHA256 checks at clean runtime source. Local `windowsLaunchVerified` stays false because CI builds and launches separate bytes. The previous verified kit is retained at `release/checkpoints/b12930e-before-app-lifecycle`.
- PANDORA-Setup-0.1.0-x64.exe: **158,336,931 bytes**, SHA256 `06d944d5c513ed26022fcac0b188bf3b3de7c402c4f107322ae6ab5454f69751`.
- PANDORA-Portable-0.1.0-x64.exe: **111,572,711 bytes**, SHA256 `13e5cef3bec25f7b652e87a12b9d7385f738edd64b91e48ca788a1af27b07731`.
- Overall scope is roughly **88% implemented**, not a complete or signed public release. There remain 27 configurable tuning/preference targets; startup/tray controls are app behavior, not additional FPS tweaks. Client restore-point creation/UAC, physical sensors and actual performance effects still need Windows client/hardware testing. Remaining broader capabilities are listed in FEATURES and WINDOWS-HANDOFF.

## Previous drive-diagnostics Windows test build — 2026-10-27

Application source: `b12930e94dd45daced8ae3682b9168ba80f4cebc`. Later documentation commits do not change packaged runtime code.

- **268 backend tests pass on Linux; 14 Windows-only checks skip there. All 41 UI journeys pass.** Production build, native PowerShell parsing/runtime fixtures and the real Electron preload/read-only smoke passed. The rendered diagnostic cards were inspected, including large counters and a narrower viewport.
- [Native Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/40588307698) passed every required stage at this exact source, including real Windows physical-storage inventory/schema, existing disposable native apply/restore checks, all 41 UI journeys, both packages, archive verification, packaged launch and installer lifecycle/user-data preservation. Hosted storage-provider checks allow honest unavailable counters; **they do not certify physical SSD/HDD/controller sensor accuracy**.
- Storage diagnostics use fixed Get-PhysicalDisk/Get-StorageReliabilityCounter operations with bounded output, a 20-second execution limit and a 30-second cache. Requests coalesce. No storage-reliability query runs just from opening System Monitor; the explicit button or system report requests it. No elevation, remote session, self-test, reset, repair or disk configuration change is requested.
- Isolated native-script fixtures verify counter/device identity matching, ambiguous/missing responses, exact UInt64 strings, zero versus null, wear above 100, per-device errors, empty/denied inventory and the 32-device limit. Backend tests also check invalid data, caching, stale-success clearing, fixed executable arguments and privacy filtering. UI tests verify explicit reading, provider failure, cached labels, units, exact large integers and readable layout.
- New temperature/wear/error figures are provider-reported snapshots. Wear means estimated endurance used; zero or “Healthy” does not certify remaining life or error-free operation. Windows/driver permissions and USB/RAID/virtual devices may hide fields. No gaming performance gain has been measured.
- Both local executable archives pass x64 payload, bundled-code and SHA256 verification at clean runtime source. Their exact bytes are cross-built and not launched on Windows; `windowsLaunchVerified` stays false. CI builds and launches separate bytes. The previous verified kit is preserved at `release/checkpoints/7a0e69e-before-storage-readings`.
- PANDORA-Setup-0.1.0-x64.exe: **158,327,840 bytes**, SHA256 `efebe6d3c7f87d358456877e5c01d75aa2b8cb199ee2f23f9bfdf6b37bdabf58`.
- PANDORA-Portable-0.1.0-x64.exe: **111,565,651 bytes**, SHA256 `e23ccddfd34212cce06c45471621b124486b44d67c57787acbd2426ae71ab31a`.
- Overall scope remains approximately **87% implemented**, a rough estimate, with 27 configurable tuning/preference targets. This diagnostic is not another FPS tweak. Client restore-point creation/UAC, physical sensors/driver effects and the remaining master-spec features still need work/testing.

## Previous restore-point Windows test build — 2026-10-27

Application source: `7a0e69ebfc16d5e7af4c708d152771a2e587a19a`. Restore-point implementation was saved on October 14; this checkpoint completes verification and handoff after recovering an older cloud snapshot. No existing implementation or commit was replaced.

- **242 backend tests pass on Linux; 13 Windows-only checks skip there. All 39 UI journeys pass.** Production build, native script parsing/isolated runtime fixtures, native declaration compilation and the real Electron preload/read-only smoke passed in the recovered workspace.
- [Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38635250100) passed every required step at this exact source: native safety and apply/restore fixtures, 39 UI journeys, both packages, archive/source checks, packaged launch and install/uninstall with user-data preservation. The run completed on October 14 and its exact source/conclusions were checked again on October 27.
- The new Restore & History panel lists recent points and offers reviewed creation through a fixed, encoded Checkpoint-Computer helper. Only that operation requests UAC; the UI remains unelevated. The helper confirms a new sequence with the backend-generated description before reporting success. No-op/frequency limits, unreadable providers, timeout, stale tokens and cancellation cannot become a successful backup result. The helper console stays hidden while Windows retains its administrator prompt.
- Actual helper scripts passed isolated success, existing-point/no-op, Windows Server, unavailable-list, UAC-cancellation and missing-exit-code fixtures. **No real Windows 10/11 checkpoint or UAC prompt was exercised by these fixtures or hosted Server CI.** Client creation, policy behavior and visibility in System Protection remain mandatory physical/VM client tests. No protection/frequency policy is changed, and no restore point is deleted or restored by PANDORA.
- Both rebuilt local EXEs passed archive integrity, x64 payload, bundled-code comparison and checksums at clean source. Local bytes were not launched on Windows; `windowsLaunchVerified` remains false. CI built and launched separate artifacts from the same source. Never mix their checksums.
- PANDORA-Setup-0.1.0-x64.exe: **158,321,637 bytes**, SHA256 `1d157cf993ff7572855476f544f23fc467e6f567215db6d449f5e7da711562d1`.
- PANDORA-Portable-0.1.0-x64.exe: **111,560,709 bytes**, SHA256 `7c694d90bdf7870308b73820d82aee9f67c5d21a93066748da0c3277e1d52121`.
- The previous locally retained `537da29` packages/kit were preserved in `release/checkpoints/537da29-before-restored-latest`. Only the newest verified local kit is replaced, after ZIP CRC and embedded executable hashes pass.
- Broad requested scope is approximately **87% implemented**, a rough planning estimate rather than a release-certification score. There are still 27 configurable tuning/preference targets; checkpoints and diagnostics do not increase that count. Physical hardware/driver effects and broader unfinished capabilities remain explicit in FEATURES and WINDOWS-HANDOFF.

## Previous NVIDIA telemetry Windows test build — 2026-10-14

Application source: `ee2fbc9f8addf5d487bf26b83ff3747976857026`. Later documentation commits do not alter packaged runtime code.

- **230 backend tests pass on Linux; 13 Windows-only checks skip there.** The 37 interface journeys passed across the initial suite and targeted correction reruns; the full 37-test suite also passed in native Windows CI. Production build and the real Electron preload/read-only smoke passed.
- Added 19 telemetry tests for multi-GPU identities, MiB-to-byte conversion, zero versus unsupported values, malformed/oversized/impossible output, query coalescing/cache expiry, failure recovery, fixed paths/arguments, timeouts and unsupported platforms. The UI regression covers explicit readings, unavailable fields, stale-data clearing and memory units. Fixed a duplicate refresh request exposed by React strict-mode testing; cards were visually inspected.
- [Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38587202183) passed all required checks at this source, including existing native mutation/rollback tests, all UI journeys, both package builds, archive/source verification, packaged launch and installer lifecycle/data preservation. The smoke verifies the new telemetry bridge and honest unavailable handling; **it does not establish physical NVIDIA sensor accuracy**. The hosted runner has no representative NVIDIA GPU.
- NVIDIA telemetry executes only a fixed read-only query against installed Windows utility locations. It does not search PATH, download executables, change GPU settings, persist identifiers or continuously poll in the background. Cache interval is 15 seconds, execution timeout six seconds and output limit 32 KiB. Only per-device name/index, bounded sensor values, provider and timestamp are exported.
- Both local EXEs passed archive integrity, x64 payload, bundled-source comparison and SHA256 verification against clean source. Their exact bytes were not launched on Windows; `windowsLaunchVerified` remains false. CI built and launched separate packages from the same source.
- PANDORA-Setup-0.1.0-x64.exe: **158,314,055 bytes**, SHA256 `09f69f6f69ea2a21357f77a49cff4308ab3b7e3e97bac29bfe3cdb90a99a0ef3`.
- PANDORA-Portable-0.1.0-x64.exe: **111,555,053 bytes**, SHA256 `c857e55d2d914ed757dddf09b5e1fa85298963b968bdc3af8e5012b8d4709b9b`.
- Overall requested scope remains approximately **86% implemented**, not a certified release. The optimization library still has 27 configurable targets; telemetry is a diagnostic, not an extra tweak. NVIDIA driver/device comparison on the user's PC, missing utility/field behavior, multi-GPU mapping and sampling semantics remain physical-PC checks. CPU/AMD/Intel and fan sensors are unfinished.

## Previous advanced-power Windows test build — 2026-10-14

Application source: `f0f75781b041c38deac6de6d934e7bce20ae07e2`. Later documentation commits do not alter the packaged runtime.

- **211 backend tests passed on Linux; 13 Windows-only tests skipped there. All 36 UI journeys passed.** Production build, native C# compilation/PowerShell fixtures and the read-only Electron bridge smoke passed. The new cards were visually inspected in Electron.
- Six power controls use documented Windows SDK GUIDs and PowerReadACValueIndex/PowerWriteACValueIndex. Tests cover per-control relaunch/restore, stale review and plan changes, unsupported values, CPU bound constraints, corrupt journals, failed writes and refresh failures. Combined restoration relaxes CPU bounds before tightening them.
- [Native Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38536940358) passed at this exact source: disposable native power-plan checks alongside the existing preference/profile/pointer/visual/startup/cursor tests; all UI checks; portable and installer builds; archive verification; packaged launch; install/launch/uninstall and user-data preservation. The new test exercises available policies on a cloned disposable plan, requires at least three round trips, compares the final full power query to its baseline and restores the original active plan. Availability on the hosted runner does not certify every physical system's effective power behavior.
- Both local executable archives, x64 payloads, bundled files and checksums passed verification against a clean checkout. These exact cross-built bytes were not launched on Windows; `windowsLaunchVerified` stays false. CI separately builds and launches its own artifacts from the same source.
- PANDORA-Setup-0.1.0-x64.exe: **158,308,441 bytes**, SHA256 `808927c083eb36d6688ee264368103d504a5979d382543b6a8875dc770f88173`.
- PANDORA-Portable-0.1.0-x64.exe: **111,550,771 bytes**, SHA256 `ee40d59a87065260e6f90daa94ed8855c0fbbdaf08122270252c2ce216f6a177`.
- Approximately **86%** of the broader requested scope is implemented by rough estimate. Both packages remain unsigned. Physical-PC power policy effects, laptop battery isolation, OEM overrides, standard-account permissions, heat/noise and repeatable gaming results still need validation. Broader unfinished features remain explicit in FEATURES.md.

## Previous NVIDIA/cursor Windows test build — 2026-10-14

Application source: `756b79b2e88bd7fd0db4e7bb1aca761d5ef5269c`. Final documentation commits do not change packaged runtime code.

- **198 backend tests pass on Linux; 12 native-only checks skip there.** All **35 renderer journeys pass**, including NVIDIA search/scope/saving, cursor confirmation/cancellation/rollback, provider failure and readable scaled layouts.
- Production TypeScript/renderer/Electron build passes. PowerShell parsing and C# compilation pass. Real Electron smoke validates the sandboxed preload, actual inventory, supplied cursor metadata and packaged benchmark import. NVIDIA and cursor pages were visually inspected in Electron.
- [Native Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38522747218) **passed** at this exact source. Required steps include native cleaner fixtures; explicitly disposable registry/profile/power/startup/pointer/visual/cursor round trips; 35 UI journeys; both executable builds; archive/source verification; packaged launch; and installation/uninstallation with preserved user data.
- The cursor fixture uses the actual supplied file and verifies persistent Arrow configuration and exact original restoration after recreating the service. A Windows failure identified invalid cursor-reload flags; the verified implementation now uses SPI_SETCURSORS with zero flags. Failed reloads retain retryable backup ownership even if registry restoration already happened.
- Both local packages passed outer/inner archive integrity, x64 payload, bundled-file matching and SHA256 verification at a **clean** checkout. Their exact bytes are cross-built locally, so `windowsLaunchVerified` remains false in their manifest. Windows CI separately builds and launches its own packages from the same source.
- Installer: **158,293,776 bytes**, SHA256 `a48d983123ede8460a5461a317d2761b5a5ce2d8dd0fb980a471bde1dc8ea8ed`.
- Portable: **111,539,203 bytes**, SHA256 `c02a8e5ba6d71074310a399ad7369556d6006547dd885529733d1f3c08d1ad45`.
- Both remain unsigned. Actual reboot persistence, before/after pointer appearance, third-party cursor utilities, NVIDIA Control Panel launch on installed drivers, all display scaling levels and gaming effects still require physical-PC validation.
- Overall scope estimate: approximately **85%**, not a claim of complete specification or public-release certification. See FEATURES.md and WINDOWS-HANDOFF.md for missing capabilities.

## Previous expanded Windows test build — 2026-10-13

Application source: `537da29bad7fc2d27c612df7d5a4df3bcd581824`.

- Production build and **183 backend tests pass** on Linux; **11 native-only tests
  skip** there. All **31 UI journeys pass**; focused visual restore, graphics and
  minimum-viewport checks also pass after final layout polish.
- PowerShell syntax and C# declarations compile. Real Linux Electron smoke verifies
  hardware/renderer isolation, unavailable Windows guards and the visual-controls
  IPC bridge. Test-only container flags do not certify the production sandbox.
- Native [Windows run 39](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38457117035)
  passed the new backend at `40f991c`, including all seven visual API apply/relaunch/
  exact-restore round trips, existing registry/profile/power/pointer/startup tests,
  real cleanup guards, 31 UI journeys, package verification and installer lifecycle.
- Final packaged revision [Windows run 40](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38457487572)
  **passed** at exact application source `537da29`, including 31 UI journeys, all
  native tests and portable/installer build, launch and uninstall checks.
- Both local NSIS packages pass outer/inner archive integrity, x64 payload, matching
  bundled code/assets, third-party notice and checksum checks. These exact local
  bytes were cross-built; `windowsLaunchVerified` remains false. Native CI produces
  and launches its own packages from source; never mix their checksums.
- Local installer: 158,256,425 bytes; SHA256
  `d9c979e1835aaf0d274e0dd53ec2c7fa1d70b809cb38bb9574ed954b69aa3f37`.
- Local portable: 111,508,510 bytes; SHA256
  `5bf7175167c5e05ed313f8cbd4be894ed84c6194a129ff5fba103cc111dcdd75`.
- Unsigned development release. Physical GPU/display effects, hardware accuracy,
  standard-user policies, vendor compatibility, browser/Recycle Bin cleanup and
  actual gaming performance still require real-PC testing. Full specification is
  approximately 84% implemented by scope estimate; see FEATURES and WINDOWS-HANDOFF.

Everything below records earlier checkpoints and may describe limitations that
have since been resolved. The Wine installer blocker is historical: the current
custom NSIS installer builds without Wine and passes native lifecycle checks.

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
