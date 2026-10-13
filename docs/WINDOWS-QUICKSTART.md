# PANDORA — first Windows test

This is an unsigned 0.1.0 development build. Use Windows 11 x64, initially on a test PC or VM with a backup. You do not need Node.js for the portable executable or installer.

## Get and verify the build

1. Download the Setup installer or portable `.exe` and its matching `.sha256` together, or download `PANDORA-Windows-x64-unsigned` from a successful repository **Actions → Windows build and checks** run. Extract an Actions artifact ZIP first.
2. In PowerShell, run `Get-FileHash .\PANDORA-Portable-0.1.0-x64.exe -Algorithm SHA256` (replace `Portable` with `Setup` for the installer) and compare the entire hash with the sidecar; letter case does not matter. An updated build has a different hash; always use its matching sidecar. The hash establishes file identity, not publisher trust.
3. Launch as a normal user. Windows may report an unknown publisher because this build is unsigned. Do not turn off Windows security protections. If your PC or organization blocks it, record the message and test through an approved environment.
4. The portable extracts its runtime temporarily but saves settings and history under `%APPDATA%\PANDORA`. It is not a leave-no-trace application. Preserve that folder if you want to retain rollback history. The installer uses the same history. Install it with the Setup executable; it does not need administrator privileges.

## Test in this order

- **Interface:** open each page, resize the window, use keyboard navigation and try reduced motion in Settings. Confirm “Created by Sonnier” branding.
- **System Monitor:** compare CPU, usable RAM, GPU/driver and drives with Windows tools. Select Refresh after disk activity. Review the timestamp and provider notes. Missing temperatures and unsupported counters must stay unavailable. Export a report if useful.
- **Network Diagnostics:** choose a public destination and Start test. Review individual replies, loss and jitter. Missing replies can mean blocked ICMP; this does not automatically indicate a broken connection.
- **PC Cleaner, scan only:** use the dashboard’s Clean Junk Files shortcut, select Scan & Clean, and review the measured candidate bytes. Cancel the confirmation once and confirm no cleanup occurred. No deletion happens during scanning.
- **Controlled cleanup:** use disposable old `.tmp` files in your user temporary directory. Files must be at least seven days old. Select only that category, confirm, and check the results. Recent files, documents and Downloads are excluded. Locked files should be reported. Logical file bytes removed do not guarantee the same physical disk space increase.
- **Preferences and rollback:** first try one quality-of-life preference such as showing file extensions. Review the target and tradeoff, apply it, inspect Restore & History, then restore it. Verify the original Windows behavior after reopening Explorer or signing out if instructed. Test Restore all managed only after individual restoration works.
- **Persistence:** close and reopen. Confirm settings and history remain. A second instance should focus the existing window.
- **Optional cleanup:** browser caches and Recycle Bin need separate review. Close the browser first. Recycle Bin emptying permanently removes all current contents across drives and asks for Windows confirmation. Test this only with disposable data; cleanup has no rollback.
- **Installer:** use the completed Setup artifact and its matching checksum. Check installation folder, shortcuts, launch, uninstall and reinstall. Restore unwanted preferences before uninstalling. Uninstalling retains the journal and does not undo settings automatically.

## Report a problem

Record the source commit from `verification.json`, artifact SHA256, Windows version/build, page, steps, exact error and whether Windows still reflects the original preference. Do not share private file paths or your full backup journal publicly. A failed operation should retain a clear result; never repeatedly force it or manually delete the journal to get past an error.

Cloud-verified checks cover build, backend safety logic, interface workflows and both installer and portable archive integrity. Native hardware accuracy, actual Windows cleanup, registry shell effects and installation still require this Windows testing. See [windows-validation.md](windows-validation.md) for the complete release checklist.
