# Architecture decision: PANDORA 0.1.0

PANDORA — Created by Sonnier uses Electron + React + TypeScript + Vite. This
workspace supports JavaScript tooling and cross-platform testing, and Electron
provides a direct Windows installer pipeline. The tradeoff is a larger disk and
memory footprint than a native WinUI/Tauri shell. The initial release focuses on
testable local services and a small audited catalog rather than a broad set of
system-wide modifications.

```text
Sandboxed React renderer
   │ typed method calls / progress events
   ▼
Context-isolated preload (no generic IPC exposure)
   │ validated channel, caller and arguments
   ▼
Electron main process
   ├── system inventory and metric providers (read only)
   ├── fixed preference catalog → state journal → Windows registry adapter
   ├── scan manifest → selected categories → guarded cleanup provider
   ├── local atomic settings store
   └── native file-save dialog → privacy-filtered JSON export
```

`shared/types.ts` defines the IPC contract. Renderer state is a view of backend
results; clicking a control must not itself imply native success. The browser
fallback reports native features unavailable and performs no destructive work.
Non-Windows Electron can expose actual host diagnostics while explicitly
disabling Windows-specific operations.

## Transaction model

The preferences service serializes reads and writes through a queue. An apply
operation resolves an allowlisted ID, reads exact state, persists a pending
snapshot, rechecks, writes, verifies and commits the status. The persisted format
is versioned and validated before use. Rollback preserves original absence as
well as original DWORD values. Partial batch failures remain per-item results.
Interrupted pending records are reconciled using current state, and unknown or
externally modified values fail closed. Existing desired values are not claimed
as PANDORA-owned changes.

Persistence uses a temporary file, flushed journal contents, and atomic rename.
The application-data directory belongs to the current user. This initial format
has no automatic history pruning: deleting rollback records could lose the
ability to restore active changes. A bounded journal refuses further mutation
when full rather than discarding recoverability.

## Packaging and development boundary

Vite emits `dist/`; esbuild bundles Electron main and preload to
`dist-electron/*.cjs`. Native `.ps1`/`.cs` helpers are copied with their relative
paths preserved. The installer uses unpacked application resources so Windows
can open native helper files directly. ASAR is not relied on as a security
boundary. Only explicit build outputs, metadata, icon and notices are packaged.

The development launcher exposes Vite on loopback and supplies an exact allowed
URL. The packaged app ignores that development URL and loads bundled content.
Installer scope is per user, with `asInvoker` privilege and no fabricated code
signing. Uninstall does not reverse system settings or remove rollback data.

## Intentional initial limitations

The per-user tuning catalog needs no elevated UI. Windows restore-point creation
now uses a separate narrow UAC helper with fixed cmdlet input and new-point
verification; the GUI is not relaunched elevated. Broader machine-wide tuning, service disablement,
automatic driver updates, packet capture, automatic game benchmarking, and
secure auto-update are absent. Game guidance must remain visibly distinct from
automatic config modification. Native integration checks belong on disposable
Windows machines and are tracked independently from adapter tests.


## Game display configuration

The Fortnite service uses a fixed current-user configuration path and recognizes only three existing scalar fields. A bounded parser retains encoding and unrelated bytes. Expiring review tokens bind the complete observed file and backup state. Process checks, ancestor/link guards, a durable original, atomic replacement and read-back bound each write. Restoration changes only owned values, preserves newer unrelated configuration, and refuses conflicting managed values. No renderer path or command is accepted. See [the game configuration contract](FORTNITE-SETTINGS.md) for limitations; actual game compatibility is a separate validation gate.
