# Fortnite display preferences

PANDORA edits three existing scalar keys in the current user's
`%LOCALAPPDATA%/FortniteGame/Saved/Config/WindowsClient/GameUserSettings.ini`,
under `[/Script/FortniteGame.FortGameUserSettings]`:

| Key | Control | Tradeoff |
| --- | --- | --- |
| `FrameRateLimit` | Explicit cap or unlimited | A sustainable cap may reduce load/variance; a lower cap may increase latency. |
| `bUseVSync` | On/off | May reduce tearing and add latency; coordinate with VRR/driver settings. |
| `bUseDynamicResolution` | On/off | Supported rendering modes may vary internal resolution to meet a target, changing sharpness. |

These are saved configuration values, not live game measurements. This is an INI
editor, not an Epic-provided automation API. The current Fortnite release may
ignore or rewrite a value; available rendering modes, cloud synchronization and
game updates need actual-game validation. Performance Mode, Reflex, resolution,
graphics quality and all other settings remain manual. No performance benefit
has been established.

## Review and restoration

- No files are created when the expected configuration/keys are absent. Start the
  game and save video settings once, then close it. Unknown/ambiguous formats are
  refused. Manual executable selection never changes the configuration path.
- PANDORA checks Fortnite process names before review, confirmation and file
  replacement. A failed process query blocks changes. Keep the game, launchers
  that might start it, synchronization tools and configuration editors idle until
  the operation finishes. These checks cannot lock another application's launch
  or provide a transaction against an arbitrary concurrent writer.
- A review expires after five minutes and is single use. Any file/backup change
  between review and confirmation requires another review.
- A durable original and intended result are saved in the separate local
  `backups/fortnite-config-v1.json` journal before writing. This full-file backup
  can contain private configuration fields; it stays local and is never included
  in exported reports or the activity log.
- Edits preserve unrelated bytes, comments, line endings and UTF-8 (with/without
  BOM) or BOM UTF-16LE encoding. Duplicate sections/keys/operators, unsupported
  values, invalid encoding and files larger than 128 KiB are refused.
- Symlinks/junctions, hardlinks and read-only files are refused. Existing
  permissions are not relaxed; no read-only flag is set. A flushed sibling file
  replaces the original after a fresh comparison, followed by content read-back.
  Windows File.Replace preserves the destination access-control list and refuses
  metadata-merge errors; there is no fallback that discards custom permissions.
- Restoration changes only the values that PANDORA changed. It retains newer
  unrelated settings and formatting. A managed value must still match the applied
  or original value. A conflicting value, malformed file or failed provider
  blocks automatic restore; the original remains saved. There is no force-restore
  button. If the entire file still matches the applied version, the original
  bytes are restored exactly. Restore before making another PANDORA configuration.
- Failed/interrupted confirmation retains the pending original for fresh review.
  If file contents cannot be safely recognized, automatic recovery is blocked;
  restore manually from a known-good copy. No failure is presented as success.

## Required real-game checks

1. Save a separate copy of your configuration before testing this unsigned build.
2. Check detected values against the Fortnite video menu; close the game.
3. Cancel a review and verify nothing changed. Apply one preference, inspect its
   value, relaunch PANDORA and restore. Check original bytes and other settings.
4. Verify applying/restoring is blocked while Fortnite is running. Keep anti-cheat
   and Windows protections enabled; no executable or process is modified.
5. Apply a preference, launch Fortnite, check the video menu and rendering-mode
   behavior, then close it. Restore and verify unrelated game changes survive.
6. A conflicting managed frame cap must block restoration. A setting already back
   at its original is left alone. Test combined rollback and exported snapshots.
7. Test real cloud-sync/update behavior and repeatable performance measurements
   separately. Hosted Windows file/process tests do not establish those results.
