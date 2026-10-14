# PANDORA — Created by Sonnier: Windows test release

PANDORA 0.1.0 is ready for controlled Windows testing. It is an unsigned development release, not completion of the full original specification or a certified public release. Approximately **85% of the full requested scope is implemented**; this is a rough scope estimate, not a Windows compatibility or performance score. The expanded optimization wishlist is also only partially implemented. The current library has 21 configurable targets: eight registry preferences, seven desktop effects, power-plan selection, pointer acceleration and four launcher startup entries. Presets reuse these targets. Normal-pointer customization is an additional personalization feature, not an FPS tweak.

## Implemented (see validation record for platform checks)

- Original purple/black desktop interface, accessible confirmations, responsive navigation and reduced motion. Larger body/navigation text, readable descriptions and 20px section headings without global zoom.
- NVIDIA Settings with 54 searchable screenshot-based reference entries, Sonnier’s personal setup, persistent notes, Global/Per-Game guidance, hardware context and a Control Panel launcher. Driver configuration is manual; reference values are not detected settings.
- Quality of Life cursor manager: the supplied crosshair, actual preview/hotspot, validated local CUR/ANI picker, persistent files, normal-pointer-only configuration, exact original backup, confirmation, native reload/read-back and restore after reopening. Optional in-app use is separate; animated files use a static first frame there.
- Actual hardware inventory, CPU/RAM monitoring, supported GPU utilization, CPU reported-clock snapshot, OS architecture, storage health/provider data, monitor modes and network link rates.
- PC Cleaner with safe old temporary-file scanning, category selection, measured logical bytes, confirmation, progress and locked/changed-file reporting. Browser caches and Recycle Bin each have separate confirmation.
- Eight narrow Windows preferences with durable original-value/absence snapshots, current-state verification, individual/batch restore, recovery and conflict refusal.
- Seven Windows visual-effect controls with per-setting API detection, confirmation, durable original effective values and verified apply/restore. These are desktop preferences, not FPS boosts.
- Graphics guidance selected from detected GPU/driver inventory, official driver links and Windows settings shortcuts. Refresh intervals are calculated, not measured input latency.
- Six reviewed presets: Competitive FPS, Balanced Gaming, Streaming + Gaming, Creator, Quiet/Everyday and Custom. Profile switching restores profile-owned preferences and preserves individual changes/custom choices.
- Existing power-plan selection with exact original GUID backup and guarded restoration.
- Optional pointer acceleration through the documented Windows API, with original thresholds/mode saved, read-back verification and exact effective-value restoration. Raw-input games may ignore it.
- Guarded disable/restore for four named current-user launcher startup entries: Discord, Steam, Epic Games Launcher and Spotify. Other startup mechanisms remain read-only.
- Combined restoration of managed preferences, power, pointer acceleration, custom normal cursor, visual preferences, launcher entries and preset ownership, with skipped conflicts/unavailable providers reported individually.
- Six supported game guides: Fortnite, VALORANT, CS2, Apex Legends, Warzone and GTA V. Automatic supported install detection and native manual executable selection, persisted/missing-path handling and metadata-only removal.
- Explicit ICMP latency/loss/jitter measurements, physical/virtual/hidden adapter inspection, recognized EEE/interrupt-moderation options, available power-management states and fixed-host DNS timing. These diagnostics do not change network configuration or infer game routing.
- Performance Lab with manual measurements and validated local frame-time CSV analysis, average/1% low FPS, interval consistency, capture provenance, before/after PC snapshots and export. No fabricated improvement or live game capture.
- Local settings, privacy-filtered reports, portable application and per-user installer with retained rollback data on uninstall.

## Still incomplete

- Direct HAGS, per-game GPU/driver, fullscreen/overlay and broader GPU tuning controls; NVIDIA-specific configuration is not automatically applied.
- Reversible adapter power/EEE/interrupt-moderation/DNS changes, full network-path diagnostics, and optional bundled-app removal. Current network features are diagnostics.
- Windows System Restore point creation and broader pre-change system backups. Local setting snapshots do not restore deleted files or Windows itself.
- Reliable VRAM and CPU/GPU temperatures/fan/power sensors, detailed SSD SMART/error diagnostics and broader hardware compatibility.
- Automated game-file configuration, live game telemetry/capture and measured performance benefits on your hardware.
- Start-with-Windows/tray and fuller retention/logging controls, complete cross-feature history export, signed publisher identity, secure updater and public-release certification.

Cleanup reports confirmed logical file bytes, not an exact physical free-space increase. Quality-of-life/privacy options and pointer acceleration do not imply FPS gains. See [FEATURES.md](../FEATURES.md) for exact scope.

## Download

Application source: `756b79b2e88bd7fd0db4e7bb1aca761d5ef5269c`. Both packages are built and archive-verified. Native Windows CI passed for this source, including installer lifecycle and 35 UI journeys. Exact checksums are recorded in the accompanying `verification.json`.

Download **PANDORA-Windows-x64-unsigned** from [verified NVIDIA/cursor Windows build](https://github.com/hectorantunes07-cyber/Pandora/actions/runs/38522747218). Sign in to GitHub if required and extract the ZIP first.

- `PANDORA-Setup-0.1.0-x64.exe`: per-user installer with shortcuts and uninstaller.
- `PANDORA-Portable-0.1.0-x64.exe`: no installation; still stores local app data.
- Matching `.sha256` sidecars and `verification.json`: exact identity and recorded checks.

The local `release/PANDORA-Windows-Test-Kit-0.1.0-x64.zip` contains cross-built packages, sidecars, evidence and testing instructions. Its manifest keeps `windowsLaunchVerified: false` because these exact local bytes were archive-verified; Windows CI separately built and launched packages from the same source. Use only the checksum supplied with your chosen executable. Earlier checkpoints remain under `release/checkpoints/`.

## What you should test on your Windows PC

- [ ] Verify the matching SHA256, install or launch as a normal user, reopen and inspect all pages at your display scaling.
- [ ] Search the NVIDIA library, save notes and reopen it. Test the Control Panel launcher on your NVIDIA driver installation. Record original values before making manual driver changes; PANDORA rollback does not cover them.
- [ ] Apply the normal cursor, check all other roles, relaunch, restore the original, and repeat across a Windows restart. Try another supported CUR/ANI file and optional in-app use.
- [ ] Compare hardware/monitor/link data with Windows. Check missing providers stay unavailable.
- [ ] Review/cancel a cleanup scan, then clean only disposable old temporary files; verify skipped files and logical-byte totals. Optional browser/Recycle Bin tests need disposable data.
- [ ] Apply one preference and restore its original behavior. Test profile switching/off and saved Custom choices.
- [ ] Separately test existing power-plan, pointer, visual-effect and supported launcher changes, then restore after relaunch. Preserve backups.
- [ ] Review all managed changes. Confirm that external edits/unavailable providers produce skipped items and retained originals.
- [ ] Save a manual game path, reopen, simulate a missing file and forget the path without deleting anything.
- [ ] Compare physical and VPN adapter data with Windows. Test ICMP/DNS results without interpreting them as your Fortnite server latency.
- [ ] Import a real repeatable frame-time capture and compare like-for-like before/after results. No actual gain has been established yet.
- [ ] Uninstall/reinstall and confirm history remains. Restore unwanted changes before uninstalling.

Native hosted CI passes do not establish every Windows setting's visible effect, performance benefit, vendor compatibility or standard-user behavior on your PC. Complete [windows-validation.md](windows-validation.md) before broader release. Report source/hash, Windows version, steps and errors; keep private paths and journals out of public reports.
