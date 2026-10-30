# PANDORA — Created by Sonnier

PANDORA is a local Windows desktop utility with a purple-and-black interface,
hardware diagnostics, live resource monitoring, explicit Windows preference
changes, reviewed presets, reversible power/pointer/visual/startup controls, combined rollback,
a preview-first PC Cleaner, adapter/DNS diagnostics, and local frame-capture analysis. It does not require
an account, collect analytics, or promise FPS improvements.

This is an initial **0.1.0 development release**. The implementation and tests
are useful, but the native Windows flows require validation on real Windows
hardware before broad distribution. See [FEATURES.md](FEATURES.md) for the exact
scope and [the Windows validation checklist](docs/windows-validation.md) for
the remaining release gates. An unsigned installer is not a verified-publisher
release.

## Technical choice

Electron, React, TypeScript, and Vite provide a dependable desktop build pipeline
and a responsive UI in this environment. Electron's larger footprint is a
conscious tradeoff for mature Windows distribution and testable TypeScript
services. The renderer is sandboxed, has no Node access, and communicates through
an explicit typed IPC allowlist. Windows operations live in the main process.
Fixed native scripts call Windows APIs; the renderer cannot send arbitrary shell
commands or registry paths. Details are in [architecture.md](docs/architecture.md).

## Prerequisites and development

- Windows 11 x64 is the primary target. Windows 10 behavior is best effort and
  depends on the installed APIs, OS build, and organizational policy.
- Use Node.js 24 LTS (or Node 22.12+ compatible LTS) and npm. The committed lockfile pins
  the dependency tree.
- A normal user account is sufficient for the implemented per-user preferences.
  Do not launch the whole application as administrator.

```powershell
npm ci
npm run dev
```

The dev launcher builds the main/preload scripts, starts a loopback-only Vite
server, and launches Electron. React changes hot reload. Restart `npm run dev`
after changing Electron services. `npm run dev:web` provides a browser UI
preview: it cannot access Windows or perform system actions, and it labels that
limitation explicitly. Production binaries use only bundled local resources.

```powershell
npm run typecheck
npm test
npx playwright install chromium
npm run test:ui
npm run build
npm start
```

The unit suite uses temporary filesystem fixtures and injected registry
adapters. It never tunes the development host. Passing these tests does not
establish real Windows API compatibility. Browser tests verify UI behavior;
they are separate from native desktop testing.

The Windows workflow additionally opts into registry/profile, power-plan, advanced
AC power policy, launcher startup, pointer, cursor and visual API roundtrips on its disposable GitHub-hosted runner. These
mutation tests require explicit `PANDORA_TEST_WINDOWS_*` flags plus the hosted-runner
identity checks. Keep those flags off on your daily PC; they are not needed for
development. Read-only adapter inspection and guarded temporary filesystem
fixtures also run on Windows.

## Build a Windows installer

Run from a Windows machine after installing dependencies:

```powershell
npm run dist:windows
npm run verify:package
Get-FileHash .\release\PANDORA-Setup-0.1.0-x64.exe -Algorithm SHA256
```

Expected output: `release/PANDORA-Setup-0.1.0-x64.exe`, an NSIS per-user installer
with a start-menu shortcut, desktop shortcut, uninstaller, original icon, and
PANDORA/Sonnier metadata. `release/win-unpacked/PANDORA.exe` is an unpacked build;
keep its neighboring files with it. Build the single-file portable executable with
`npm run dist:portable`; output is `release/PANDORA-Portable-0.1.0-x64.exe`.
Both installer and portable packages have been cross-built and integrity checked;
Windows launch and installation results are recorded separately. The Windows workflow builds both packages, verifies archives and bundled code,
runs a read-only desktop smoke check, and uploads artifacts without publishing
a release. Download the `PANDORA-Windows-x64-unsigned` artifact from a successful
run in the repository’s Actions tab. An artifact is a testing build, not evidence
that manual Windows release checks have passed.

Consult [docs/VALIDATION.md](docs/VALIDATION.md) for the exact package sizes,
checksums, tested source and remaining validation. The custom per-user NSIS installer creates its uninstaller during installation,
so the current build does not need Wine. A local `npm run dist:linux` build is useful for UI testing;
Windows preferences and cleanup remain unavailable there.

No signing certificate or automatic updater is configured. Publisher metadata
does not constitute signing. For public distribution, the owner must choose a
source license, review dependency notices, validate Windows behavior, and set up
trusted code signing. Do not disable Windows security controls to run PANDORA.

## First use and recovery

1. Open **System Monitor** to review detected devices and unavailable providers.
2. Open an optimization, review its exact target and tradeoffs, then confirm the
   selected changes. A durable original-value snapshot precedes every write.
