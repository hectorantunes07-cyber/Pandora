# PANDORA feature status

**Created by Sonnier · 0.1.0 development release**

`COMPLETE` means the scoped implementation is present, not that every Windows
machine is certified. `WINDOWS VALIDATION REQUIRED` marks native behavior that
Linux tests cannot establish. See [docs/VALIDATION.md](docs/VALIDATION.md) for
actual test/build outcomes and [the release checklist](docs/windows-validation.md).

| Feature | Status | Scope and limitations |
| --- | --- | --- |
| Original branding and desktop shell | COMPLETE | Purple/black React UI in Electron; original SVG/PNG/ICO assets, PANDORA and Created by Sonnier identity. |
| Hardware inventory | PARTIAL; WINDOWS VALIDATION REQUIRED | CPU/core count, RAM, GPU/driver, OS, motherboard, active power plan and fixed volumes. Display information comes from active video controllers and may not map one-to-one to monitors. Physical storage model/media/bus/health, physical network adapters/link rates, installed versus usable RAM, device type and last boot are now reported when exposed. VRAM and detailed sensors remain unavailable. |
| Live CPU/RAM/process monitoring | COMPLETE; WINDOWS VALIDATION REQUIRED | Actual OS observations with timestamps. Process CPU values are cumulative seconds, not a percent estimate. |
| GPU utilization | PARTIAL; WINDOWS VALIDATION REQUIRED | Busiest 3D-engine utilization from CIM, cached at five seconds. Provider absence is reported. No GPU/CPU temperature, fan or power sensors. |
| Startup inventory | COMPLETE; WINDOWS VALIDATION REQUIRED | Read-only HKCU/HKLM Run, 32-bit Run and Startup folders with available StartupApproved metadata. No disable/restore actions, publisher verification or fabricated impact score. |
| Process inventory | COMPLETE; WINDOWS VALIDATION REQUIRED | Read-only names, PIDs, memory and available cumulative CPU time. No process termination. |
| Preference catalog | COMPLETE; WINDOWS VALIDATION REQUIRED | Eight per-user preferences, explicit target/tradeoff/reload guidance. No elevated/system-wide actions. Existing keys and optional-value guards constrain applicability. Registry verification does not guarantee a visible effect on every OS build. |
| Preference backup and rollback | COMPLETE; WINDOWS VALIDATION REQUIRED | Exact original DWORD or absence, durable atomic journal, read-back verification, idempotence, reviewed newest-first batch restoration, partial batch outcomes, recovery and external-change conflict refusal. |
| Windows System Restore | NOT IMPLEMENTED | Preference snapshots are not system restore points. No fake create-restore-point action. |
| PC Cleaner: Windows temporary files | COMPLETE; WINDOWS VALIDATION REQUIRED | Scanned `.tmp`/`.temp` files older than seven days in known temporary locations; manifest selection, guarded deletion and failures. Personal extensions and recent files are excluded. |
| PC Cleaner: browser caches | COMPLETE; WINDOWS VALIDATION REQUIRED | Separate opt-in; exact Chrome/Edge cache-data and Firefox cache-entry locations older than 24 hours. Passwords, cookies, history, profiles and Downloads are excluded. |
| PC Cleaner: Recycle Bin | PARTIAL; WINDOWS VALIDATION REQUIRED | Separate app confirmation plus Windows confirmation, all current items across drives. No per-file selection or scan-bound manifest; newly added items are included. |
| Cleanup accounting | PARTIAL | Exact logical candidate bytes and confirmed logical removed bytes, displayed in human-readable units. Physical reclaimed bytes are not attributed: allocation/compression, locks and concurrent activity prevent a reliable exact guarantee. |
| Installed game detection | PARTIAL; WINDOWS VALIDATION REQUIRED | Verified Epic manifests/executables, Steam install manifests/directories including secondary libraries, known Fortnite fallback path. No executable injection, game-file editing or game launch. GTA VI has no supported profile. |
| Fortnite/game recommendations | PARTIAL | Guidance and review of implemented preferences. No automatic game configuration, external overlay removal or measured FPS claim. |
| Benchmark comparison | PARTIAL | Manual user-supplied comparison when shown; no live game telemetry, automatic benchmark capture, imported frame traces or claimed gains. |
| Privacy-filtered exports | COMPLETE | Native save dialog for system/history JSON; usernames, local paths, serials and addresses omitted by fixed schema. |
| Settings persistence | COMPLETE | Reduced motion, monitor interval and scan-on-launch. No startup registration, tray service or updater. |
| Network diagnostics | COMPLETE; WINDOWS VALIDATION REQUIRED | Explicit eight-request ICMP tests to two fixed public destinations; individual replies, round-trip range/mean, adjacent-reply jitter and loss. No background probing, arbitrary target executor, DNS changes or network-stack modifications. |
| App removal/debloat | NOT IMPLEMENTED | No bundled-app uninstall, security disablement or service disable lists. |
| Portable Windows executable | BUILT; WINDOWS VALIDATION REQUIRED | Unsigned x64 payload; archive integrity, bundled assets and checksum verified. Packaged Windows launch passed in hosted CI; physical-PC testing remains required. |
| Windows installer | BUILT; WINDOWS VALIDATION REQUIRED | Per-user x64 NSIS with runtime-generated uninstaller, exact owned-file removal, icons and shortcuts. No Wine required to build. CI includes disposable install/launch/uninstall and preservation checks; install/launch/uninstall and preservation passed in hosted CI; exact outcomes recorded separately. |
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
