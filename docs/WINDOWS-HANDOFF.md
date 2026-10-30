# PANDORA — Created by Sonnier: Windows test release

PANDORA 0.1.0 is ready for controlled Windows testing. It is an unsigned development release, not completion of the full original specification or a certified public release. Approximately **91% of the full requested scope is implemented**; this is a rough scope estimate, not a Windows compatibility or performance score. The expanded optimization wishlist is also only partially implemented. The current library has 33 configurable Windows policy/preference values: eight registry preferences, seven desktop effects, six AC power values plus their six independent DC counterparts, power-plan selection, pointer acceleration and four launcher startup entries. Presets reuse these targets. Three additional Fortnite display preferences bring the combined count to 36; none is a guarantee of an FPS improvement. Normal-pointer customization is an additional personalization feature, not an FPS tweak.

## Implemented (see validation record for platform checks)

- Original purple/black desktop interface, accessible confirmations, responsive navigation and reduced motion. Larger body/navigation text, readable descriptions and 20px section headings without global zoom.
- NVIDIA Settings with 54 searchable screenshot-based reference entries, Sonnier’s personal setup, persistent notes, Global/Per-Game guidance, hardware context and a Control Panel launcher. Driver configuration is manual; reference values are not detected settings.
- Quality of Life cursor manager: the supplied crosshair, actual preview/hotspot, validated local CUR/ANI picker, persistent files, normal-pointer-only configuration, exact original backup, confirmation, native reload/read-back and restore after reopening. Optional in-app use is separate; animated files use a static first frame there.
- Actual hardware inventory, CPU/RAM monitoring, supported GPU utilization, CPU reported-clock snapshot, OS architecture, storage health/provider data, monitor modes and network link rates.
- Optional NVIDIA hardware snapshots: per-device VRAM used/total, GPU temperature, graphics clock, reported power and utilization where the installed driver utility supports them. Explicit refresh, bounded execution, separate timestamp and report export. Actual readings still require checking on physical NVIDIA hardware.
- Drive diagnostics with explicit read-only Windows Storage snapshots for temperature, reported wear, power-on hours and six exact read/write error counters. Per-device missing/failed readings, 30-second caching and privacy-filtered system report export. No drive-life prediction, self-test or disk modification. Physical drives/controllers still need comparison.
- PC Cleaner with safe old temporary-file scanning, category selection, measured logical bytes, confirmation, progress and locked/changed-file reporting. Browser caches and Recycle Bin each have separate confirmation.
- Eight narrow Windows preferences with durable original-value/absence snapshots, current-state verification, individual/batch restore, recovery and conflict refusal.
- Seven Windows visual-effect controls with per-setting API detection, confirmation, durable original effective values and verified apply/restore. These are desktop preferences, not FPS boosts.
- Graphics guidance selected from detected GPU/driver inventory, official driver links and Windows settings shortcuts. Refresh intervals are calculated, not measured input latency.
- Six reviewed presets: Competitive FPS, Balanced Gaming, Streaming + Gaming, Creator, Quiet/Everyday and Custom. Profile switching restores profile-owned preferences and preserves individual changes/custom choices.
- Existing power-plan selection with exact original GUID backup and guarded restoration.
- Six reviewed power controls with separate Plugged in/On battery choices: CPU minimum/maximum, boost policy, energy preference, PCIe savings and cooling policy. Real stored-state detection, durable originals, read-back and restoration on the original plan; each source has separate backups, and the other source remains unchanged. New battery changes require a detected battery; original DC settings can still be restored without one. Hardware may override these preferences.
- Optional pointer acceleration through the documented Windows API, with original thresholds/mode saved, read-back verification and exact effective-value restoration. Raw-input games may ignore it.
- Guarded disable/restore for four named current-user launcher startup entries: Discord, Steam, Epic Games Launcher and Spotify. Other startup mechanisms remain read-only.
- Windows System Restore panel with recent points, reviewed creation through a narrowly scoped administrator helper, verification of a new unique point, and a System Protection shortcut. Windows frequency/protection policies are respected; actual Windows 10/11 creation remains unverified.
- Combined restoration of managed preferences, power-plan selection and separate AC/DC policies, pointer acceleration, custom normal cursor, visual preferences, launcher entries, Fortnite display values and preset ownership, with skipped conflicts/unavailable providers reported individually.
- Six supported game guides: Fortnite, VALORANT, CS2, Apex Legends, Warzone and GTA V. Automatic supported install detection and native manual executable selection, persisted/missing-path handling and metadata-only removal.
- Reviewed Fortnite frame cap, V-Sync and dynamic-resolution file controls. Current values, optional choices, expiring confirmation, durable original, read-back, per-owned-value rollback and combined restoration. Unrelated newer settings are preserved; conflicts or a running game block changes. Existing keys only, no executable/anti-cheat changes or read-only flag. Real-game behavior still needs verification; see [Fortnite testing details](FORTNITE-SETTINGS.md).
- Explicit ICMP latency/loss/jitter measurements, physical/virtual/hidden adapter inspection, recognized EEE/interrupt-moderation options, available power-management states and fixed-host DNS timing. These diagnostics do not change network configuration or infer game routing.
- Performance Lab with manual measurements and validated local frame-time CSV analysis, average/1% low FPS, interval consistency, capture provenance, before/after PC snapshots and export. No fabricated improvement or live game capture.
- Optional reviewed sign-in launch for the installed app, with exact current-user registration checks and preserved Windows startup approval. Optional notification-area icon, close-to-tray, reopen and explicit exit; active operations block normal exit. Settings persist, and uninstall removes only its matching startup command. Actual sign-in and tray appearance still need PC testing.
- Expanded managed report: schema-v2 preference operation history plus current preference, preset, power-plan, AC/DC-policy, launcher, pointer, visual, cursor and Fortnite display snapshots. Failed sections are marked unavailable. Private paths, commands, cursor images, review tokens and raw errors are omitted. The report also includes retained operation activity. It is diagnostic, not an importable backup or reconstruction of older/external events.
- Persistent activity timeline for supported cleanup, tuning, restoration, preset, startup, cursor, manual game locations and app settings. Search, outcome filters and pagination; latest 500 records; visible retention counts and reviewed clearing. Pending, completed, partial, cancelled and unconfirmed outcomes stay distinct. Logs exclude private paths/commands/errors and cannot replace rollback backups. Older activity is not reconstructed.
- Local settings, privacy-filtered reports, portable application and per-user installer with retained rollback data on uninstall.

