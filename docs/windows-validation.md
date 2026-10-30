# Windows release validation checklist

This checklist is **not a record of passing tests**. Run it on disposable
Windows 11 x64 virtual machines and representative physical hardware before
distributing PANDORA broadly. Repeat important cases on a standard account and
an administrator account without elevating the GUI. Windows 10 is best effort.

## Installation and lifecycle

- Verify the installer hash, icon, product/creator text, start-menu/desktop
  shortcuts, custom installation path and per-user scope.
- Install, start, close and relaunch; verify saved settings and history persist.
- Attempt a second instance; it should focus the existing app.
- Check 1280×720, 1920×1080 and high-DPI scaling at 100/125/150/200 percent.
- Navigate every route with keyboard only. Test dialog focus/escape, reduced
  motion, accessible names, missing data and service failures.
- Confirm no process is unnecessarily elevated, no login is needed, and core
  flows work with networking disabled.
- Uninstall with a pending managed preference. Verify the app warns about
  retained changes, leaves journal data intact and does not alter unrelated
  Windows settings. Reinstall and confirm the journal can still restore them.

## Read-only integration

- Compare CPU, memory, GPU/driver, volumes, display data and OS build with native
  Windows tools. Include a multi-GPU machine, a laptop and multiple volumes.
- Deny or stop individual WMI/CIM providers in an isolated VM; a subsystem
  failure must not fabricate data or blank all results.
- Compare CPU/RAM metrics with Task Manager over time. Confirm hidden/minimized
  polling is reduced or paused, without overlapping expensive scans.
- Test absent GPUs/sensors and inaccessible process/startup paths. Inspect that
  unknown values stay unknown.
- Test detected and absent supported games. No sample reference hardware should
  be presented as detected.
- Inspect exported JSON for private paths, usernames, serials and addresses.

## Every catalog preference

For each ID in `electron/tweak-catalog.ts`, use a disposable VM snapshot:

1. Record the original Windows value and UI behavior, including an absent value.
2. Review the target, tradeoff and reload/restart notice in PANDORA.
3. Apply; verify the snapshot predates the write and the stored value is reread.
4. Confirm Windows honors the preference where applicable; document OS builds
   that ignore or override it. Registry persistence alone is not effectiveness.
5. Apply again; the original backup must remain unchanged.
6. Revert; verify the exact original value or absence, then restart/reopen the
   relevant shell/app where needed.
7. Modify the value externally after applying; revert must report a conflict and
   preserve the new value.
8. Test permission denial, disk-full journal writes, process interruption before
   and after mutation, corrupt/oversized journal, and failed verification.
9. Batch several items with one failure; inspect individual outcomes and recovery.

## Cleaner

- Create disposable old temporary files, recent files, nested directories,
  locked files, hard links, symbolic links, junctions and other reparse points.
- Put sentinel personal files outside the allowlisted roots. None may change.
- Scan, modify/replace candidates, then clean. Changed identities must be skipped.
- Attempt a junction/rename race between scan and delete. The native provider
  must operate only on validated candidates without following the changed path.
- Validate selected-category isolation, scan expiry, forged scan IDs, duplicate
  category IDs, invalid confirmations and partial permission failure reporting.
- Compare reported candidate sizes, confirmed deleted sizes, and volume free
  space; account for allocation/compression and unrelated disk activity.
- Confirm browser cleanup touches cache only, requires a separate confirmation,
  and preserves passwords, cookies, history, downloads and profiles.
- Confirm Recycle Bin cleanup uses its separate confirmation and clearly warns
  that all current items across all drives will be emptied, including items added
  since scanning. Test OS confirmation cancellation and partial failure. Test
  items from multiple volumes and unusual names.
- Never run these destructive cases against an actual user's personal files.

## Release decision

Record OS builds, hardware, commit/build ID, exact outcomes and unresolved issues
in `docs/VALIDATION.md`. Do not replace this checklist with blanket claims of
Windows compatibility, anti-cheat approval or FPS improvement.


## Frame capture imports

- Export one game process and swap chain using classic PresentMon `MsBetweenPresents`, or provide an explicit `frame_time_ms` column in milliseconds. Modern PresentMon layouts with other metric names are not inferred automatically.
- Import before and after runs with identical settings/scenario/capture method. Check review/cancel, source labels, persistence and CSV export.
- Independently verify average FPS as frame count / sum of intervals in seconds, and 1% low as 1000 / mean of the slowest ceil(N × 0.01) intervals. Percentile FPS reported by some tools uses a different definition.
- Confirm missing/malformed/mixed-stream input does not replace existing measurements. No captured intervals establish input latency or causation of a performance change.

