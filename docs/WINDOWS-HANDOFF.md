# PANDORA — Created by Sonnier: Windows testing handoff

PANDORA 0.1.0 is a development build, not a signed production release. The full original specification is not finished. The core implemented features have passed the native Windows workflow and are intended for controlled Windows testing. The approximate 72% scope estimate is a planning estimate, not a percentage of Windows compatibility or guaranteed performance.

## Implemented

- Purple/black desktop interface, responsive sidebar, keyboard-accessible confirmations and reduced motion. Window sizing respects the display work area and logical Windows scaling.
- Dashboard recommendations grounded in actual readings, with explicit evidence, caveats and review actions.
- Actual CPU/RAM readings and Windows hardware inventory, GPU/driver data, storage, adapter/link data, display modes, current power plan and unavailable-provider reporting.
- PC Cleaner with measured candidate sizes, selected-category review, guarded deletion, progress and failure reporting; separate browser-cache and Recycle Bin confirmations.
- Eight narrow per-user preferences with original-value backups, verification, history, individual restore and reviewed batch restore. External changes are preserved and reported as conflicts.
- Read-only process/startup inventory, supported game detection and reviewable game guidance.
- User-initiated network latency, jitter and loss measurements; manual before/after benchmark comparisons and exports.
- Local settings, privacy-filtered reports, packaged portable application and per-user installer with uninstall/data-preservation checks.

## Still incomplete or deliberately unavailable

- CPU/GPU temperatures, fan/power sensors, reliable VRAM reporting and broader hardware compatibility validation.
- Startup disable/restore, app removal/debloat, power-plan switching, DNS/adapter changes and advanced GPU tuning.
- Windows System Restore point creation. Preference journals do not back up Windows or recover deleted files.
- Automatic game configuration, in-game FPS/frame-time capture and automated performance claims.
- Signed publisher identity, secure automatic updates and public-release certification.

Unsupported functions are not represented by working toggles. No FPS gain has been established. See `FEATURES.md` for exact scope and provider limitations.

## Get the executable

Use the `PANDORA-Windows-x64-unsigned` artifact from a **successful** [Windows build and checks run](https://github.com/hectorantunes07-cyber/Pandora/actions/workflows/windows.yml). Sign in to GitHub if required. Extract the downloaded ZIP first.

- `PANDORA-Setup-0.1.0-x64.exe`: installs PANDORA for your current Windows account, with shortcuts and an uninstaller.
- `PANDORA-Portable-0.1.0-x64.exe`: runs without installation. It still saves settings and rollback history under `%APPDATA%\PANDORA`.
- Matching `.sha256` files and `verification.json`: exact file identity, source commit and recorded checks.

A locally generated Windows test kit contains the equivalent cloud-built packages and instructions. Its manifest distinguishes local archive verification from native Windows execution. Do not mix an executable with a checksum from another build.

## Your Windows test checklist

Use a backed-up Windows 11 x64 test machine or VM, as a normal user. Keep Windows security enabled.

- [ ] Compare the complete SHA256 against the matching sidecar before running.
- [ ] Install, launch, close, reopen and check every page and display scaling.
- [ ] Compare hardware readings with Windows tools; missing sensor values must remain unavailable.
- [ ] Scan temporary files, review categories and cancel once. Confirm cancellation deletes nothing.
- [ ] Clean only disposable old temporary files first. Verify protected/locked files are preserved or reported and the removed-byte count matches the result.
- [ ] Apply one preference, verify its Windows effect, then restore its exact original state. Preserve the rollback journal.
- [ ] Test optional browser-cache/Recycle Bin cleanup only with disposable data and after reviewing their separate confirmations.
- [ ] Test network diagnostics; blocked ICMP replies must not be interpreted as proven internet failure.
- [ ] Uninstall/reinstall and verify saved history remains. Restore unwanted preferences before uninstalling.

Only after these checks and the full `windows-validation.md` checklist should broader release be considered. Report the build hash, Windows version, exact steps and error; do not publish private file paths or your backup journal.