- Optional Windows-app review: current-user registrations for eight fixed families, exact identity checks, version/status/protected flags, search/filter and reviewed Windows Installed apps shortcut. Windows handles any uninstall; PANDORA does not remove apps or back up their data.
- Process identity details: actual name, PID/start time, executable path and reported company/version. Company metadata is not authenticated publisher information. Folder requests recheck the process instance and canonical local file; no process is stopped or modified, and detail paths are excluded from logs/reports.

## Still incomplete

- Direct HAGS, per-game GPU/driver, fullscreen/overlay and broader GPU tuning controls; NVIDIA-specific configuration is not automatically applied.
- Reversible adapter power/EEE/interrupt-moderation/DNS changes, full network-path diagnostics, and direct bundled-app removal. The optional-app inventory and Windows Settings handoff are implemented. Current network features are diagnostics.
- Windows client verification of the implemented restore-point flow and broader pre-change backups. Actual UAC approval and new checkpoint creation have not yet been tested on Windows 10/11. Local setting snapshots do not restore deleted files or Windows itself.
- CPU and AMD/Intel GPU sensors, fan readings, raw vendor-specific SMART/self-test diagnostics and broader hardware compatibility. Windows storage reliability counters and NVIDIA telemetry are implemented but require physical-device validation.
- Broader automated game configuration beyond the three Fortnite display preferences, live game telemetry/capture and measured performance benefits on your hardware.
- Signed publisher identity, secure updater and public-release certification. Activity retention is currently a fixed 500 entries with reviewed clearing; it is not an unlimited archive or a record of external Windows changes.

Cleanup reports confirmed logical file bytes, not an exact physical free-space increase. Quality-of-life/privacy options and pointer acceleration do not imply FPS gains. See [FEATURES.md](../FEATURES.md) for exact scope.

## Download

Application source: `8d35ea6addf9ce4d7dd30fb80cf23b45e089b6d8`. Both packages are built and archive-verified. CI launched the unpacked and installed app and the actual portable self-extracting launcher. The portable check verifies extraction, the sandboxed bridge, actual hardware inventory, bundled cursor, cleaner navigation and clean exit with an isolated profile. Native Windows CI passed for this source, including separate AC/DC policy apply/rollback, absent-battery apply refusal, custom game-file permission preservation, installer lifecycle and all 54 UI journeys. Exact checksums are recorded in the accompanying `verification.json`.

Download **PANDORA-Windows-x64-unsigned** from [verified Windows build](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/41122650946). Sign in to GitHub if required and extract the ZIP first.

- `PANDORA-Setup-0.1.0-x64.exe`: per-user installer with shortcuts and uninstaller.
- `PANDORA-Portable-0.1.0-x64.exe`: no installation; still stores local app data.
- Matching `.sha256` sidecars and `verification.json`: exact identity and recorded checks.

