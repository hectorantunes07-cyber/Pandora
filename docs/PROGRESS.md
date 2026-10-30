# Development checkpoints

## Initial saved implementation

Completed source modules: Electron main/preload boundary; typed application API; real hardware and process providers; reversible registry preference engine; guarded Windows temporary-file/browser-cache/Recycle Bin cleaner; React dashboard and feature pages; backend and browser test sources; Windows packaging configuration and CI workflow.

This checkpoint preserves the interrupted implementation. The React entry point references `src/styles.css`, which has not yet been written. It is not a release build. The next stage is to complete interface styling, run typecheck/build/browser tests, then verify the scanner and cleaner integration and create the Windows package.

Earlier Linux backend run: 62 passed, 4 Windows-only checks skipped. Additional review tests have since been added and need a new run. Windows APIs and the installer have not been validated on Windows. No production-readiness or gaming performance claims are made.

## Stage 1 — working interface

Added the complete responsive purple/black stylesheet, retained existing application logic, corrected packaged logo paths and restoration-history controls, and made navigation scroll reset deterministic.

Validation on Linux: TypeScript and production renderer/Electron build passed; six Playwright browser journeys passed; backend suite passed 78 tests with four native Windows checks skipped. Browser tests use explicitly synthetic adapters only in test code. Runtime screenshots were inspected.

Next: validate native-script syntax and scanner/cleaner desktop integration, then package and verify the Windows artifact.

## Stage 2 — scanner and cleaner integration

Added native PowerShell parsing, C# compilation and Win32 structure-layout checks; corrected the file-disposition Boolean layout and excluded files marked as Windows system files. Added a desktop close guard during cleanup/settings mutations so results are not lost by a normal close action. Added scanner rendering/export, failed-scan and keyboard-confirmation UI coverage.

Validation: 78 backend tests passed, four native Windows checks skipped; nine browser journeys passed; production build passed. The bundled Electron desktop read actual Linux CPU/RAM through the preload bridge and rejected Windows cleanup on Linux. This isolated container smoke used test-only headless/no-sandbox flags; normal application sandbox configuration remains enabled. Five PowerShell scripts parsed and the native C# declarations/Win32 structure sizes compiled and checked without invoking Windows APIs.

Windows hardware/provider behavior, actual cleanup, and install/uninstall remain Windows validation requirements. Next stage: build the unsigned Windows installer and verify its artifact and contents.

## Stage 3 — verified portable checkpoint

Built the unsigned portable Windows x64 executable and verified both archive layers, embedded architecture, bundled files, notices and SHA256. Added a dedicated portable build command and corrected obsolete installer schema metadata. A fresh locked dependency install, production build and backend suite passed again.

The NSIS installer configuration is retained; Linux Wine cannot complete its final uninstaller-generation step. Use the Windows workflow for the native installer build. Real Windows launch, install/uninstall and native behavior remain unverified. See VALIDATION.md for artifact identity and measured results.

## Stage 4 — fresh inventory and reviewed batch restoration

Hardware refresh now bypasses the 30-second cache while concurrent readers share the new scan. The monitor displays the inventory timestamp and labels OS-usable memory accurately. Restore & History now previews all active saved originals, restores newest first after confirmation, and keeps every partial/conflict result visible. Cleaner result wording distinguishes skipped files from unconfirmed outcomes after interruption.

Validation: production build passed; 79 backend tests passed with four Windows-only checks skipped; all 12 browser journeys passed, including cancellation before applying, reviewed batch rollback, busy close/Escape guards, external conflicts and refreshed storage readings.

## Stage 5 — current Windows test package

Windows workflow now builds both portable and installer on Node 24, validates archive contents and checksums, launches the packaged desktop for a read-only smoke check, and uploads both artifacts plus a source/verification manifest. Added a Windows quick start and reproducible package verifier. Verified the rebuilt portable against clean source cffe3b4 and assembled a portable test kit with its checksum, manifest and Windows instructions.

Current cloud result: 79 backend checks passed, four Windows checks skipped; 12 browser journeys passed; native script syntax/layout and Linux desktop smoke passed. Portable archive checks passed. Windows CI results and real Windows behavior remain unverified. The local installer cannot finish because the supplied Wine runtime lacks kernel32.dll. See VALIDATION.md for current artifact identity.