## Presets, power, pointer and launcher startup

- Review each preset and Custom, cancel once, apply, switch, and turn it off.
  Individually applied/pre-existing settings must stay separate from profile
  ownership. Preserve saved custom choices across preset switches and relaunch.
- For an existing alternate power plan, review the exact GUID and tradeoff,
  apply, relaunch and restore the original. Test a device exposing only Balanced.
  An external plan change or removed original plan must not be overwritten.
- Test optional pointer acceleration only after recording current behavior.
  Verify immediate Windows behavior and exact API thresholds/mode restoration;
  test an external edit and provider denial. Raw-input games may be unaffected.
- For each supported HKCU launcher entry, inspect the saved command/type,
  disable, close/reopen and restore. Do not expect current processes to stop or
  Windows StartupApproved/service/task entries to change. External replacements
  must block automatic restoration.
- Review all managed changes, cancel once, then confirm. Inspect every result.
  Simulate one provider being unavailable and an external conflict; unrelated
  valid changes may restore, while skipped originals must remain available.

## Manual game paths and expanded network diagnostics

- Choose a real custom-install game executable, cancel once, save and relaunch.
  Move the executable temporarily to confirm missing-path status. Forget the
  selection and verify no game file was modified or deleted.
- Compare CPU reported clock and OS architecture with CIM, including missing
  values. Reported clock is a scan snapshot, not live boost telemetry.
- Inspect a physical Ethernet adapter, Wi-Fi and a VPN/virtual adapter. Compare
  link rates and driver-reported EEE/interrupt-moderation options with Windows.
  Power-management permission failures must stay unavailable, with no elevation
  prompt, invented values, connection reset or applied change.
- Check default-route indications against Windows; do not infer game routing.
  Run DNS checks with working, cached, blocked and disconnected conditions.
  DNS duration must never be presented as Fortnite server ping or input latency.

## Visual effects and graphics guidance

- [ ] For each of the seven supported visual controls, record the current Windows
      appearance. Review/cancel once, apply, reopen relevant apps, relaunch PANDORA
      and restore. Only that selected effect should change.
- [ ] Confirm disabled effects are not claimed as PANDORA changes. Unavailable
      providers must remain unavailable, with originals retained.
- [ ] Apply two visual preferences and use combined restore. Both must return to
      their saved effective API values; review individual outcomes.
- [ ] Compare GPU/driver identity and active display rate with Windows tools.
      Verify NVIDIA/AMD guidance is conditional, fixed settings links open the
      correct page, and milliseconds per refresh is not labeled input latency.


## NVIDIA configuration and cursor customization

- [ ] Open NVIDIA Settings; confirm detected GPU/driver match your hardware. Sonnier's reference values must not be mistaken for detected settings.
- [ ] Search and filter the 54 settings; switch Global/Per-Game guidance. Save notes and reopen the application to confirm persistence.
- [ ] Open the real NVIDIA Control Panel using the launcher. On unsupported hardware or a missing installation, verify the failure message and manual Start-menu alternative.
- [ ] Record original driver values before manually changing anything. Driver defaults and PANDORA rollback are not backups of manual NVIDIA changes.
- [ ] In Quality of Life, verify the actual supplied crosshair preview and hotspot. Cancel Apply Cursor and confirm no Windows change.
- [ ] Apply only the normal pointer, check text/busy/resize roles are unchanged, restart PANDORA, and restore the exact previous pointer.
- [ ] Apply again and restart Windows. Confirm the persistent app-data file is still used, then restore. Repeat with a local CUR and supported ANI file (in-app animation is a static first frame).
- [ ] Change the normal pointer outside PANDORA while it is managed. Confirm conflict reporting and that automatic rollback does not overwrite the external change.
- [ ] Toggle in-app use separately. Check cursor behavior on buttons, text fields, disabled controls and resizing. No Windows write should occur.
- [ ] Review combined rollback and verify the custom normal pointer is included with its original value.
- [ ] Check all pages at 100%, 125%, 150% and 200% display scaling for readable text, keyboard access, wrapping and scrolling.


## Advanced power controls

