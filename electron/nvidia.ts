import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NVIDIA_SETTINGS, NVIDIA_PRESET_NAME } from '../shared/nvidia-library';
import { readSmallJson, writeDurableJson } from './durable-store';
import type { NvidiaPreset } from '../shared/types';

// Only an installed, signed NVIDIA executable or the exact Store package family
// can be launched. No executable, arguments or script text comes from the renderer.
export const NVIDIA_LAUNCH_SCRIPT = String.raw`
$ErrorActionPreference='Stop'
$package = Get-AppxPackage -Name 'NVIDIACorp.NVIDIAControlPanel' -ErrorAction SilentlyContinue | Where-Object { $_.PackageFamilyName -eq 'NVIDIACorp.NVIDIAControlPanel_56jybvy8sckqj' } | Select-Object -First 1
if ($package) {
 $manifest = Get-AppxPackageManifest -Package $package.PackageFullName
 $entry = @($manifest.Package.Applications.Application) | Where-Object { [string]$_.Executable -match '(?i)(^|[\\/])nvcplui\.exe$' } | Select-Object -First 1
 $id = [string]$entry.Id
 if ($id -notmatch '^[A-Za-z0-9._-]{1,128}$') { throw 'The installed NVIDIA package has no recognized Control Panel application.' }
 Start-Process -FilePath (Join-Path $env:SystemRoot 'explorer.exe') -ArgumentList ('shell:AppsFolder\NVIDIACorp.NVIDIAControlPanel_56jybvy8sckqj!' + $id)
} else {
 $candidate = Join-Path $env:ProgramFiles 'NVIDIA Corporation\Control Panel Client\nvcplui.exe'
 if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { throw 'NVIDIA Control Panel is not installed in a supported location. Install it through the official NVIDIA driver or Microsoft Store.' }
 $signature = Get-AuthenticodeSignature -LiteralPath $candidate
 if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(^|,\s*)O=NVIDIA Corporation(,|$)') { throw 'The NVIDIA Control Panel signature could not be verified. Repair the official driver installation.' }
 Start-Process -FilePath $candidate
}
`;
export async function openNvidiaControlPanel(): Promise<void> {
  if (process.platform !== 'win32') throw new Error('NVIDIA Control Panel requires Windows and an installed NVIDIA driver.');
  try {
    await promisify(execFile)(path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', NVIDIA_LAUNCH_SCRIPT], { windowsHide: true, timeout: 20_000, maxBuffer: 16_000 });
  } catch { throw new Error('NVIDIA Control Panel could not be opened. Check that the official NVIDIA driver and Control Panel are installed; you can also open it from the Windows Start menu.'); }
}
export function validateNvidiaPreset(raw: unknown): NvidiaPreset {
  const p = raw as NvidiaPreset;
  if (!p || p.version !== 1 || p.name !== NVIDIA_PRESET_NAME || typeof p.savedAt !== 'string' || !Number.isFinite(Date.parse(p.savedAt)) || typeof p.notes !== 'string' || p.notes.length > 2000 || !p.values || typeof p.values !== 'object' || Array.isArray(p.values) || Object.keys(p.values).length !== NVIDIA_SETTINGS.length || NVIDIA_SETTINGS.some(s => typeof p.values[s.id] !== 'string' || p.values[s.id].length > 160 || !p.values[s.id].trim())) throw new Error('The saved NVIDIA reference is invalid. It has been preserved.');
  return { version: 1, name: NVIDIA_PRESET_NAME, savedAt: p.savedAt, notes: p.notes, values: Object.fromEntries(NVIDIA_SETTINGS.map(s => [s.id, p.values[s.id]])) };
}
export function createNvidiaService(directory: string) {
  const file = path.join(directory, 'nvidia-reference-v1.json');
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async getPreset(): Promise<NvidiaPreset | null> { const raw = await readSmallJson(file); return raw === undefined ? null : validateNvidiaPreset(raw); },
    savePreset(input: unknown): Promise<NvidiaPreset> {
      const preset = validateNvidiaPreset(input);
      preset.savedAt = new Date().toISOString();
      const work = queue.catch(() => undefined).then(async () => { const existing = await readSmallJson(file); if (existing !== undefined) validateNvidiaPreset(existing); await writeDurableJson(file, preset); return preset; }); queue = work; return work;
    },
  };
}
