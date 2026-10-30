# Changelog

## Reviewed Fortnite display preferences — 2026-10-30

- Added actual local-configuration controls for the existing Fortnite frame cap, V-Sync and dynamic-resolution keys. The review shows current and requested values, tradeoffs and game-verification requirements; no changes happen on selection or cancellation.
- Preserved UTF-8/UTF-16LE encoding, comments, whitespace and unrelated settings. Bounded reads, fixed configuration location, process checks, redirect/hardlink/read-only guards, expiring single-use reviews and verified atomic replacement protect the operation. No missing keys are invented and no read-only flag is set.
- Saved a durable full original before writing. Restoration changes only owned display values, preserves newer unrelated settings, refuses conflicting values and survives relaunch. Added integration with combined rollback, activity and privacy-filtered reports (now ten snapshot sections).
- This is configuration-file editing, not a live game API or proof of current Fortnite support/performance. Rendering-mode behavior, cloud synchronization, game updates and actual gains need real-game verification.

- Hardened Windows configuration replacement to preserve custom destination permissions. Added actual helper execution and protected-ACL round trips, precise Windows test diagnostics, bounded portable-launch sharing-violation retries, and download instructions tied to the built artifact.

## Persistent activity timeline — 2026-10-30

- Added durable activity across supported cleanup, tuning, restoration, preset, startup, cursor, game-location and app-setting operations. Pending operations are recorded before execution; completed, partial, cancelled and unconfirmed outcomes remain distinct after reopening.
- Added searchable/filterable activity in Restore & History, 20-entry pagination, the latest 500 records, visible retention counts, and expiring reviewed clearing that preserves all rollback backups and preference restoration history.
- Recording failures remain visible and do not block Windows operations or restoration. Corrupt activity files are preserved; an interrupted operation is never inferred successful. Logs omit commands, paths, filenames, free-text errors and raw operation payloads.
- Extended managed JSON reports with the retained timeline. Activity starts with this version and can have gaps from retention, clearing or recording failures; it is not a complete history of Windows or other applications.

## Managed settings reports and portable launch checks — 2026-10-30

- Expanded report export to schema version 2: preference operation history plus current preference, preset, power-plan, AC policy, launcher, pointer, visual-effect and cursor snapshots. Failed sections are explicitly unavailable; null readings, saved originals and conflicts remain distinct.
- Reports use fixed fields and catalog labels. Private paths, startup commands, cursor pixels, review tokens, raw errors and custom power-plan names are omitted. This is a diagnostic report, not an importable backup or complete historical event log.
- Native report collection is serialized with changes, save-dialog cancellation stops before provider collection, and repeated UI export clicks are blocked. Controls reload their review tokens after collection.
- Added a hosted Windows check that executes the actual portable self-extracting launcher, checks its sandboxed renderer and hardware bridge, and verifies clean exit. Native outcome is recorded in the validation handoff, separately from archive integrity.

## Optional sign-in launch and notification area — 2026-10-27

- Added reviewed per-user sign-in registration for the installed PANDORA executable, with fresh installation/entry checks, read-back and conflict preservation. Portable/development executables cannot register temporary paths. Windows startup approval metadata remains untouched.
- Added optional close-to-tray, reopening from the icon or a second launch, and explicit Exit PANDORA. Both options default off; close/quit stay blocked during active mutations. Old settings migrate without enabling background behavior.
- Uninstall removes only a matching sign-in command and preserves external replacements. New hosted Windows integration exercises installation, startup registration, tray hide/reopen, relaunch, exit and uninstallation. Actual Windows sign-in and notification-area visibility still need PC testing.

## Read-only drive diagnostics — 2026-10-27

- Added on-request Windows storage-provider snapshots for temperature, reported wear, power-on hours and six read/write error counters, with per-device unavailable states and a 30-second cache.
- Preserved UInt64 error counts exactly, checked counter/device identity, bounded native queries and excluded private storage identifiers from the report.
- Added readable System Monitor cards and system JSON export. This is not a complete SMART self-test, repair tool or drive-life prediction; physical SSD/HDD/controller validation remains required.