- On a standard account, record the active plan and AC/DC values before using a supported control. Review/cancel must not write; confirmed apply must preserve the original before writing and report read-back accurately. Permission or policy denial must remain explicit.
- Test CPU minimum/maximum, boost policy, energy preference, PCIe savings and cooling policy separately where supported. Power mode, firmware and OEM controls may override effective behavior; a stored value alone is not evidence of clocks, fan speed, latency or FPS.
- Reopen PANDORA and restore exact original values. Switch the active plan externally before restoration: restore the saved plan without activating it. Battery/DC values must remain unchanged throughout.
- Test a valid pair of changed CPU bounds and combined restore in both directions. Minimum must never exceed maximum during the sequence. External modifications and deleted/unavailable plans must preserve backups and be reported rather than overwritten.
- Compare repeated same-scene frame captures and actual thermals/noise/power on representative hardware. Do not recommend maximum performance universally, particularly on laptops. PANDORA does not presently measure temperatures itself.

The implementation uses PowerGetActiveScheme, PowerReadACValueIndex, PowerWriteACValueIndex and PowerSetActiveScheme. Fixed setting identifiers were cross-checked against Microsoft's [Windows SDK winnt.h](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/winnt.h). Unsupported stored values remain unavailable; power-policy presence does not establish hardware effectiveness.


## NVIDIA driver telemetry

- Compare each supported NVIDIA device against NVIDIA SMI on the same PC. Check VRAM units (MiB/GiB), temperature, graphics clock, utilization and reported power; these are sampled driver values, not guarantees of throttling or performance.
- Test NVIDIA absent, a missing utility, driver errors/timeouts, unsupported individual fields and multiple GPUs. All failures must remain unavailable, with no prior snapshot represented as current. AMD/Intel GPUs should still retain existing hardware inventory even though this sensor provider is NVIDIA-only.
- Refresh within and after 15 seconds; check the cache label/timestamp and verify no periodic NVIDIA subprocess runs while idle. Provider queries occur only when entering System Monitor, explicitly refreshing or exporting a system report.
- Inspect the exported provider timestamp and numeric fields; no UUID, serial, bus address, executable path or command output should be retained.


## Windows System Restore (Windows 10/11 client only)

- Use a disposable client VM with System Protection configured and no checkpoint in the past day. As a standard user, inspect the point list; if access is denied, the UI should explain it while permitting a reviewed administrator request. Windows Server must show unsupported and never offer creation.
- Cancel PANDORA's review: no UAC prompt or checkpoint should occur. Then confirm and cancel UAC: show cancellation without success. PANDORA itself must not restart elevated.
- Confirm creation with administrator approval. Verify a new PANDORA description and sequence in Windows System Protection. Success requires the helper to find a point absent from its baseline. A listed point is not proof that every future system restoration will succeed.
- Retry within the Windows creation-frequency interval, turn off protection in the disposable VM, deny elevation and test insufficient disk space. No skipped/failed request may be reported as a completed backup. Do not change Windows protection or frequency policy merely to make a test pass.
- Inspect the separate helper command: only the fixed Checkpoint-Computer MODIFY_SETTINGS operation, provider reads and verification are permitted. It must not accept renderer scripts/paths or write user-controlled elevated result files. Built-in module search is constrained to PSHOME Modules.
- Test interrupted/long-running creation. If confirmation times out, it may still finish; refresh System Protection before retrying. Do not infer that a timeout proves nothing happened.
- Keep exact PANDORA setting rollback separate from Windows System Restore. PANDORA must never select a point and automatically restore/reboot the OS, delete points, enable protection or bypass frequency policy.

