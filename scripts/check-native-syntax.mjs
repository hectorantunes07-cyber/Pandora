// Parse bundled PowerShell and compile the cleaner's C# declarations without
// invoking any Windows API. This is a syntax check, not native runtime validation.
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const root = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'pandora-native-syntax-'));
try {
  const bundle = join(directory, 'scripts.cjs');
  await build({ stdin: { contents: "export {CLEANER_SCRIPT} from './electron/cleaner-native'; export {WINDOWS_QUERIES} from './electron/system';", resolveDir: root }, outfile: bundle, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const { CLEANER_SCRIPT, WINDOWS_QUERIES } = createRequire(import.meta.url)(bundle);
  const payload = join(directory, 'scripts.json');
  await writeFile(payload, JSON.stringify({ cleaner: CLEANER_SCRIPT, ...WINDOWS_QUERIES }));
  const checker = join(directory, 'check.ps1');
  await writeFile(checker, String.raw`param([string]$InputFile)
$ErrorActionPreference = 'Stop'
$scripts = Get-Content -Raw -LiteralPath $InputFile | ConvertFrom-Json
foreach ($property in $scripts.PSObject.Properties) {
  $tokens = $null; $errors = $null
  $null = [System.Management.Automation.Language.Parser]::ParseInput([string]$property.Value, [ref]$tokens, [ref]$errors)
  if ($errors.Count -gt 0) { throw ("PowerShell syntax error in " + $property.Name + ": " + ($errors.Message -join '; ')) }
  Write-Output ("Parsed PowerShell: " + $property.Name)
}
$source = [regex]::Match([string]$scripts.cleaner, '(?s)\$source = @''\r?\n(.*?)\r?\n''@')
if (-not $source.Success) { throw 'Cleaner C# source not found.' }
Add-Type -TypeDefinition $source.Groups[1].Value
$sizeMethod = [System.Runtime.InteropServices.Marshal].GetMethod('SizeOf', [type[]]@([type]))
foreach ($layout in @(@{Name='DISPOSITION';Size=1}, @{Name='INFO';Size=52}, @{Name='BININFO';Size=24})) {
  $structure = [PandoraCleaner].GetNestedType($layout.Name, [System.Reflection.BindingFlags]::NonPublic)
  $size = $sizeMethod.Invoke($null, [object[]]@($structure))
  if ($size -ne $layout.Size) { throw ('Incorrect Win32 structure layout: ' + $layout.Name) }
}
Write-Output 'Cleaner C# declarations and Win32 structure sizes verified. No Win32 API was invoked.'
`);
  const executable = process.env.PANDORA_PWSH || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
  const { stdout } = await promisify(execFile)(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', checker, '-InputFile', payload], { timeout: 60000, maxBuffer: 1024 * 1024 });
  process.stdout.write(stdout);
} finally { await rm(directory, { recursive: true, force: true }); }