Next Windows stage: run the portable read-only first, compare inventory with Windows tools, test controlled temporary-file cleanup and one preference apply/restore, then run the full Windows release checklist and collect the native Actions results. Keep all settings/history in place for rollback.

## Stage 6 — installer build repaired and fuller diagnostics

Replaced the Wine-dependent installer generation with a conventional per-user NSIS setup that creates its uninstaller during installation. Uninstall removes an exact generated list of packaged files and only empty directories, retaining application data and unrelated files. Added manifest tests and a disposable Windows install/launch/uninstall integration script. Reproduced and corrected the build pipeline's missing installer language-table failure; the complete electron-builder NSIS integration now produces an executable locally.

Added physical disk model/media/bus/health, network adapter inventory/link rate, installed RAM, device type and boot timestamp. Added a Network Diagnostics page with fixed-destination, user-initiated ICMP sampling and honest loss/jitter accounting. Sidebar navigation scrolls independently so creator branding and settings remain visible at the minimum window height.

Validation for this stage: production build passed; 89 backend tests passed with four Windows-only tests skipped locally; all 15 browser journeys passed. Six PowerShell scripts parsed, cleaner C# layouts compiled, installer integration script parsed, and real Linux Electron read-only smoke passed. Native Windows installation results are pending the new workflow run.

## Stage 7 — native Windows pipeline passing

Corrected NSIS include path separators and disabled electron-builder's implicit release publishing. Windows runs 15 and 16 passed the full pipeline: native cleanup fixtures, disposable registry apply/restore, interface tests, both package builds and archive verification, actual packaged hardware/bridge launch, installed launch, uninstall, and preservation of application data and unrelated files. Build artifacts include checksums, validation evidence and testing guides.

Corrected adapter speed collection to use numeric CIM transmit rates instead of a formatted display property. Added a runtime fixture for the actual inventory PowerShell script and extra Windows-only browser-cache and exclusive-lock cleanup tests. Both additional native safety tests passed in the final Windows workflow.

Both updated local packages have been built. `docs/VALIDATION.md` identifies their hashes, native workflow evidence and remaining manual gates. `docs/WINDOWS-HANDOFF.md` separates implemented functionality, unfinished master-spec scope and the user's Windows checklist. The broader master specification remains approximately 70% implemented; the core test build is not a signed production release.

## Stage 8 — scanner reliability, recommendations and distribution polish

An intermittent native inventory failure surfaced in Windows run 21 while all interface tests passed. Bounded cold inventory scans now have a 45-second budget, with distinct timeout/execution/response diagnostics that do not leak arbitrary process errors. Windows run 22 passed the complete workflow after that change. The hardware smoke still requires real Windows CIM inventory rather than accepting fallback readings.

Implemented a typed, read-only recommendations engine and dashboard panel for measured disk space, memory pressure, reported storage warnings, display review, unavailable GPU driver data and eligible Game Mode review. Each recommendation gives its evidence and limits and opens a review page; it never automatically changes settings. Windows run 23 passed with all 16 interface journeys.

Window geometry now respects logical work-area sizes for display scaling, while headless/remote 1-pixel placeholder displays use a usable fallback. A 960×640 navigation/cleaner confirmation journey passed. The real Linux desktop smoke passed after accounting for the hidden responsive navigation button.

Packaging excludes duplicate React/icon modules already bundled into the production code while retaining dependency notices and exact owned-file uninstall. The packaged file list decreased from 4489 to 85 entries. Final package integrity passed, and Windows run 28 passed the full workflow with all 17 UI journeys. See VALIDATION.md for exact hashes and scope. Scope remains approximately 72% of the broader master specification; missing advanced actions and physical-PC validation are listed separately in WINDOWS-HANDOFF.md.


## Stage 9 — measured frame-capture analysis

Performance Lab now imports local comma-separated frame intervals from `frame_time_ms` or classic PresentMon `MsBetweenPresents` captures. Review displays average FPS, mean-slowest-1% FPS, nearest-rank p99 interval, longest interval and a bounded peak chart. File size, row/field/frame limits, numeric units and stream identity are validated; mixed process/swap-chain captures are refused. Only an unmeasured first PresentMon interval may be excluded; stalls and dropped-frame rows are not filtered. This is analysis of supplied intervals, not automatic recording or a measure of input latency/displayed FPS.