The local `release/PANDORA-Windows-Test-Kit-0.1.0-x64.zip` contains cross-built packages, sidecars, evidence and testing instructions. Its manifest keeps `windowsLaunchVerified: false` because these exact local bytes were archive-verified; Windows CI separately built and launched packages from the same source. Use only the checksum supplied with your chosen executable. Earlier checkpoints remain under `release/checkpoints/`.

## What you should test on your Windows PC

- [ ] Compare optional-app registrations with Windows Installed apps, test search/filter and cancel/open review, then refresh. If you uninstall anything through Windows, back up its data first; PANDORA cannot undo app removal.
- [ ] Inspect a normal and a protected process, verify identity/file metadata, and test a process exiting before Open file location. Company/version are descriptive metadata, not signature checks.
- [ ] Verify the matching SHA256, install or launch as a normal user, reopen and inspect all pages at your display scaling.
- [ ] Search the NVIDIA library, save notes and reopen it. Test the Control Panel launcher on your NVIDIA driver installation. Record original values before making manual driver changes; PANDORA rollback does not cover them.
- [ ] Apply the normal cursor, check all other roles, relaunch, restore the original, and repeat across a Windows restart. Try another supported CUR/ANI file and optional in-app use.
- [ ] Compare hardware/monitor/link data with Windows. Check missing providers stay unavailable.
- [ ] Open System Monitor and compare NVIDIA readings with the installed NVIDIA SMI utility. Confirm each GPU, MiB/GiB memory units and snapshot time. Check refresh caching, unsupported fields and exported readings. No temperature/clock/FPS inference should be assumed.
- [ ] Read drive counters explicitly. Compare supported values with Windows/the manufacturer’s utility, check standard-user/USB/RAID failures remain unavailable, and verify large error counts stay exact in system JSON. A healthy provider label is not a complete diagnostic.
- [ ] Review/cancel a cleanup scan, then clean only disposable old temporary files; verify skipped files and logical-byte totals. Optional browser/Recycle Bin tests need disposable data.
- [ ] Apply one preference and restore its original behavior. Test profile switching/off and saved Custom choices.
- [ ] Separately test existing power-plan, pointer, visual-effect and supported launcher changes, then restore after relaunch. Preserve backups.
- [ ] Review one supported advanced power value, cancel first, then apply and restore after relaunch. For an AC change, verify DC values and plan selection are unchanged. On a laptop, separately review/apply/restore a supported DC value and verify AC preservation; on a desktop without a battery, new DC changes must be disabled. Record thermal/noise/performance effects separately; Windows power mode and firmware may override the stored policy.
- [ ] In Restore & History, inspect existing Windows points, cancel creation review, then test UAC cancellation. On a protected Windows 10/11 test PC, confirm a reviewed request and verify the new unique point in System Protection. Check disabled protection/daily-limit failures stay unconfirmed. Never test a full-system rollback just to validate this button.
- [ ] Review all managed changes. Confirm that external edits/unavailable providers produce skipped items and retained originals.
- [ ] Save a manual game path, reopen, simulate a missing file and forget the path without deleting anything.
- [ ] Compare physical and VPN adapter data with Windows. Test ICMP/DNS results without interpreting them as your Fortnite server latency.
- [ ] Import a real repeatable frame-time capture and compare like-for-like before/after results. No actual gain has been established yet.
- [ ] In Settings, review/cancel sign-in launch, then enable it in the installed app. Check Windows startup approval, sign out/in, disable it and verify it stays off. Portable builds must not register their temporary executable. Enable close-to-tray, close/reopen, inspect the icon at your display scaling and test explicit Exit. No tuning or cleanup should run automatically.
- [ ] Export the managed report, cancel once, then save and inspect all eleven sections. Check originals/conflicts after a managed change and after reopening. Unavailable sections must be marked; private paths/commands must be absent. Verify ordinary rollback still works after export. Keep local backups: the JSON is not an importable backup.
- [ ] Check activity after a disposable operation and after relaunch. Filter by result; an interrupted operation must stay unconfirmed. Review clearing, cancel once, then clear the reviewed entries and verify original backups still restore correctly. Activity storage failures and physical power-loss behavior need a disposable test profile.
- [ ] Test the three Fortnite preferences against the actual game. Cancel once, apply one value, reopen PANDORA and restore. Verify process blocking, video-menu behavior, cloud sync, conflicts and preservation of unrelated newer settings. Hosted file/process tests do not validate actual Fortnite behavior.
- [ ] Uninstall/reinstall and confirm history remains. Restore unwanted changes before uninstalling.

The CI artifact contains the instructions that existed at build time. This repository handoff and the current local test kit include the updated feature status.

Native hosted CI passes do not establish every Windows setting's visible effect, performance benefit, vendor compatibility or standard-user behavior on your PC. Complete [windows-validation.md](windows-validation.md) before broader release. Report source/hash, Windows version, steps and errors; keep private paths and journals out of public reports.