References: [Microsoft Checkpoint-Computer](https://learn.microsoft.com/powershell/module/microsoft.powershell.management/checkpoint-computer?view=powershell-5.1) and [SystemRestore.CreateRestorePoint](https://learn.microsoft.com/windows/win32/sr/createrestorepoint-systemrestore).


## Storage reliability counters

- Open System Monitor without requesting counters; no storage-reliability query should run. Click Read drive counters explicitly. System report export may also request this read-only snapshot.
- On supported SSD and HDD devices, compare model, provider health, temperature, reported wear, power-on hours and read/write counters with Windows Get-StorageReliabilityCounter and the manufacturer's diagnostics. Record which fields the driver does not expose. Snapshot labels do not map to drive letters or Windows disk numbers.
- Verify unavailable fields remain unavailable and reported zero stays distinct from a missing value. Wear is endurance used, not percent of life remaining; it can reach or exceed 100. No safe-temperature or remaining-life prediction should appear.
- Test standard-account permission failures, USB/RAID/virtual disks, missing providers and unplugged external storage. Old successful readings must disappear after a failed refresh. A partial device failure must not replace another disk's data.
- Refresh within 30 seconds: show a cached timestamp. Refresh after expiry: request a new snapshot. No counter reset, repair, self-test, administrator prompt or disk setting change should occur.
- Export system JSON and check decimal-string counters retain exact large integers. No storage serial numbers, raw device IDs, local paths or provider exception text should be present.

References: [Get-StorageReliabilityCounter](https://learn.microsoft.com/powershell/module/storage/get-storagereliabilitycounter) and [MSFT_StorageReliabilityCounter](https://learn.microsoft.com/windows-hardware/drivers/storage/msft-storagereliabilitycounter).


## PANDORA sign-in launch and notification area

- Both options must be off on a fresh install and after migrating an older settings file. Portable/development builds must not offer sign-in registration; the installed executable must match the per-user installation record and marker.
- Cancel Enable sign-in launch review, then confirm a fresh review. Inspect Windows startup settings: registration and Windows approval are separate. If disabled there, PANDORA must report that state and must not override it. Sign out/in on a test PC and confirm PANDORA opens normally without applying tweaks or cleaning files.
- Disable sign-in launch and confirm the matching Run entry is removed. An external replacement must be preserved and reported as a conflict. Reinstall/uninstall must remove only the command targeting that installation, preserving Windows StartupApproved metadata and unrelated entries.
- Enable Close to notification area, close the window, and verify the icon remains accessible. Open from its menu/click and from launching a second instance. Hidden live metrics should pause. Disable the option while hidden through a reopened window; the icon should disappear and normal closing should exit.
- Test Exit PANDORA from Settings and the tray. During a disposable cleanup/settings operation, close/exit must wait and preserve progress. After it finishes, exit should work. OS forced shutdown cannot be treated as a graceful exit.
- Relaunch and check the tray preference persists. Test notification-area icon visibility at your Windows scaling and Explorer restart behavior; hosted CI cannot fully certify shell presentation or actual sign-in.


## Managed settings report

- In Restore & History, export a managed report, cancel once, then choose a disposable JSON file. Cancellation must not claim a saved report or refresh native review state. Repeated clicks while saving must not open duplicate dialogs.
- Confirm schemaVersion 2 and all ten sections. Apply one reviewed setting in a disposable environment and compare original/current/applied values, then relaunch and export again. After exporting, fresh UI reviews and normal rollback must still work.
- Check missing native providers retain null values and supported flags. A section whose journal cannot be read must be explicitly unavailable and collectionComplete false; no raw error or private path should appear. collectionComplete means sections were collected, not that every Windows provider is supported.
- Inspect startup and cursor sections for absence of commands, paths, pixels and review tokens. Saved originals remain in the local backups; this report cannot be imported or used as a replacement backup. It is not a complete cross-feature chronological log.

## Actual portable launcher

- Run the portable EXE itself, not a manually extracted PANDORA.exe. Confirm extraction, navigation, actual hardware inventory, bundled cursor preview and normal exit. Run it a second time and check ordinary app-data persistence. Sign-in registration must remain unavailable for the temporary extraction path.
- Hosted Windows CI runs the actual launcher with an isolated profile and a loopback debugging endpoint, checks the renderer/bridge, and exits without cleanup or tuning. Normal users should not supply debugging flags. Client-PC checks still cover antivirus/SmartScreen policy, standard-account behavior, spaces in paths and reopening after reboot.


## Persistent activity timeline

- Apply and restore a disposable preference, change a supported launcher or cursor, and perform a disposable cleanup. Check activity after each operation and after relaunch. Confirm partial/skipped results are distinct from completion and cleanup uses logical bytes, not a physical free-space claim.
- Check sign-in/tray/app-setting and local game/NVIDIA-reference operations are labelled as those operations, not automatic driver optimization. Read-only diagnostics do not add activity. Cancel a native file picker and verify Cancelled.
- Search/filter the timeline and load another page. Review clearing, cancel once, then confirm. Verify original-value backups and preference restoration history remain and rollback still works. A new operation after review must invalidate the old clear token.
- Export a managed report and inspect retained activity for absence of commands, paths, filenames, raw errors and internal event IDs. Check the retention count and last-cleared time. Only activity recorded by this version is included.
- On a disposable profile only, interrupt an operation after its pending record is saved. Relaunch: no recorded outcome means Not confirmed, never success. Inspect the actual setting before deciding what to do next.
- On a disposable profile only, make the activity file unreadable. Verify the log is unavailable, its file remains untouched, and supported rollback is still governed by its own original backups. Logging failures must not change the underlying operation result. Real power-loss/disk-failure behavior still requires client testing.