Users can cancel without changing values or saving, confirm replacement of FPS while retaining separate latency entries, save summary/provenance without raw rows or filenames, reload, and export source-labelled comparisons. Manual FPS edits remove stale capture provenance. Fixed the shared dialog close button to avoid submitting a surrounding form.

Validation: production build and typecheck passed; 119 backend tests passed, with six Windows-only checks skipped locally; all 19 interface journeys passed, including import cancellation, invalid-stream refusal, persistence, manual edits and export. The new parser accounts for 26 tests covering calculations, stalls, quoted CSV, malformed data and bounded input. Interface screenshot reviewed. Updated native package validation is recorded separately in VALIDATION.md when complete. Approximate master-spec implementation is 74%; broader missing actions, sensor coverage, signing and physical-PC validation remain.


Stage 9 follow-up: before/after runs can capture actual PC configuration and current preference readings using a fixed schema that omits paths, usernames and hardware identifiers. Snapshots carry separate inventory and recording timestamps, persist with the benchmark, export alongside measurements, and flag changed driver/power/hardware/display/preference conditions without inferring causation. A baseline configuration can be saved before FPS measurements are available. Three additional context tests and the snapshot/save/reload/clear UI journey passed. The production Electron smoke now imports a disposable frame fixture through the real sandboxed file interface; it passed locally with real Linux hardware reads and guarded Windows-only actions.

Final stage 9 validation: Windows run 30 passed all 20 UI journeys, native cleanup/registry checks, packaged frame import and installation lifecycle, and uploaded both builds. Local full backend suite: 122 passed, six native checks skipped. Updated package hashes and source `d345c7a` are in VALIDATION.md. Full original scope remains approximately 74%, with the unfinished requirements retained explicitly.


## Stage 10 — owned presets and reversible power plans

Implemented all six named Windows presets using the verified preference catalog, with reviewed actions and single-use expiring approvals. The preference journal records profile ownership independently of individual changes. Switching restores only previous profile-owned settings before adding new settings; conflicts stop the switch, unavailable settings remain explicit, partial outcomes retain originals, and custom selections survive other preset choices. Per-item reviewed values are checked again before backup/write.

Implemented installed power-plan enumeration, explicit plan selection, durable original-GUID backup, verification, relaunch restoration and external-change refusal using fixed powercfg arguments. No schemes are created or deleted. Controls appear in Optimizations and Restore & History; profiles are in Game Profiles and have separate restore controls. Active-operation counting preserves the navigation/close guard when independent operations overlap.

Production build and typecheck passed. Local backend suite passed 138 tests with seven native checks skipped; an additional after-review external-change regression passed with the 37 existing preference tests. All 23 UI journeys passed. Native CI adds a disposable hosted-runner power-plan roundtrip and a custom-profile apply/off test using the existing per-user preference fixture. These native results are pending this stage's Windows run; do not infer physical-PC compatibility from local tests.


Stage 10 native confirmation: Windows run 31 (`38356714698`, source `05a03d8`) passed all 23 UI journeys, the new real power-plan change/restore, native custom preset apply/off, cleaner fixtures, package checks and installer lifecycle. These controls remain subject to physical-PC/policy testing.

## Stage 11 — guarded launcher startup and broader game guidance

Added explicit disable/restore for four known per-user launcher Run entry names (Discord, Steam, Epic Games Launcher, Spotify). The service preserves unexpanded String/ExpandString data, durably records originals before writes, uses expiring opaque review tokens, rejects external replacements, and reports unconfirmed outcomes without blind recovery writes. It never executes a saved command or modifies StartupApproved, services, tasks, HKLM or other applications. A new disposable hosted-Windows test covers native quotes/environment-variable preservation through disable and restoration.

Game guidance now covers all six supported requested titles, with known Steam identity matching and the default verified VALORANT executable path. GTA VI remains visibly planned and noninteractive. Native detection is still limited to supported locations; no game files are modified. Updated the preference batch-restore label to distinguish it from the separate power/startup restore controls.

Local production/typecheck and full backend suite passed (147 tests, eight native checks skipped). New startup safety and game-identity tests passed; the four affected startup/profile/game UI journeys passed. Native startup verification is pending the new workflow run.

