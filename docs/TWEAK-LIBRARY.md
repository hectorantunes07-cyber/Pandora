# PANDORA — working controls and remaining work

Created by Sonnier. This inventory describes implemented behavior, not measured FPS improvements. Availability is checked on each PC. Settings changed outside PANDORA can block automatic restoration so they are not overwritten.

There are **33 configurable Windows policy/preference values and up to eleven existing Fortnite display/quality values**. Six battery values are counterparts of the existing power controls. Presets reuse these values; they do not add more tweaks. Cursor customization, cleanup and diagnostics are listed separately.

## Working Windows and game controls

| Area | Individually configurable values | Original-setting restoration |
| --- | --- | --- |
| Gaming | Windows Game Mode; Windows game-capture preference | Exact original registry value or original absence |
| Power plan | Choose an existing installed Windows power plan | Exact original plan identifier |
| Processor and PCIe | Minimum processor state; maximum processor state; boost policy; energy preference; PCIe link power management; cooling policy | Separate AC/DC originals on the saved plan; other source preserved |
| Startup | Current-user Run entries for Discord, Steam, Epic Games Launcher and Spotify | Exact original command and registry type |
| Mouse | Windows pointer acceleration | Original two thresholds and acceleration mode |
| Fortnite | Frame cap; V-Sync; dynamic resolution; optional view distance, anti-aliasing, shadows, post-processing, textures, effects, foliage and shading quality, when the existing local configuration exposes supported values | Original owned values; unrelated newer settings preserved; game must be closed |
| Privacy | Advertising ID; tailored experiences | Exact original value or absence |

New battery policy changes require a positively detected battery. Previously saved battery settings remain restorable if the battery later becomes unavailable. Power policies can be overridden by firmware, Windows power mode or OEM software. Favoring performance can increase heat, fan noise and battery drain.

Fortnite, VALORANT, CS2, Apex Legends, Warzone and GTA V have guides and installation/path management. Only the listed Fortnite file values have direct game-file controls. The other guides do not automatically rewrite game configurations. There is no GTA VI entry.

## Quality of Life

The **Quality of Life** page contains these reviewed controls. The same Explorer and visual-effect settings also remain available in Optimizations; both routes use the same original backups.

- **File Explorer and appearance:** show file extensions, show selection checkboxes, reduce transparency and reduce taskbar animations.
- **Seven visual effects:** window-content animation, menu animation, drop-down animation, smooth list scrolling, tooltip animation, menu-selection fading and pointer shadow.
- **Pointer behavior:** optional Windows pointer-acceleration change.
- **Cursor customization:** supplied Sonnier cursor preview, another validated local CUR/ANI file, normal-pointer-only apply, persistent local storage, original-pointer restoration and separate optional in-app use.
- **In Settings & About:** reduced motion, monitoring interval, scan on launch, optional close-to-tray and reviewed installed-app launch at sign-in. Portable builds cannot register their temporary executable at sign-in.

Desktop effects and Explorer/privacy preferences are convenience choices; they are not guaranteed FPS improvements. Applications can ignore Windows appearance preferences. Cursor, sign-in and OEM behavior still need checks on your actual PC and across a restart.

## Supporting tools already implemented

- Hardware inventory; live CPU/RAM and supported GPU utilization; optional NVIDIA driver readings; supported Windows drive-reliability counters. Missing fields stay unavailable.
- PC Cleaner: eligible old temporary files, separately confirmed browser caches and Recycle Bin, progress and skipped-file reporting. Deleted files cannot be rolled back. Totals represent logical file bytes, not guaranteed physical free-space gains.
- Per-setting originals, reviewed presets, combined restoration, activity history, privacy-filtered reports and a Windows restore-point creation helper. Actual Windows client checkpoint creation/UAC still needs validation.
- Network latency/loss/jitter tests, selected-route gateway versus public-destination comparison, adapter capability inspection and DNS timing. Gateway comparisons detect route changes and preserve missing/blocked replies. These are diagnostics; they do not change DNS or adapter configuration.
- Process inspection, on-request CPU activity sampling with identity/timing checks, guarded executable-folder opening, startup inventory and eight optional Windows-app families with a reviewed Windows Installed apps shortcut. Windows handles uninstall; PANDORA does not remove apps automatically.
- Performance Lab: manual comparisons and local frame-time CSV analysis/export. No live game capture or measured input-latency sensor is included.
- NVIDIA Settings: 54 searchable reference entries, Sonnier’s personal setup, saved notes, Global/Per-Game instructions and Control Panel launcher. Driver values are **manual guidance**, not detected or automatically applied settings, and are outside PANDORA rollback.

## Interface readability

Body descriptions, compact buttons, tabs, tables and setting-detail rows use 14px or larger text. Navigation is 14px, the base type size is 15px, secondary descriptions are generally 13px, small metadata/badges are at least 12px, section headings are 20px and important hardware statistics are 18–24px or larger. Component layouts wrap at smaller window sizes; the whole application is not zoomed. Windows display scaling and font rendering still need a real-PC check.

## Still incomplete

- Automatic HAGS, per-game GPU/driver, overlay/fullscreen and broader graphics controls.
- Reversible DNS and adapter power/EEE/interrupt-moderation changes, broader network-path diagnostics and direct optional-app removal.
- CPU/AMD/Intel temperature and fan sensor coverage, vendor-specific drive diagnostics and broader hardware compatibility.
- More automatic game configuration, live game capture and measured performance benefits on physical hardware.
- Signed publisher identity, secure updates and final public-release validation.

Before a public release, test the actual Windows UI/scaling, sensors, driver effects, client restore-point/UAC flow, startup/cursor across reboot, game behavior, and restoration on representative PCs. Hosted Windows CI tests and verified packages do not establish every setting's physical effect.