## Reviewed Windows restore points — 2026-10-14

- Added restore-point inventory and explicit reviewed creation through a separate Windows administrator helper; the desktop app is not relaunched elevated.
- Creation uses the fixed Windows Checkpoint-Computer cmdlet and verifies a newly listed unique point before reporting success. Cancellation, unsupported Windows Server, policy limits and unconfirmed results remain explicit.
- Added Windows System Protection launch and clear separation from exact PANDORA setting rollback. Protection/retention/frequency policy and existing points are not changed by PANDORA.
- Actual creation/UAC behavior requires Windows 10/11 client validation; hosted Server CI only verifies supported script fixtures and unavailable behavior.

## NVIDIA hardware readings — 2026-10-14

- Added optional read-only NVIDIA driver snapshots for VRAM usage/capacity, GPU temperature, graphics clock, reported power and utilization.
- Added per-device cards, explicit refresh timestamps, bounded queries, unavailable values and system report export. Memory units are explicitly MiB/GiB.
- Added malformed-output, multi-GPU, caching, failure-recovery, fixed-command and interface regression tests. Actual NVIDIA GPU/driver behavior still needs physical-PC validation.

## Advanced power controls — 2026-10-14

- Added six individually reviewed plugged-in power settings using documented Windows power APIs: CPU minimum/maximum, boost mode, energy preference, PCIe savings and cooling policy.
- Added real stored-state detection, hardware/policy caveats, durable exact backups, conflict refusal and restoration after relaunch or changing the active plan.
- Combined restore now orders CPU limits so the minimum never exceeds the maximum; battery values and unrelated plans are preserved.
- Added service, UI and disposable Windows power-plan tests. Native Windows validation and new packages are tracked in the validation report.

## 0.1.0 — Expanded Windows test build

- Six reviewed presets with custom choices, ownership-aware switching and off.
- Reversible existing power-plan selection, supported launcher startup controls,
  optional Windows pointer acceleration, and combined managed restoration.
- Manual game executable selection, CPU reported clock/architecture, expanded
  storage/network inventory, and guidance for all six supported game pages.
- Read-only physical/virtual adapter capabilities and on-request DNS testing.
- Measured frame-interval CSV import, provenance and before/after PC snapshots.
- Native Windows safety/roundtrip checks, installer lifecycle and data retention.

## 0.1.0 — Initial development release

PANDORA — Created by Sonnier begins with an original purple-and-black desktop
interface, local hardware diagnostics, live resource monitoring, a small
allowlisted Windows preference catalog, state snapshots and rollback history,
and a PC Cleaner with scan/review/confirmation flows.

- Sandboxed Electron renderer and explicit typed IPC.
- Per-user preferences with exact original-state backups, verification,
  interrupted-operation recovery and external-change conflict protection.
- Privacy-filtered diagnostic/history exports and persisted local settings.
- Original editable SVG logo asset, real PNG/multi-size ICO, and per-user NSIS
  installer configuration with honest unsigned-publisher metadata.
- Isolated safety tests, browser UI checks and Windows build automation.

The precise implemented scope and known gaps are listed in [FEATURES.md](FEATURES.md).
This release does not claim universal FPS gains, verified signing, or completed
native Windows certification.

## NVIDIA reference, cursor customization and readability — 2026-10-14

- Added a searchable 54-entry personal NVIDIA configuration reference, saved notes, scoped instructions and guarded Control Panel launch. Manual driver changes remain outside automatic rollback.
- Added optional normal-pointer customization with the supplied crosshair, validated local CUR/ANI files, persistent assets, durable originals, reviewed native apply/restore and combined rollback integration.
- Added separate in-app cursor use with a static preview for animated files.
- Increased text sizes and adjusted card layouts across the existing purple interface.
- Extended backend, renderer, packaged bridge and disposable Windows cursor checks. Physical-PC and reboot validation remain required.