### Stage 12 — Reviewed restore across managed features

- Added one review covering saved preference originals, original power plan, disabled supported launcher entries, and preset ownership. Conflicts are itemized and skipped; partial results remain visible. Custom preset choices are retained.
- Top-level mutations now share a queue, preventing a competing IPC mutation from interleaving the combined restore. Each underlying operation still rechecks external state before writing.
- Multiple individually reviewed startup tokens can be consumed in one batch without invalidating unrelated entries. Corrupt backup files stop combined review instead of silently omitting a category.
- Local build and 152 unit/safety tests passed; eight native-only cases skipped locally. Windows run 32 exposed a missing HKCU Run key in its disposable startup fixture. The fixture now prepares and removes that key only when needed; production continues refusing to recreate a missing key.

### Stage 13 — Manual game locations and reported CPU clock

- Native file picker for the six supported game pages; validates regular local `.exe` files and MZ/PE headers without executing them. Manual selection is explicitly not automatic game-identity verification. Saved paths survive relaunch, missing/unreadable files remain visible, and forgetting a path deletes only PANDORA metadata.
- CPU CIM-reported clock and OS architecture added to inventory, display and privacy-filtered export. Clock is labeled an inventory snapshot, not live boost telemetry. Missing values remain unavailable.
- Build, 19 focused backend tests and five affected UI journeys passed. Native-script validation is delegated to Windows CI; a local PowerShell initialization retry was interrupted before completion.
- Windows run 33 (`38359170921`, source `a82fc5f`) passed the corrected disposable startup fixture, exact registry/profile/power restoration, native cleanup fixtures, 26 UI journeys, packaging, launch and installer lifecycle. The missing-key correction stayed confined to its disposable fixture.

### Stage 14 — Network capabilities and DNS diagnostics

- Added explicit read-only inspection of physical/virtual/hidden adapters, negotiated rates, default-route presence, recognized EEE/interrupt-moderation properties and available power-management features. A virtual interface or default route is never claimed to carry game traffic. Address, MAC, gateway and adapter-name fields are excluded.
- Added a fixed-host DNS check using the configured Windows resolver. Query duration and answer count are measured; cache use and provider failures are explained, with no server changes or claimed game-ping benefit.
- Consulted MicrosoftDocs' Get-NetAdapter, Get-NetAdapterAdvancedProperty and Get-NetAdapterPowerManagement sources on GitHub after learn.microsoft.com was blocked. Power-management access may require elevation; diagnostics report unavailable instead of elevating the UI.
- Build, four backend diagnostics tests, four affected interface journeys, and actual PowerShell parser/runtime fixtures passed locally. Added native read-only adapter integration to Windows CI.
- Stable test checkpoint `8b08397` passed Windows run 34 (`38389470636`), including 27 UI tests and installer lifecycle. Locally generated installer and portable archives passed x64 payload/code/checksum verification and are bundled in `release/PANDORA-Windows-Test-Kit-0.1.0-x64.zip`. These exact local bytes remain distinct from CI-built/Windows-launched packages.

### Stage 15 — Windows pointer acceleration and provider isolation

- Added an optional pointer-acceleration control using documented `SystemParametersInfoW` `SPI_GETMOUSE`/`SPI_SETMOUSE` operations. It preserves both thresholds when disabling acceleration, saves the original three effective API values durably, verifies read-back, and restores exactly after relaunch. No DPI/polling/sensitivity setting or game input is altered directly; raw-input games may be unaffected.
- Five-minute single-use review, global mutation queue, stale/external-state checks, write-failure recovery and combined rollback integration. API snapshots describe effective values, not original registry key/value absence.
- Added isolated roundtrip/race/corruption/interruption tests and an opt-in native apply/restore test restricted to a disposable GitHub-hosted Windows runner. Compiled the actual native declarations locally without invoking user32; four affected interface journeys passed.
- Provider failures now keep power/pointer originals visible and let combined restore skip those unavailable items while restoring unrelated validated backups. Invalid/corrupt journal files still fail closed before a combined review.
- Full local suite now passes 168 backend/safety tests; ten native-only cases are skipped locally. Windows run 35 (`38390664826`, source `5087875`) passed real read-only adapter inspection, 28 interface journeys, native safety checks and the complete build/install/launch/uninstall workflow.

