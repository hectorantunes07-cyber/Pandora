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
