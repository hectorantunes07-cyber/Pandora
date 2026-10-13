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