### Stage 16 — Release layout and operating instructions

- Power and pointer controls share a responsive two-column layout, reducing scrolling before the preference catalog. Inspected the rendered control screenshot; narrow-layout navigation remains covered.
- All 29 UI journeys passed locally, including the new pointer review/cancel/apply flow. Production build passed after the layout update. Backend results remain 168 passing / ten Windows-only skips.
- Updated README, safety boundaries, changelog and physical-PC checklist for presets, combined recovery, manual game locations, native controls and network/DNS scope.

## Stage 17 — professional copy and supported game list

Removed the GTA VI placeholder entirely; the six supported guides and their navigation remain intact. Rewrote homepage, section headings, sidebar and game descriptions in direct software language. Retained the purple visual design and reviewed the rendered overview screenshot. Build and all 29 UI journeys pass; native Windows CI run 38392114551 passed the preceding backend/installer revision.

## Stage 18 — expanded controls and graphics guidance

Seven documented Windows visual-effect controls now have per-setting detection,
review tokens, durable originals, pre-write checks, verified apply/restore and
combined rollback. New tests cover all seven, stale/expired reviews, last-moment
changes, provider failure, relaunch, already-configured states and corrupt backups.
Graphics guidance uses actual GPU/driver inventory and reported display Hz, with
fixed Windows settings shortcuts and no inferred input-latency or FPS claims.
The library has 21 configurable targets (8 registry + 7 visual + power + pointer
+ 4 launcher entries); presets and diagnostics are not counted as extra tweaks.
Build and 183 backend tests pass (11 Windows-only skipped locally). Native C#
compilation and the Linux Electron smoke pass. Native visual API round trips are
added to the existing disposable Windows workflow; results must be verified.

The complete 31-journey UI suite passes. Additional focused checks confirm actual
visual apply/restore state transitions, graphics guidance and minimum viewport
layout after the section-heading/spacing polish. Windows CI runs the real API
checks, package verification and installer lifecycle; physical PC tests remain
required. Current scope estimate: approximately 84%, not a completed full release.

Native Windows run 39 (`38457117035`, source `40f991c`) passed in 5m23s,
including all seven real visual API round trips and 31 UI journeys. Both local
packages at clean application source `537da29` pass full archive/x64/bundled-code
verification. Exact cross-built bytes remain distinct from native CI artifacts.

Final native Windows run 40 (`38457487572`) passed at application source
`537da29`, including all native mutation/restore tests, 31 UI journeys, both
packages, packaged launch and installer lifecycle/data preservation. Local
manifest correctly keeps Windows launch unverified for the separate cross-built
bytes. The downloadable test kit includes matching checksums and CI evidence.


## NVIDIA reference, normal cursor and readability checkpoint — 2026-10-14

Preserved all previous commits and implemented the user-requested stage: 54 NVIDIA reference cards with search, scope guidance, local notes and native Control Panel launch; supplied-cursor validation/preview, optional normal-pointer apply/restore, persistent content-addressed files, native local picker, separate in-app use and combined rollback; a readable type scale throughout the existing interface.

Saved implementation in 8bd74cd and da48349. Added retryable restoration after native reload failure in 00eb900. Windows CI identified unsupported cursor-reload flags; corrected at `756b79b2e88bd7fd0db4e7bb1aca761d5ef5269c`. [Native build](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38522747218) passed every required stage, including the actual supplied cursor apply/restore, all other native fixtures, 35 UI journeys, packaging, launch and installer lifecycle. Local checks: 198 backend passes, 12 native skips, native helper compilation and real Electron smoke. Both unsigned local EXEs passed archive/x64/bundled-file/checksum verification.

Keep the 537da29 release checkpoint. Download handoff and the updated test kit use the verified 756b79b runtime source. Read FEATURES and WINDOWS-HANDOFF before choosing the next stage. The project remains approximately 85% implemented by rough scope estimate; outstanding broader driver/network controls, restore points, richer sensors, game automation, signing/update/release certification and physical-PC checks must not be called complete.


## Advanced power controls checkpoint — 2026-10-14

