# Fortnite display preferences

PANDORA edits existing scalar keys in the current user's
`%LOCALAPPDATA%/FortniteGame/Saved/Config/WindowsClient/GameUserSettings.ini`,
The three display keys are under `[/Script/FortniteGame.FortGameUserSettings]`:

| Key | Control | Tradeoff |
| --- | --- | --- |
| `FrameRateLimit` | Explicit cap or unlimited | A sustainable cap may reduce load/variance; a lower cap may increase latency. |
| `bUseVSync` | On/off | May reduce tearing and add latency; coordinate with VRR/driver settings. |
| `bUseDynamicResolution` | On/off | Supported rendering modes may vary internal resolution to meet a target, changing sharpness. |

Eight optional quality groups are detected separately in `[ScalabilityGroups]`:

| Key | Control |
| --- | --- |
| `sg.ViewDistanceQuality` | View distance |
| `sg.AntiAliasingQuality` | Anti-aliasing quality |
| `sg.ShadowQuality` | Shadow quality |
| `sg.PostProcessQuality` | Post-processing quality |
| `sg.TextureQuality` | Texture quality |
| `sg.EffectsQuality` | Effects quality |
| `sg.FoliageQuality` | Foliage quality |
| `sg.ShadingQuality` | Shading quality |

New selections are Low (0), Medium (1), High (2) or Epic (3). An existing cinematic
value (4) can be retained and restored, but is not offered as a new selection.
These are Unreal Engine scalability-group preferences, not guaranteed mappings to
every current Fortnite video-menu feature. See Epic's [scalability reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/scalability-reference-for-unreal-engine).
Fortnite's rendering mode, upscaler, map or game version may ignore or override a
group. Anti-aliasing quality does not select a specific upscaler; shading/shadow
quality does not enable or disable Nanite or Lumen. PANDORA makes no FPS claim.

Missing, duplicate, operator-based, malformed or unsupported quality keys remain
unavailable. Duplicate quality sections disable all quality-group editing. The
three existing display controls remain usable when optional groups are absent or
ambiguous. No groups or keys are created. Review lists only values that change.

These are saved configuration values, not live game measurements. This is an INI
editor, not an Epic-provided automation API. The current Fortnite release may
ignore or rewrite a value; available rendering modes, cloud synchronization and
game updates need actual-game validation. Performance Mode, Reflex, resolution,
resolution scale, Nanite/Lumen and other settings outside the listed keys remain manual. No performance benefit
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
  BOM) or BOM UTF-16LE encoding. Ambiguous required display sections/keys, unsupported required
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
3. Expand Graphics quality and compare supported groups with your saved file. Missing or ambiguous groups must stay unavailable. Do not assume every group affects your current rendering mode.
4. Cancel a review and verify nothing changed. Apply one preference, inspect its
   value, relaunch PANDORA and restore. Check original bytes and other settings.
5. Verify applying/restoring is blocked while Fortnite is running. Keep anti-cheat
   and Windows protections enabled; no executable or process is modified.
6. Apply a preference, launch Fortnite, check the video menu and rendering-mode
   behavior, then close it. Restore and verify unrelated game changes survive.
7. A conflicting managed frame cap must block restoration. A setting already back
   at its original is left alone. Test combined rollback and exported snapshots.
8. Test real cloud-sync/update behavior and repeatable performance measurements
   separately. Hosted Windows file/process tests do not establish those results.

Existing version-1 backups remain usable. The loader derives ownership from the
actual original/applied file differences; it never takes ownership of unchanged
quality groups in an older three-display-key backup. Restoring preserves newer
unowned groups, including groups first added after the backup. A missing or
ambiguous *managed* quality value blocks restoration and retains the original.
Older PANDORA builds may refuse a backup containing new quality changes; use this
or a newer build to restore those originals.
