# PANDORA feature status

**Created by Sonnier · 0.1.0 development release**

`COMPLETE` means the scoped implementation is present, not that every Windows
machine is certified. `PHYSICAL-PC VALIDATION REQUIRED` marks behavior that still needs checking on
your Windows PC, even where hosted Windows CI passes. See [docs/VALIDATION.md](docs/VALIDATION.md) for
actual test/build outcomes and [the release checklist](docs/windows-validation.md).

| Feature | Status | Scope and limitations |
| --- | --- | --- |
| Original branding and desktop shell | COMPLETE | Purple/black React UI in Electron; original SVG/PNG/ICO assets, PANDORA and Created by Sonnier identity. |
| NVIDIA configuration center | COMPLETE WITH MANUAL DRIVER CONTROLS; PHYSICAL-PC VALIDATION REQUIRED | 54 searchable screenshot-transcribed reference settings, saved personal notes, Global/Per-Game instructions, detected GPU/driver context and guarded Control Panel launcher. Driver values are not read/applied by PANDORA; NVIDIA manual changes are outside PANDORA rollback. |
| Cursor customization | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Supplied crosshair preview; bounded CUR/ANI validation; native file picker; persistent content-addressed files; exact normal-pointer registry backup, reviewed apply/reload/read-back/restore and combined rollback; optional static first-frame in-app use. Other cursor roles are preserved. Reboot and third-party cursor software need physical-PC checks. |
| Readable interface typography | COMPLETE; DISPLAY-SCALING VALIDATION REQUIRED | 15px base, 14px navigation/controls/body descriptions, 12–13px minimum secondary text, 20px section headings, larger hardware names and responsive card layouts. |
| Hardware inventory | PARTIAL; PHYSICAL-PC VALIDATION REQUIRED | CPU/core count/reported clock, OS architecture, RAM, GPU/driver, OS, motherboard, active power plan and fixed volumes. Display information comes from active video controllers and may not map one-to-one to monitors. Physical storage model/media/bus/health, physical network adapters/link rates, installed versus usable RAM, device type and last boot are now reported when exposed. VRAM and detailed sensors remain unavailable. |
| Live CPU/RAM/process monitoring | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Actual OS observations with timestamps. Process CPU values are cumulative seconds, not a percent estimate. |
| GPU utilization | PARTIAL; PHYSICAL-PC VALIDATION REQUIRED | Busiest 3D-engine utilization from CIM, cached at five seconds. Provider absence is reported. No GPU/CPU temperature, fan or power sensors. |
| Startup inventory | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Read-only HKCU/HKLM Run, 32-bit Run and Startup folders with available StartupApproved metadata. Guarded disable/restore is provided separately for four supported HKCU launcher Run entries. No publisher verification or fabricated impact score. |
| Launcher startup disable/restore | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Discord, Steam, Epic Games Launcher and Spotify named HKCU Run entries only. Exact command/type snapshot, short-lived review token, guarded removal, relaunch restore and conflict refusal. Does not stop apps, edit StartupApproved, services, tasks or HKLM. |
| Process inventory | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Read-only names, PIDs, memory and available cumulative CPU time. No process termination. |
| Preference catalog | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Eight per-user preferences, explicit target/tradeoff/reload guidance. No elevated/system-wide actions. Existing keys and optional-value guards constrain applicability. Registry verification does not guarantee a visible effect on every OS build. |
| Preference backup and rollback | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Exact original DWORD or absence, durable atomic journal, read-back verification, idempotence, reviewed newest-first batch restoration, partial batch outcomes, recovery and external-change conflict refusal. |
| Reviewed presets | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Competitive FPS, Balanced Gaming, Streaming + Gaming, Creator, Quiet/Everyday and Custom. Five-minute single-use reviews; exact per-item changes, skips and conflicts; previous profile ownership restored before new changes; manual settings preserved; custom selection retained. Presets use only the eight verified catalog preferences. |
| Power-plan selection and restore | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Existing Windows plans only, explicit current/target GUID review, durable original snapshot, read-back verification and external-change refusal. Requires restoring the previous managed plan before another selection. No invented plans, thermal control or guaranteed FPS gain. |
| Combined managed rollback | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | One expiring review for preferences, power, pointer behavior, custom normal cursor, visual effects, supported launcher entries and preset ownership. Exact originals, global mutation serialization, conflict preservation and individual outcomes; cleanup remains irreversible. |
| Pointer acceleration | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Optional Windows API acceleration-off control; durable original thresholds/mode, explicit tradeoff, expiring review, read-back, exact effective-value rollback, external-conflict refusal and combined restore. No DPI, polling-rate, FPS or raw-input latency claim. |
| Windows visual effects | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Seven documented SystemParametersInfo BOOL controls: client-area, menu, combo-box and tooltip animation, list scrolling, selection fading and cursor shadow. Individual current-state detection, expiring review, durable exact effective-value originals, read-back and combined restoration. These are desktop preferences, not game graphics or FPS boosts. |
| Hardware-specific graphics guidance | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Vendor guidance based on reported NVIDIA/AMD/Intel GPU and driver; links to official driver pages and fixed Windows graphics/display settings. Calculated refresh intervals clearly separated from measured latency. Does not infer rendering GPU, feature compatibility or driver freshness. |
| Windows System Restore | NOT IMPLEMENTED | Preference snapshots are not system restore points. No fake create-restore-point action. |
| PC Cleaner: Windows temporary files | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Scanned `.tmp`/`.temp` files older than seven days in known temporary locations; manifest selection, guarded deletion and failures. Personal extensions and recent files are excluded. |
| PC Cleaner: browser caches | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Separate opt-in; exact Chrome/Edge cache-data and Firefox cache-entry locations older than 24 hours. Passwords, cookies, history, profiles and Downloads are excluded. |
| PC Cleaner: Recycle Bin | PARTIAL; PHYSICAL-PC VALIDATION REQUIRED | Separate app confirmation plus Windows confirmation, all current items across drives. No per-file selection or scan-bound manifest; newly added items are included. |
| Cleanup accounting | PARTIAL | Exact logical candidate bytes and confirmed logical removed bytes, displayed in human-readable units. Physical reclaimed bytes are not attributed: allocation/compression, locks and concurrent activity prevent a reliable exact guarantee. |
| Installed game detection | PARTIAL; PHYSICAL-PC VALIDATION REQUIRED | Verified Epic manifests/executables, Steam install manifests/directories including secondary libraries, known Fortnite and VALORANT fallback paths. Native manual executable selection for all six supported guides with PE-header validation, persisted paths, missing-file status and metadata-only removal. Manual paths do not establish game identity. No executable injection, game-file editing or game launch. |
| Fortnite/game recommendations | PARTIAL | Guidance for Fortnite, VALORANT, CS2, Apex, Call of Duty/Warzone and GTA V. All six Windows presets are operational through reviewed catalog actions. No automatic game-file configuration, external overlay removal or measured FPS claim. |
| Benchmark comparison | PARTIAL | Manual measurements plus local CSV frame-interval import (classic PresentMon MsBetweenPresents or frame_time_ms). Validated single-stream input, average FPS, mean-slowest-1% FPS, p99/longest interval, bounded peak chart, reviewed replacement, persisted provenance, per-run PC/preference snapshots, changed-condition notices and CSV export. No live game telemetry, automatic capture, inferred input latency or claimed gains. |
| Dashboard recommendations | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Evidence-based rules for low disk space, sampled memory pressure, storage-provider warnings, display mode, missing driver data and eligible Game Mode review. Reasons and caveats are visible; actions only navigate to review pages. No health score or automatic changes. |
| Privacy-filtered exports | COMPLETE | Native save dialog for system/history JSON; usernames, local paths, serials and addresses omitted by fixed schema. |
| Settings persistence | COMPLETE | Reduced motion, monitor interval and scan-on-launch. No startup registration, tray service or updater. |
| Network diagnostics | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Explicit eight-request ICMP tests to two fixed public destinations; individual replies, round-trip range/mean, adjacent-reply jitter and loss. No background probing, arbitrary target executor, DNS changes or network-stack modifications. |
| Adapter capabilities and DNS check | COMPLETE; PHYSICAL-PC VALIDATION REQUIRED | Explicit physical/virtual/hidden adapter scan, negotiated rate, default-route presence, recognized EEE/interrupt-moderation settings and available power-management states. Fixed-host DNS query through current resolver with measured duration and cache caveat. No inferred game route, retained addresses, automatic probes or adapter/DNS changes. |
| App removal/debloat | NOT IMPLEMENTED | No bundled-app uninstall, security disablement or service disable lists. |
| Portable Windows executable | BUILT; PHYSICAL-PC VALIDATION REQUIRED | Unsigned x64 payload; archive integrity, bundled assets and checksum verified. Packaged Windows launch passed in hosted CI; physical-PC testing remains required. |
| Windows installer | BUILT; PHYSICAL-PC VALIDATION REQUIRED | Per-user x64 NSIS with runtime-generated uninstaller, exact owned-file removal, icons and shortcuts. No Wine required to build. CI includes disposable install/launch/uninstall and preservation checks; install/launch/uninstall and preservation passed in hosted CI; exact outcomes recorded separately. |
| Code signing / auto-update | NOT IMPLEMENTED | No verified-publisher claim, signing certificate or update service. |
| Source and third-party licensing | PARTIAL | Source explicitly UNLICENSED pending owner decision; dependencies retain their licenses and bundled notices. |

The implemented preference IDs are `game-mode`, `game-capture`, `transparency`,
`taskbar-animations`, `file-extensions`, `explorer-checkboxes`, `advertising-id`
and `tailored-experiences`. Quality-of-life/privacy preferences do not claim
in-game performance benefits. Newer Windows versions or organization policy may
ignore or override some preferences.

The benchmark screenshot supplied as reference contains example values. Those
numbers and the reference development PC specifications are not used as live
hardware readings or product performance claims.

There are **21 separately configurable targets**: eight registry preferences,
seven visual-effect preferences, one installed power-plan selector, one pointer
acceleration control, and four allowlisted launcher startup entries. Availability
is detected on each PC. This is not a claim of 21 FPS tweaks; presets reuse these
settings, and diagnostic/cleanup actions are counted separately.