Added six real individually reviewed AC power-plan controls: processor minimum/maximum, boost policy, energy preference, PCIe link savings and cooling policy. This brings the configurable target count to 27; desktop/privacy/personalization actions are not represented as FPS boosts. No battery policy is written, no unsupported Wi-Fi value is guessed and Quick Optimize does not silently apply advanced power choices.

Durable per-plan originals survive relaunch, failed refreshes and inactive-plan restoration. Stale reviews, external conflicts, invalid CPU limit combinations and unreadable journals are refused. Combined restoration orders CPU limits safely. The UI shows actual stored values, proposed values and hardware/policy tradeoffs.

Source `f0f75781b041c38deac6de6d934e7bce20ae07e2` is saved to GitHub. Local checks: 211 backend passes, 13 native-only skips, 36 UI journeys, native helper compilation and Electron integration. [Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38536940358) passed native mutation/restore, all UI checks, both package builds, packaged launch and installer lifecycle. Local archives match clean source and are distinguished from CI-built bytes. The previous 756b79b release is retained in release/checkpoints/756b79b-before-power-controls.

Full scope remains approximately 86%, not a finished public release. Follow WINDOWS-HANDOFF.md for physical-PC testing and unfinished functionality. Do not reimplement completed power/NVIDIA/cursor features or repeat successful packaging without source changes.


## NVIDIA telemetry checkpoint — 2026-10-14

Added read-only per-device NVIDIA SMI snapshots to System Monitor and system report export: memory used/total, temperature, graphics clock, reported power and utilization. Missing fields remain null, driver failures clear old readings, timestamps remain separate from WMI inventory and memory uses explicit MiB/GiB units. Fixed read-only arguments, installed Windows paths, six-second execution bound, 32-KiB output cap, 15-second cache and concurrent request coalescing. The renderer cannot choose commands or paths; no NVIDIA tool is bundled/downloaded.

Source `ee2fbc9f8addf5d487bf26b83ff3747976857026` is pushed to GitHub. Local results: 230 backend passes, 13 Windows-only skips, 37 distinct UI journeys passed after targeted fixes, production build and real Electron smoke. [Windows run](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38587202183) passed the full 37-test UI suite, existing native roundtrips, both packages, packaged launch and installation lifecycle. Native telemetry bridge/unavailable handling is checked, but actual sensor accuracy requires a physical NVIDIA GPU. Do not claim that the hosted runner validated RTX readings.

Both local EXEs and the 12-file test kit passed archive/source/checksum/CRC checks; native CI produces separate bytes. Previous advanced-power packages remain at release/checkpoints/f0f7578-before-gpu-readings. Overall approximate scope remains 86%; no new tweak is counted for this diagnostic feature. Consult the updated handoff and FEATURES for remaining work.


## Reviewed Windows restore points and recovered build checkpoint — 2026-10-27

Preserved the previous source/history and fast-forwarded the clean restored checkout from `43ccb87` to the already-pushed `7a0e69ebfc16d5e7af4c708d152771a2e587a19a`. The cloud snapshot had older packages; newer NVIDIA/cursor/power/telemetry and restore-point commits remained safely on GitHub. Rebuilt the missing final local packages instead of reimplementing those stages.

The restore-point panel and narrow UAC helper were implemented in `2332abd`, with a hidden helper console in `7a0e69e`. It lists up to 100 recent points, allows a single-use five-minute reviewed request, verifies a new unique sequence/description and reports policy/no-op/cancellation/timeout truthfully. It never enables protection, bypasses daily limits, deletes checkpoints, restores the OS or elevates the whole app. System Protection remains the Windows-managed destination for full-system restore.

Recovered-workspace validation: 242 backend passes, 13 Windows-only skips, all 39 UI journeys, production build, native syntax/runtime fixtures and real Electron integration passed. [Exact-source Windows run](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38635250100) passed all required stages, including native existing controls, packages, launch and installer lifecycle. Windows Server CI and isolated restore fixtures do not validate real Windows 10/11 checkpoint creation or UAC; these remain explicit tests for a client PC/VM.

Local installer/portable archives and the handoff kit are verified separately from CI-built bytes. Current scope is roughly 87% implemented, still not the full master specification or a signed public release. Preserve the retained release checkpoints, read the current handoff, and continue substantive missing features without repeating completed controls.


## Read-only storage reliability checkpoint — 2026-10-27