3. Open **Restore & History** to inspect results and
   restore individual changes or review **Restore all managed**. A successful setting write is not evidence of
   an FPS improvement. Retest a comparable game workload yourself.
4. Open **PC Cleaner**, choose **Scan & Clean**, review categories and measured
   candidate bytes, then confirm. Browser cache and Recycle Bin are separate
   opt-in flows. Recycle Bin emptying covers all current items across drives and
   retains the Windows confirmation. Locked or changed files are skipped and
   reported. Cleanup is
   irreversible and is not covered by preference backups.

PANDORA stores settings and its rollback journal in Electron's per-user
application-data directory, normally `%APPDATA%\PANDORA` on Windows. Backups
include `backups\tweaks-v1.json`, `power-v1.json`, `startup-v1.json` and
`pointer-v1.json`, `visual-effects-v1.json`, `cursor-v1.json` and `power-tuning-v1.json`; settings are `settings.json` and manual game locations are
`game-paths-v1.json`. Preserve the entire
directory when backing up. Do not edit the journal or delete it while changes
remain applied. PANDORA refuses to overwrite a later external preference change;
a conflict needs manual review of the saved original and actual Windows setting.

Before uninstalling, revert changes you no longer want from inside PANDORA.
Uninstalling does not revert Windows preferences and leaves user data in place,
so a later installation can still find the rollback history. Preference backups
are not Windows System Restore points or file backups.

## Additional reviewed controls

- **Game Profiles:** select Competitive FPS, Balanced, Streaming + Gaming, Creator,
  Quiet/Everyday or Custom, then review the exact catalog changes. Profile off
  restores profile-owned settings while preserving independent settings. These
  profiles do not automatically edit game files or choose a power plan.
- **Game locations:** choose the actual executable using the native file picker
  for a missed custom installation. Manual paths are labeled as user selections;
  PE headers are checked, but game identity is not inferred. Forget removes only
  PANDORA metadata. The app never executes or injects into the selected file.
- **Power and pointer:** review installed power plans or optional pointer
  acceleration changes in Optimizations. Both save originals and support guarded
  restoration. A different power plan may increase heat without improving FPS;
  raw-input games may ignore desktop pointer acceleration.
- **Processes & Startup:** inspect running processes and startup inventory.
  Guarded disable/restore applies only to the four supported named HKCU Run
  launcher entries. Other startup mechanisms remain read-only.
- **Network Diagnostics:** inspect physical/virtual adapters and driver-reported
  EEE, interrupt moderation and power capabilities. DNS testing uses the current
  resolver on request. These diagnostics do not modify adapter settings or prove
  which route carries a game, and DNS query duration is not game-server latency.
- **Restore & History:** Review all managed changes combines preferences,
  power, pointer, visual preferences, supported launcher entries and preset ownership. Individual
  outcomes and skipped conflicts remain visible; cleanup cannot be undone.

## Compare a measured game run

In **Performance Lab**, capture the **Before PC configuration** near your baseline
run. Enter measured FPS/latency or import a CSV with one `frame_time_ms` or classic
PresentMon `MsBetweenPresents` column, in milliseconds. Export one process and one
swap chain; multiple streams are rejected. Review the preview before replacing
FPS values. Repeat the same game scene and settings after one deliberate change,
then capture the **After PC configuration** and measurements.

Average FPS uses frame count divided by total interval time. Imported 1% low uses
1,000 divided by the mean of the slowest `ceil(frame count × 0.01)` intervals.
Other tools may use percentile definitions, so compare like-for-like. The chart
shows interval peaks per frame bucket; stalls are retained. Captures need at least
100 frames and accept up to 250,000 frames / 8 MiB. Modern PresentMon columns with
other names or units are not guessed automatically.

Click **Save measurements** to retain the comparison and configuration snapshots.
Raw rows, capture filenames and process identities are not saved. CSV export
includes measurement sources, calculation method and recorded conditions. A
changed driver, power plan, display mode or preference is flagged as a possible
confounding factor. Frame intervals do not establish input latency, displayed
FPS or causation; PANDORA does not record game frames itself.

## Troubleshooting

- **No native data in a browser:** launch the Electron app with `npm run dev` or
  the installed application. A web page cannot access this native API.
- **Unknown or missing hardware fields:** sensor and driver providers vary.
  Missing temperatures or GPU load are shown as unavailable, not estimated.
- **A setting is unavailable, blocked, or unchanged:** Windows policies and
  versions can override preferences. The operation is verified by rereading its
  stored value; review the history message. No security bypass is attempted.
- **A cleanup file was skipped:** close the app using it and rescan. Do not grant
  broad extra privileges or delete system folders manually.
- **Backup cannot be written:** free space in the application-data volume and
  check the current user's access. PANDORA stops before changing a preference if
  its original state cannot be saved.
