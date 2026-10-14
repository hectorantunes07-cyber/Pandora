# Changelog

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