Added shared/storage-reliability.ts, electron/storage-reliability.ts and src/StorageDiagnostics.tsx. Explicit Windows storage snapshots show per-device temperature, reported endurance wear, power-on hours and six read/write error counts. Raw UInt64 counts stay exact decimal strings through IPC/JSON/UI; identity mismatches, multiple counter rows, missing fields and provider failures never produce invented readings. Bounded 32-device/20-second queries, 30-second cache/coalescing and generic errors limit overhead and private data exposure. Device labels are snapshot ordinals, not drive-letter mappings.

Local production build, 268 backend passes (14 Windows-only skips), all 41 UI journeys, actual PowerShell source fixtures and Electron bridge smoke passed. Runtime `b12930e94dd45daced8ae3682b9168ba80f4cebc` is saved to GitHub. [Exact-source Windows run](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/40588307698) passed real provider/schema checks, existing native mutation/rollback fixtures, interface tests, both packages, packaged launch and installer lifecycle. Hardware sensor accuracy still requires physical SSD/HDD and USB/RAID testing; native CI is not a drive-life certification.

Both local EXEs passed archive/source/x64/checksum verification and the updated 12-file kit passed CRC/embedded executable hashes. Keep the prior 7a0e69e checkpoint. Scope remains roughly 87%, not a full original-spec release. Storage diagnostics do not increase the 27-target optimization count. Follow the current handoff before choosing the next missing capability.


## Optional app startup and notification-area checkpoint — 2026-10-27

Implemented reviewed current-user sign-in registration for the installed app, optional close-to-tray, icon menu/reopen, explicit exit and busy-operation guards. Added strict settings migration, registration read-back, fresh/expiring single-use review, conflict preservation, persistent tray preference and ownership-aware uninstall cleanup. Portable/development executables cannot register transient paths; Windows startup approval remains untouched. Labels in the Settings rows now use 14px.

Runtime `9bcbfabb06a7e35d32bd12ef4eec59da49b50d11` is pushed to GitHub. Local checks passed: 283 backend tests, 14 native-only skips, all 43 UI journeys, production build, native helper syntax/compilation and Electron integration. [Exact-source Windows CI](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/40604270328) passed every required stage. The installed-app integration exercised actual registration and persistence, disable/re-enable, native hide/reopen, explicit exit and both owned/external startup-entry uninstall cases. It does not establish actual sign-in or visual tray behavior on a physical Windows client.

Both unsigned EXEs passed clean-source archive/x64/bundled-code/hash verification. The updated 12-file test kit passed CRC and embedded executable hashes. Keep release/checkpoints/b12930e-before-app-lifecycle and older checkpoints. Broad scope is roughly 88%, with 27 tuning/preference targets; these app lifecycle options are not FPS tweaks. Read the current handoff for missing full-spec capabilities and mandatory Windows hardware/client tests. Do not repeat completed feature work or discard existing code/history.


## Managed reports and actual portable launch checkpoint — 2026-10-30

Preserved the existing ac414db source and all prior commits. Added scripts/smoke-portable.mjs: the hosted Windows runner starts the actual portable self-extractor, connects only to its isolated loopback test endpoint, verifies its renderer/bridge, hardware inventory, cursor asset, cleaner navigation, portable startup guard and clean exit. The check uses existing Chromium debugging support only in the isolated test process. The earlier test commit 0949280 passed the new launcher step; the final exact-source workflow verifies it again with the report feature.

Added electron/history-report.ts and integrated schema-v2 native export through Restore & History. Preference operation history is combined with current managed preferences, preset ownership, power-plan backup, AC policies, launchers, pointer, visual effects and cursor state. Fixed fields/catalog labels exclude paths, commands, pixels, tokens and raw errors. Partial reads remain explicit; collection interval and report limitations are embedded. Export is serialized against changes, cancellation stops before provider collection, duplicate clicks are blocked and review tokens refresh afterward. The report is diagnostic, not an importable backup or full event log.

Runtime `aac58630f5ac51c999a3026f0a1a25fdf36a3ed6` is saved to GitHub. Local checks: 290 distinct backend cases (full suite plus focused integration rerun), 14 native-only skips, all 44 UI journeys, production build and real Electron schema/file export/cancellation. [Exact-source Windows run](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/41015274494) passed every required step, including native restoration, report integration, both packages, installer lifecycle and the actual portable launcher. The existing Windows validation checklist is preserved alongside the new checks.