- **Electron cannot open on Linux:** a graphical session and Chromium runtime
  libraries are required. A Linux UI check is not Windows integration validation.

## Repository map

| Location | Purpose |
| --- | --- |
| `src/` | React pages, UI state, components, styles, browser fallback |
| `shared/types.ts` | Typed renderer-to-desktop contract |
| `electron/` | Desktop lifecycle, allowlisted IPC, system services, cleanup and rollback |
| `tests/` | Isolated unit, safety and UI checks |
| `build/` | Original editable SVG, PNG/ICO assets, installer text |
| `scripts/` | Development launcher, Electron bundling, icon generation |
| `docs/` | Architecture, validation status and Windows release checklist |
| `.github/workflows/windows.yml` | Reproducible Windows build and unsigned artifact upload |

Regenerate icon assets with `bash scripts/generate-icons.sh` where Inkscape and
ImageMagick are installed. The ICO contains 16, 24, 32, 48, 64, 128 and 256 px
images. No competitor imagery is shipped. Source licensing is **UNLICENSED**
pending the owner's decision; see [LICENSE](LICENSE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Additional integration checks

`node scripts/check-native-syntax.mjs` parses the fixed PowerShell queries and
compiles the cleaner’s C# declarations without invoking Windows APIs. It needs
PowerShell (`powershell.exe` on Windows or `pwsh` elsewhere); set `PANDORA_PWSH` to
an explicit executable path when necessary. This catches syntax errors, not
Windows runtime compatibility.

After `npm run build`, `node scripts/smoke-desktop.mjs` opens the bundled desktop
interface and checks the real preload bridge and read-only hardware service.
It never applies tweaks or deletes files. In an isolated Linux container only,
`PANDORA_CONTAINER_SMOKE=1` uses headless Chromium test flags including
`--no-sandbox`; those flags are never part of the normal app, installer or
development launcher. Such a test does not validate Chromium’s OS sandbox.

## Package verification and your first Windows test

`npm run verify:package` requires 7-Zip (the Windows runner includes it). Set
`PANDORA_7ZIP` to an explicit executable if needed. It checks PE architecture,
both portable archive layers, packaged code against the production build and
license notices, then writes SHA256 sidecars and `release/verification.json`.
Use `npm run verify:package -- --portable-only` when only the portable exists.
A mismatched, missing or incomplete package fails verification.

See [the Windows quick start](docs/WINDOWS-QUICKSTART.md) for a short, ordered
first test and [the full checklist](docs/windows-validation.md) for release gates.

## Hardware and connection diagnostics

System Monitor now reads physical disk model/media/bus/provider health, physical
network adapter descriptions and link rates, installed versus OS-usable RAM,
device type and last boot when Windows exposes them. RAID/virtual storage may
hide devices; missing data is reported as unavailable. Link rate is not measured
internet throughput. Power, display and startup shortcuts open fixed Windows
Settings pages so you can review supported controls yourself.

Network Diagnostics sends eight bounded ICMP requests only when Start test is
selected, to Cloudflare (1.1.1.1) or Google (8.8.8.8). It shows each actual reply,
round-trip range/mean, missing replies and mean absolute changes between adjacent
successful samples. ICMP blocking/deprioritization can look like loss; these
destinations do not measure game-server latency. No DNS or adapter settings change.

The Windows workflow includes a disposable install/installed-launch/uninstall
check with user-data and unrelated-file sentinels. `scripts/test-installer.ps1`
refuses to run outside a GitHub-hosted CI runner. These checks complement the
manual Windows release checklist; they do not certify all physical machines.

### Visual preferences and graphics guidance

Optimizations also includes six advanced plugged-in power controls: processor
minimum/maximum state, boost policy, energy preference, PCIe link-state savings
and cooling policy. Each shows the current stored value and a review of the
proposed value and tradeoffs. Exact originals are backed up before writing and
can be restored individually or through combined rollback. Battery values and
unrelated plans are preserved. Availability does not prove hardware effectiveness:
Windows power mode, firmware and OEM software can override the stored policy.
Permission failures remain explicit; do not elevate the entire application to
bypass organizational policy. These controls are never silently applied by a preset.

Optimizations includes seven Windows visual-effect controls with actual API
readings, individual confirmation, durable originals and exact effective-value
restoration. Unsupported values remain unavailable. These controls affect desktop
appearance, not game graphics or promised FPS. They participate in combined
rollback. Native round-trip tests are limited to explicitly disposable hosted CI
with `PANDORA_TEST_WINDOWS_VISUAL=1`; never enable fixture mutation tests on your PC.

GPU guidance uses the detected vendor and driver inventory. Windows graphics and
display shortcuts open the relevant settings page; PANDORA does not silently
change GPU scheduling, driver profiles or VRR. Refresh intervals are calculated
from reported Hz and are not input-latency measurements.

