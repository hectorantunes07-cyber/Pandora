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
  await build({ stdin: { contents: "export {NVIDIA_LAUNCH_SCRIPT} from './electron/nvidia'; export {CURSOR_NATIVE_SOURCE} from './electron/cursor-native'; export {CLEANER_SCRIPT} from './electron/cleaner-native'; export {WINDOWS_QUERIES} from './electron/system'; export {NETWORK_SCRIPT} from './electron/network'; export {ADAPTER_INSPECTION_SCRIPT, DNS_INSPECTION_SCRIPT} from './electron/network-inspection'; export {POINTER_NATIVE_SOURCE} from './electron/pointer'; export {VISUAL_EFFECTS_NATIVE_SOURCE} from './electron/visual-effects';", resolveDir: root }, outfile: bundle, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const { NVIDIA_LAUNCH_SCRIPT, CURSOR_NATIVE_SOURCE, CLEANER_SCRIPT, WINDOWS_QUERIES, NETWORK_SCRIPT, ADAPTER_INSPECTION_SCRIPT, DNS_INSPECTION_SCRIPT, POINTER_NATIVE_SOURCE, VISUAL_EFFECTS_NATIVE_SOURCE } = createRequire(import.meta.url)(bundle);
  const payload = join(directory, 'scripts.json');
  await writeFile(payload, JSON.stringify({ nvidiaLauncher: NVIDIA_LAUNCH_SCRIPT, cleaner: CLEANER_SCRIPT, network: NETWORK_SCRIPT, adapterInspection: ADAPTER_INSPECTION_SCRIPT, dnsInspection: DNS_INSPECTION_SCRIPT, ...WINDOWS_QUERIES }));
  await writeFile(join(directory, 'cursor.cs'), CURSOR_NATIVE_SOURCE);
  await writeFile(join(directory, 'pointer.cs'), POINTER_NATIVE_SOURCE);
  await writeFile(join(directory, 'visual-effects.cs'), VISUAL_EFFECTS_NATIVE_SOURCE);
  const checker = join(directory, 'check.ps1');
  await writeFile(checker, String.raw`param([string]$InputFile)
$ErrorActionPreference = 'Stop'
$scripts = Get-Content -Raw -LiteralPath $InputFile | ConvertFrom-Json
Add-Type -TypeDefinition (Get-Content -Raw -LiteralPath (Join-Path (Split-Path $InputFile) 'cursor.cs'))
Write-Output 'Cursor API and registry declarations compiled; no native cursor API was invoked.'
Add-Type -TypeDefinition (Get-Content -Raw -LiteralPath (Join-Path (Split-Path $InputFile) 'pointer.cs'))
Write-Output 'Pointer API declarations compiled; no native pointer API was invoked.'
Add-Type -TypeDefinition (Get-Content -Raw -LiteralPath (Join-Path (Split-Path $InputFile) 'visual-effects.cs'))
Write-Output 'Visual effects API declarations compiled; no native visual API was invoked.'
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

# Run the real inventory script against isolated cmdlet fixtures. These functions
# shadow OS providers only in this temporary checker process; no WMI is queried.
function Get-CimInstance {
 param([string]$Namespace, [string]$ClassName, [string]$ErrorAction)
 switch ($ClassName) {
  'Win32_Processor' { [pscustomobject]@{ Name='Fixture CPU'; NumberOfCores=4; CurrentClockSpeed=4200 } }
  'Win32_VideoController' { [pscustomobject]@{ Name='Fixture GPU'; DriverVersion='1'; CurrentHorizontalResolution=1920; CurrentVerticalResolution=1080; CurrentRefreshRate=144 } }
  'Win32_PhysicalMemory' { [pscustomobject]@{ Capacity=17179869184; ConfiguredClockSpeed=3200 } }
  'Win32_BaseBoard' { [pscustomobject]@{ Manufacturer='Fixture'; Product='Board' } }
  'Win32_OperatingSystem' { [pscustomobject]@{ OSArchitecture='64-bit'; Caption='Windows fixture'; BuildNumber='26100'; LastBootUpTime=[DateTime]::UtcNow.AddDays(-1) } }
  'Win32_LogicalDisk' { [pscustomobject]@{ DriveType=3; DeviceID='C:'; Size=1000000000000; FreeSpace=200000000000 } }
  'Win32_PowerPlan' { [pscustomobject]@{ IsActive=$true; ElementName='Balanced' } }
  'Win32_ComputerSystem' { [pscustomobject]@{ PCSystemType=2 } }
  default { throw ('Unexpected provider in fixture: ' + $ClassName) }
 }
}
function Get-PhysicalDisk {
 param([string]$ErrorAction)
 [pscustomobject]@{ FriendlyName='Fixture disk'; Size=1000000000000; MediaType='SSD'; BusType='NVMe'; HealthStatus='Healthy' }
}
function Get-NetAdapter {
 param([switch]$Physical, [string]$ErrorAction)
 if (-not $Physical) { throw 'Fixture expects physical adapter inventory.' }
 [pscustomobject]@{ InterfaceDescription='Fixture adapter'; Status='Up'; LinkSpeed='1 Gbps'; TransmitLinkSpeed=1000000000 }
}
$inventory = (& ([scriptblock]::Create([string]$scripts.system))) | ConvertFrom-Json
if ($inventory.cpu -ne 'Fixture CPU' -or $inventory.physicalCores -ne 4) { throw 'Inventory aggregation failed.' }
if ($inventory.networkAdapters.Count -ne 1 -or $inventory.networkAdapters[0].linkSpeedBits -ne 1000000000) { throw 'Inventory must use numeric CIM rates, not the formatted LinkSpeed property.' }
if ($inventory.physicalDisks[0].bus -ne 'NVMe' -or $inventory.installedRamBytes -ne 17179869184 -or $inventory.deviceType -ne 'Portable') { throw 'Extended inventory aggregation failed.' }
if ($inventory.cpuReportedMHz -ne 4200 -or $inventory.architecture -ne '64-bit') { throw 'CPU clock and architecture aggregation failed.' }
if ($inventory.notes.Count -ne 0) { throw 'Unexpected provider failure in inventory fixture.' }
Write-Output 'Inventory PowerShell runtime fixture passed, including formatted versus numeric link speed. No native provider was invoked.'

function Get-NetAdapter {
 param([switch]$IncludeHidden, [string]$ErrorAction)
 if(-not $IncludeHidden){throw 'Expected hidden interfaces too.'}
 [pscustomobject]@{Name='Physical fixture';ifIndex=7;InterfaceDescription='Fixture Ethernet';Status='Up';HardwareInterface=$true;TransmitLinkSpeed=5000000000}
 [pscustomobject]@{Name='Virtual fixture';ifIndex=8;InterfaceDescription='Fixture VPN';Status='Up';HardwareInterface=$false;TransmitLinkSpeed=1000000000}
}
function Get-NetAdapterAdvancedProperty {
 param([string]$Name,[switch]$AllProperties,[switch]$IncludeHidden,[string]$ErrorAction)
 [pscustomobject]@{Name='Physical fixture';RegistryKeyword='*EEE';DisplayName='Energy Efficient Ethernet';DisplayValue='Enabled';RegistryValue=@('1');ValidDisplayValues=@('Disabled','Enabled')}
}
function Get-NetAdapterPowerManagement {
 param([string]$Name,[switch]$IncludeHidden,[string]$ErrorAction)
 [pscustomobject]@{Name='Physical fixture';SelectiveSuspend='Disabled'}
}
function Get-NetRoute {
 param([string]$ErrorAction)
 [pscustomobject]@{InterfaceIndex=7;DestinationPrefix='0.0.0.0/0'}
}
$network = (& ([scriptblock]::Create([string]$scripts.adapterInspection))) | ConvertFrom-Json
if($network.adapters.Count -ne 2 -or -not $network.adapters[0].physical -or $network.adapters[1].physical -or $network.adapters[1].defaultRoute){throw 'Physical/virtual/default-route classification failed.'}
if($network.adapters[0].advanced[0].keyword -ne '*EEE' -or $network.adapters[0].power[0].value -ne 'Disabled'){throw 'Driver capability extraction failed.'}
function Resolve-DnsName {
 param([string]$Name,[string]$Type,[switch]$DnsOnly,[switch]$NoHostsFile,[switch]$QuickTimeout,[string]$ErrorAction)
 if($Name -ne 'www.microsoft.com' -or $Type -ne 'A' -or -not $DnsOnly -or -not $NoHostsFile){throw 'Unexpected DNS request.'}
 [pscustomobject]@{Type='A';IPAddress='192.0.2.1'}
}
$dns = (& ([scriptblock]::Create([string]$scripts.dnsInspection))) | ConvertFrom-Json
if(-not $dns.resolved -or $dns.answerCount -ne 1 -or $dns.elapsedMs -lt 0){throw 'DNS resolution fixture failed.'}
Write-Output 'Adapter capabilities and DNS scripts passed isolated runtime fixtures; no network request or setting change was made.'


`);
  const executable = process.env.PANDORA_PWSH || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
  const { stdout } = await promisify(execFile)(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', checker, '-InputFile', payload], { timeout: 60000, maxBuffer: 1024 * 1024 });
  process.stdout.write(stdout);
} finally { await rm(directory, { recursive: true, force: true }); }