Both local executable archives and the 12-file handoff kit pass source/x64/SHA256 and CRC/embedded-hash verification. Preserve release/checkpoints/9bcbfab-before-managed-reports and older checkpoints. Scope stays about 88%; this closes a build-validation gap and expands reports, but does not implement broader GPU/network mutations, debloat, full event history, game automation, additional sensors, signing or updating. Follow the current handoff for physical Windows tests.


## Persistent activity timeline checkpoint — 2026-10-30

Added shared/activity.ts, electron/activity.ts and src/ActivityLog.tsx. The central trusted IPC wrapper tracks all supported mutating operations with durable pending records and completed/partial/unconfirmed/cancelled outcomes. Local game/NVIDIA-reference writes join mutation serialization. Read-only diagnostics and exports do not create activity. The separate bounded JSON file keeps the latest 500 entries, counts pruning/clearing, preserves active operations and refuses corrupt-file clearing. Expiring single-use clear reviews check the exact reviewed IDs; original-value backups and preference restoration history are untouched.

The UI provides search, result filters, pagination, reviewed clearing, interrupted-operation notices and visible logging gaps. Recording failures never alter the underlying operation result or disable restoration. Native report export includes the retained timeline without private paths, commands, cursor data, raw errors or internal event IDs. Logs do not reconstruct older/external activity or act as restorable backups.

Runtime `b987f879ab55975f6a691be7616460695237edc3` is pushed to GitHub. Local validation: 303 backend passes, 14 Windows-only skips, all 46 UI journeys, focused final-style checks, production build and actual Electron activity/export/clear integration. [Exact-source Windows run](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/41021036720) passed every required step, including native controls/rollback, installer lifecycle, activity persistence across installed-app relaunch and the actual portable launcher. Physical Windows client behavior and power-loss/storage-failure scenarios remain manual checks.

Both local EXEs and the refreshed 12-file test kit passed source/archive/x64/SHA256 and CRC/embedded-hash verification. Preserve release/checkpoints/aac5863-before-activity-history and all older checkpoints. Scope estimate is now roughly 89%, still not a complete or signed public release. The 27-target count is unchanged. Continue substantive GPU/network controls, debloat, additional sensors, game automation, signing/updating and physical-PC validation; do not reimplement the completed activity feature.


## Reviewed Fortnite display configuration checkpoint — 2026-10-30

Preserved the existing project and commits. Added shared/fortnite-settings.ts, electron/fortnite-config.ts, electron/fortnite-file.ts, electron/fortnite-settings.ts and src/FortniteSettings.tsx. Three real existing INI fields have explicit current state, choices/tradeoffs, review/cancel/confirm and saved-original restoration. Fixed current-user path, bounded UTF-8/UTF-16LE parsing, ambiguity refusal, process checks, identity/content comparison, durable backup, atomic replacement and read-back. Unrelated settings, comments and formatting survive edits. Per-owned-value rollback preserves newer unrelated settings and refuses external conflicts. Includes Restore & History, combined rollback, activity and ten-section managed reports; backup file contents remain private and local.

Runtime `501c28da7367a7ac71c5cf4eb658ff072b553971` is pushed to GitHub. Local checks: 335 backend passes, 15 native-only skips, all 48 UI journeys, production build, helper syntax and actual Electron integration. [Exact-source Windows workflow](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/41036430165) passed all required stages. Windows exposed a legitimate short-path alias issue; e5b8c1d fixes the base resolution, and 501c28d corrects the alias regression fixture. Native actual file/process tests now pass alongside previous tuning/rollback, both packages, install/uninstall and real portable launch.

Both local EXEs passed clean-source archive/x64/code/hash checks. The new 13-file kit also includes docs/FORTNITE-SETTINGS.md; preserve release/checkpoints/b987f87-before-fortnite-settings and prior checkpoints. Native CI produces separate bytes. Rough scope is now 90%, not a finished public release. Actual Fortnite rendering/cloud-sync behavior, client Windows policies and measurable improvements remain unverified. Continue the substantive backlog in FEATURES and WINDOWS-HANDOFF without repeating this stage.