### NVIDIA hardware readings

System Monitor can query the installed NVIDIA SMI utility for per-device memory
usage/capacity, temperature, graphics clock, power draw and utilization. PANDORA
uses fixed read-only arguments and fixed Windows installation locations; it does
not download tools, search PATH, change clocks, or require NVIDIA on other PCs.
Snapshots load when opening System Monitor and on explicit refresh, with a
15-second cache and bounded execution. Unsupported fields remain unavailable.
Reports include these readings with a separate timestamp and provider label.
Physical NVIDIA hardware/driver verification is still required; hosted Windows
CI usually has no NVIDIA GPU. CPU and AMD/Intel sensor providers are unfinished.

### Windows System Restore

Restore & History includes a separate Windows restore-point section. List recent
points, review creation, or open System Protection. Confirmed creation requests
UAC approval only for a fixed helper using Windows PowerShell Checkpoint-Computer;
PANDORA is not relaunched elevated. The helper restricts its module search path
to built-in PowerShell modules and verifies a new matching sequence before
reporting success. No renderer command, path or custom script is accepted.

Windows client editions and configured System Protection are required. Windows
may limit new points to one per day. PANDORA does not change that policy, enable
protection, delete points or start full-system restoration. Points are not file
backups; Windows owns retention. Actual UAC/create behavior requires a Windows
10/11 client test: hosted Windows Server CI cannot validate native creation.


## Drive reliability diagnostics

System Monitor includes an explicit **Read drive counters** action. Windows Storage
can report temperature, endurance wear, power-on hours and read/write error counts
for supported physical disks. Unsupported counters remain unavailable; driver or
permission failures do not become a healthy result. A 30-second cache and a bounded
read-only query prevent continuous polling. System JSON reports include the same
privacy-filtered snapshot, without serials, device IDs or local paths.

Wear is estimated endurance used, not remaining life. The feature does not run
SMART self-tests, reset counters or repair disks. Compare the readings with the
manufacturer's utility on actual SSD/HDD and USB/RAID configurations before relying
on them; hosted Windows CI cannot establish physical sensor accuracy.


## Sign-in launch and notification area

Settings includes optional **Launch PANDORA at sign-in** for the per-user installed
app and **Close to notification area** for the Windows desktop app. Both default
to off. Sign-in registration uses only PANDORA's named HKCU Run entry and cannot
overwrite an external replacement or register a portable extraction path. Windows
startup approval remains under the user's control. Launching never applies tweaks
or cleans files automatically.

Close-to-tray preserves the window; the icon menu, a click, or a second launch
reopens it. Use **Exit PANDORA** to quit. Closing and quitting remain guarded during
active mutations. Uninstall removes a matching sign-in command while preserving
rollback data, unrelated entries and Windows approval metadata. Actual Windows
sign-in and shell icon presentation remain physical-PC checks.


## Managed settings report

In **Restore & History**, use **Export managed report** to save a privacy-filtered
JSON report. It includes preference operation history and current snapshots of
managed power, startup, pointer, cursor, visual and preset settings. Sections that
cannot be read are marked unavailable; missing readings do not become false or
zero. The collection interval and schema version are included.

This report is for diagnosis and cannot restore settings. Keep the original local
PANDORA backups. Startup commands, local paths, cursor images, review tokens, raw
errors and custom power-plan names are excluded. Other than preference history,
these sections are current snapshots, not an exhaustive event log. Windows or
other applications can still change settings while the report is collected.


## Activity timeline

**Restore & History → Activity timeline** records supported PANDORA operations
from this version onward, including cleanup and restoration. Search by operation
and filter by result. The latest 500 entries are retained; older records and
reviewed clearing are counted. Activity is included in Export managed report.

Clearing activity requires confirmation and never deletes original-value backups
or the existing preference restoration history. An interrupted operation is
shown as Not confirmed; check current settings before retrying. If logging fails,
PANDORA reports the gap and keeps the underlying operation/rollback available.
A damaged activity file is preserved. Private paths, commands, filenames and raw
error details are not recorded. Read-only scans/diagnostics and external Windows
changes are outside this timeline; it does not reconstruct older activity.

### Fortnite display preferences

Game Profiles → Fortnite now reads the existing local frame cap, V-Sync and dynamic-resolution values. Close Fortnite, choose your values, review, then confirm. Originals are saved first. Restore original configuration or combined rollback restores only PANDORA-owned values while preserving newer unrelated settings. External conflicts and unfamiliar formats are refused. This does not launch the game or touch executables/anti-cheat. Verify the video menu and measure performance yourself; game updates or cloud sync may override stored preferences. See [scope and validation](docs/FORTNITE-SETTINGS.md).
