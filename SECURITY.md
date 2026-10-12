# Security and safety

PANDORA — Created by Sonnier is an initial local desktop release. Review the
limitations below before distributing or relying on its system operations.

## Privilege and trust boundaries

- The GUI runs as the current user. Implemented settings use a fixed HKCU
  registry catalog and require no elevation. There is no privileged service,
  driver, generic command executor, or machine-wide tweak pack.
- Electron uses a sandboxed renderer, context isolation, disabled Node
  integration, a restricted preload bridge, and sender/frame checks. Navigation,
  webviews and browser permissions are blocked. External documentation is
  allowlisted; no arbitrary remote page receives the native bridge.
- IPC inputs are bounded and validated. Registry targets originate in trusted
  source, not renderer-supplied paths. PowerShell uses fixed commands with no
  encoded-command or execution-policy bypass.
- Production resources are local. There is no automatic update service,
  telemetry, account, game injection, executable patching or credential handling.
  Opening an explicitly chosen documentation link uses the user's browser.

## Preference safety

Before writing, the engine reads the exact existing value or absence, durably
saves an atomic journal snapshot, rechecks the original state, writes the fixed
catalog value, and rereads it. The engine serializes operations and records
individual batch outcomes. Failure recovery preserves the backup; startup
reconciles interrupted operations with current state.

Rollback restores the original DWORD or original absence only when current
state matches the value PANDORA managed. A later external change produces a
conflict; it is not silently overwritten. Corrupt, ambiguous, oversized, or
unreadable journals fail closed. Files are written with restrictive permissions
where supported; Windows relies on the current user's app-data ACL inheritance.
Another program running as the same user can modify that data. This is not a
cryptographic or administrator-resistant boundary.

PANDORA does not disable Defender, Firewall, Windows Update, VBS, BitLocker,
Secure Boot, anti-cheat, driver signing or essential services. It does not alter
BCD/HPET timers, undocumented schedulers, CPU topology or overclocking. Verifying
a stored preference does not prove that every Windows build honors it or that
it improves a game. System Restore point creation is not implemented in this
release; per-preference snapshots serve a narrower purpose.

## Cleaner safety

The cleaner accepts category IDs from a previously created scan, not arbitrary
paths. It discovers a narrow set of known temporary/cache roots and rejects
unsafe paths, links, reparse points and files whose identity changed after the
scan. It does not recursively delete whole directories, remove applications,
delete Downloads/Documents/Desktop, clear passwords or cookies, or clean
Windows Prefetch. Browser caches and the Recycle Bin require separate selection
and confirmation. Locked or inaccessible files are reported rather than forced.

Routine cleanup is limited to `.tmp`/`.temp` files older than seven days in known
temporary folders. Browser cache candidates must be older than 24 hours and
come from exact Chrome/Edge cache-data or Firefox cache-entry directories. The
Recycle Bin uses Windows' own confirmation and empties **all current items on
all drives**, including items added since the scan; it is not a per-file manifest
operation. That scope is disclosed separately before calling the OS API.

Cleanup deletes data permanently and cannot be reversed by preference snapshots.
Candidate bytes are measured file sizes at scan time; concurrent activity,
filesystem allocation, compression, hard links and locks mean those bytes are
not a guaranteed increase in free disk space. The result reports confirmed
logical bytes removed. Actual physical disk space attributable to this operation
cannot be measured reliably by this implementation; `recoveredBytes` remains
null. Recycle Bin logical removal uses the observed decrease in its OS-reported
size, so unrelated concurrent changes can affect that measurement.

Native path/race protections require disposable Windows testing before a public
release. Unit tests are not proof against all Windows filesystem behavior. See
[the validation checklist](docs/windows-validation.md).

## Reports, packaging and disclosure

Exported system reports use a fixed privacy-filtered schema that excludes serial
numbers, usernames, IP addresses, hardware identifiers and local paths. Review
any file before sharing it; hardware models and history timestamps can still be
identifying. Local journals are necessary for rollback and should be retained
while changes remain applied.

Builds are unsigned until the owner configures a legitimate signing certificate.
The name Sonnier in file properties is descriptive metadata. Do not treat it as
a verified publisher. No claim of antivirus certification, anti-cheat approval
or universal driver compatibility is made.

No security-contact address has been configured. Until the owner supplies one,
report a reproducible issue privately to the repository owner through an agreed
channel. Do not include secrets or detailed personal paths in public reports.

Network diagnostics are explicitly user-initiated, fixed-destination ICMP tests
(eight requests, bounded timeout). No arbitrary destination or script is exposed
over IPC. Windows Settings shortcuts map four fixed IDs to approved ms-settings
URIs; arbitrary URLs, paths and commands are rejected. The installer owns an exact
build-generated file list, never recursively removes an installation folder, and
leaves the user's application data and rollback journal intact.
