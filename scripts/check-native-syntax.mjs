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
  await build({ stdin: { contents: "export {buildProcessDetailsQuery} from './electron/process-details'; export {OPTIONAL_APPS_QUERY} from './electron/optional-apps'; export {FORTNITE_PROCESS_QUERY, buildFortniteReplaceScript} from './electron/fortnite-file'; export {buildLoginScript} from './electron/app-login'; export {STORAGE_RELIABILITY_QUERY} from './electron/storage-reliability'; export {SYSTEM_RESTORE_QUERY, buildRestorePointScript, buildRestoreElevationScript} from './electron/system-restore-native'; export {POWER_TUNING_NATIVE_SOURCE} from './electron/power-tuning-native'; export {NVIDIA_LAUNCH_SCRIPT} from './electron/nvidia'; export {CURSOR_NATIVE_SOURCE} from './electron/cursor-native'; export {CLEANER_SCRIPT} from './electron/cleaner-native'; export {WINDOWS_QUERIES} from './electron/system'; export {NETWORK_SCRIPT} from './electron/network'; export {ADAPTER_INSPECTION_SCRIPT, DNS_INSPECTION_SCRIPT} from './electron/network-inspection'; export {POINTER_NATIVE_SOURCE} from './electron/pointer'; export {VISUAL_EFFECTS_NATIVE_SOURCE} from './electron/visual-effects';", resolveDir: root }, outfile: bundle, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const { buildProcessDetailsQuery, OPTIONAL_APPS_QUERY, FORTNITE_PROCESS_QUERY, buildFortniteReplaceScript, buildLoginScript, STORAGE_RELIABILITY_QUERY, SYSTEM_RESTORE_QUERY, buildRestorePointScript, buildRestoreElevationScript, POWER_TUNING_NATIVE_SOURCE, NVIDIA_LAUNCH_SCRIPT, CURSOR_NATIVE_SOURCE, CLEANER_SCRIPT, WINDOWS_QUERIES, NETWORK_SCRIPT, ADAPTER_INSPECTION_SCRIPT, DNS_INSPECTION_SCRIPT, POINTER_NATIVE_SOURCE, VISUAL_EFFECTS_NATIVE_SOURCE } = createRequire(import.meta.url)(bundle);
  const payload = join(directory, 'scripts.json');
  await writeFile(payload, JSON.stringify({ processDetails: buildProcessDetailsQuery(123), optionalApps: OPTIONAL_APPS_QUERY, fortniteProcess: FORTNITE_PROCESS_QUERY, fortniteReplace: buildFortniteReplaceScript('C:\\Fixture\\.pandora-11111111-1111-1111-1111-111111111111.tmp', 'C:\\Fixture\\GameUserSettings.ini', 'a'.repeat(64), 'b'.repeat(64)), appLoginRead: buildLoginScript('C:\\Users\\Fixture\\PANDORA\\PANDORA.exe'), appLoginEnable: buildLoginScript('C:\\Users\\Fixture\\PANDORA\\PANDORA.exe', { expected: 'absent', enable: true }), appLoginDisable: buildLoginScript('C:\\Users\\Fixture\\PANDORA\\PANDORA.exe', { expected: 'owned', enable: false }), storageReliability: STORAGE_RELIABILITY_QUERY, systemRestoreQuery: SYSTEM_RESTORE_QUERY, systemRestoreCreate: buildRestorePointScript('8c867f33-14c2-4d27-9557-20fd0173f972'), systemRestoreElevate: buildRestoreElevationScript('8c867f33-14c2-4d27-9557-20fd0173f972'), nvidiaLauncher: NVIDIA_LAUNCH_SCRIPT, cleaner: CLEANER_SCRIPT, network: NETWORK_SCRIPT, adapterInspection: ADAPTER_INSPECTION_SCRIPT, dnsInspection: DNS_INSPECTION_SCRIPT, ...WINDOWS_QUERIES }));
  await writeFile(join(directory, 'power-tuning.cs'), POWER_TUNING_NATIVE_SOURCE);
  await writeFile(join(directory, 'cursor.cs'), CURSOR_NATIVE_SOURCE);
  await writeFile(join(directory, 'pointer.cs'), POINTER_NATIVE_SOURCE);
  await writeFile(join(directory, 'visual-effects.cs'), VISUAL_EFFECTS_NATIVE_SOURCE);
  const checker = join(directory, 'check.ps1');
  await writeFile(checker, String.raw`param([string]$InputFile)
$ErrorActionPreference = 'Stop'
$scripts = Get-Content -Raw -LiteralPath $InputFile | ConvertFrom-Json
Add-Type -TypeDefinition (Get-Content -Raw -LiteralPath (Join-Path (Split-Path $InputFile) 'power-tuning.cs'))
$powerStatusType = [PandoraPowerTuning].GetNestedType('SystemPowerStatus', [System.Reflection.BindingFlags]::NonPublic)
$powerSizeMethod = [System.Runtime.InteropServices.Marshal].GetMethod('SizeOf', [type[]]@([type]))
if ($powerSizeMethod.Invoke($null, [object[]]@($powerStatusType)) -ne 12) { throw 'Incorrect SYSTEM_POWER_STATUS layout.' }
Write-Output 'AC/DC power APIs and battery status layout compiled; no power setting was changed.'
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

# Execute the actual replacement helper against disposable files. In PowerShell,
# $null binds as an empty String; NullString.Value is needed for File.Replace.
$fortniteDirectory = Join-Path (Split-Path $InputFile) 'fortnite-config'
$null = New-Item -ItemType Directory -Path $fortniteDirectory
$fortniteTarget = Join-Path $fortniteDirectory 'GameUserSettings.ini'
$fortniteTemporary = Join-Path $fortniteDirectory '.pandora-11111111-1111-1111-1111-111111111111.tmp'
$beforeBytes = [Text.Encoding]::UTF8.GetBytes('before')
$afterBytes = [Text.Encoding]::UTF8.GetBytes('after')
[IO.File]::WriteAllBytes($fortniteTarget, $beforeBytes)
[IO.File]::WriteAllBytes($fortniteTemporary, $afterBytes)
$sha = [Security.Cryptography.SHA256]::Create()
try { $beforeHash = ([BitConverter]::ToString($sha.ComputeHash($beforeBytes))).Replace('-','').ToLowerInvariant(); $afterHash = ([BitConverter]::ToString($sha.ComputeHash($afterBytes))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
$replacementScript = ([string]$scripts.fortniteReplace).Replace('C:\Fixture\GameUserSettings.ini', $fortniteTarget).Replace('C:\Fixture\.pandora-11111111-1111-1111-1111-111111111111.tmp', $fortniteTemporary).Replace(('a' * 64), $beforeHash).Replace(('b' * 64), $afterHash)
function Get-Process { param([string]$ErrorAction) @() }
try {
  & ([scriptblock]::Create($replacementScript))
  if([IO.File]::ReadAllText($fortniteTarget) -ne 'after' -or [IO.File]::Exists($fortniteTemporary)) { throw 'Configuration replacement was not verified.' }
  [IO.File]::WriteAllBytes($fortniteTemporary, $afterBytes)
  $rejected = $false
  try { & ([scriptblock]::Create($replacementScript)) } catch { $rejected = $true }
  if(-not $rejected -or [IO.File]::ReadAllText($fortniteTarget) -ne 'after') { throw 'Changed configuration hash was not protected.' }
} finally { Remove-Item Function:Get-Process }
Write-Output 'Actual configuration replacement and stale-content refusal passed isolated runtime fixtures. Windows ACL preservation is tested separately on Windows.'

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

function Get-AppxPackage {
 param([string]$Name,[string]$PackageTypeFilter,[string]$ErrorAction)
 if($PackageTypeFilter -ne 'Main'){throw 'Main registrations only.'}
 if($Name -eq 'Microsoft.BingNews'){throw 'Fixture provider failure.'}
 if($Name -eq 'Clipchamp.Clipchamp') {
  [pscustomobject]@{Name=$Name;PackageFamilyName='Clipchamp.Clipchamp_yxz26nhyzhsrt';Version='1.2.3.4';Architecture='X64';IsFramework=$false;IsResourcePackage=$false;NonRemovable=$false;SignatureKind='Store';Status='Ok';InstallLocation='PRIVATE_SENTINEL'}
 }
}
$optional = (& ([scriptblock]::Create([string]$scripts.optionalApps))) | ConvertFrom-Json
if($optional.entries.Count -ne 8 -or $optional.entries[0].packages.Count -ne 1 -or -not $optional.entries[0].readable){throw 'Optional app installed registration failed.'}
if($optional.entries[1].packages.Count -ne 0 -or -not $optional.entries[1].readable){throw 'Absent registration must remain distinct.'}
if($optional.entries[2].readable -or $optional.entries[2].packages.Count -ne 0){throw 'Failed registration query must remain unavailable.'}
if(($optional | ConvertTo-Json -Depth 8) -match 'PRIVATE_SENTINEL'){throw 'Optional app query leaked a private path.'}
Remove-Item Function:Get-AppxPackage
Write-Output 'Optional-app query passed isolated installed/absent/failed-provider and privacy fixtures. No Windows package was modified.'
function Get-Process {
 param([int]$Id,[string]$ErrorAction)
 if($Id -ne 123){throw 'Unexpected process fixture ID.'}
 $fixture=[pscustomobject]@{Id=123;ProcessName='Fixture';StartTime=[DateTime]::UtcNow;MainModule=[pscustomobject]@{FileName=$null};HasExited=$false}
 $fixture | Add-Member -MemberType ScriptMethod -Name Refresh -Value {}
 $fixture | Add-Member -MemberType ScriptMethod -Name Dispose -Value {}
 $fixture
}
$detail=(& ([scriptblock]::Create([string]$scripts.processDetails))) | ConvertFrom-Json
if($detail.pid -ne 123 -or $detail.name -ne 'Fixture' -or -not $detail.startedAt -or $null -ne $detail.executable){throw 'Process details must preserve unavailable image metadata.'}
Remove-Item Function:Get-Process
Write-Output 'Process identity script passed an isolated protected-image fixture. No process was changed.'



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

# Run the actual restore helper against shadowed provider/cmdlet functions only.
# This does not create a point, elevate, change policy or start another process.
$script:restorePoints=@(); $script:restoreAction='create'; $script:restoreCalls=0
function Get-CimInstance {
 param([string]$Namespace,[string]$ClassName,[string]$ErrorAction)
 if($ClassName -eq 'Win32_OperatingSystem') { return [pscustomobject]@{ProductType=1} }
 if($ClassName -eq 'SystemRestore') { return $script:restorePoints }
 throw 'Unexpected restore provider request.'
}
function Checkpoint-Computer {
 param([string]$Description,[string]$RestorePointType,[string]$ErrorAction,[string]$WarningAction)
 $script:restoreCalls++
 if($RestorePointType -ne 'MODIFY_SETTINGS') { throw 'Unexpected point type.' }
 if($script:restoreAction -eq 'create') { $script:restorePoints=@([pscustomobject]@{SequenceNumber=7;Description=$Description;CreationTime=[DateTime]::UtcNow}) }
}
$helper=([string]$scripts.systemRestoreCreate).Replace('exit (New-PandoraRestorePoint)','New-PandoraRestorePoint')
$code=& ([scriptblock]::Create($helper))
if($code -ne 0 -or $script:restoreCalls -ne 1) { throw 'Restore helper must verify a newly created point.' }
$code=& ([scriptblock]::Create($helper))
if($code -ne 21) { throw 'An existing matching point is not a newly created backup.' }
$script:restorePoints=@();$script:restoreAction='skip'
$code=& ([scriptblock]::Create($helper))
if($code -ne 21) { throw 'A successful no-op must not be called a created restore point.' }
$inventory=& ([scriptblock]::Create([string]$scripts.systemRestoreQuery)) | ConvertFrom-Json
if(-not $inventory.supported -or -not $inventory.readable -or $inventory.points.Count -ne 0) { throw 'Empty restore inventory schema failed.' }
function Start-Process {
 param([string]$FilePath,[string[]]$ArgumentList,[string]$Verb,[string]$WindowStyle,[switch]$Wait,[switch]$PassThru,[string]$ErrorAction)
 if($Verb -ne 'RunAs' -or $WindowStyle -ne 'Hidden' -or -not $Wait -or -not $PassThru -or $ArgumentList[3] -ne '-EncodedCommand') { throw 'Unexpected elevation boundary.' }
 $decoded=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($ArgumentList[4]))
 if($decoded -ne [string]$scripts.systemRestoreCreate) { throw 'Elevated script did not match the fixed verified helper.' }
 [pscustomobject]@{ExitCode=0}
}
$elevation=& ([scriptblock]::Create([string]$scripts.systemRestoreElevate)) | ConvertFrom-Json
if($elevation.exitCode -ne 0 -or $elevation.cancelled) { throw 'Elevation result parsing failed.' }

function Start-Process { [pscustomobject]@{ExitCode=$null} }
$missingExit=& ([scriptblock]::Create([string]$scripts.systemRestoreElevate)) | ConvertFrom-Json
if($missingExit.exitCode -ne 21) { throw 'A missing native process exit code must never be coerced into successful verification.' }
function Start-Process { throw [System.ComponentModel.Win32Exception]::new(1223) }
$cancelled=& ([scriptblock]::Create([string]$scripts.systemRestoreElevate)) | ConvertFrom-Json
if(-not $cancelled.cancelled) { throw 'Windows UAC cancellation must be distinguished from successful creation.' }
function Get-CimInstance {
 param([string]$Namespace,[string]$ClassName,[string]$ErrorAction)
 if($ClassName -eq 'Win32_OperatingSystem') { return [pscustomobject]@{ProductType=1} }
 throw 'Fixture access denied.'
}
$unreadable=& ([scriptblock]::Create([string]$scripts.systemRestoreQuery)) | ConvertFrom-Json
if(-not $unreadable.supported -or $unreadable.readable) { throw 'An unreadable list must still permit reviewed administrator creation on a client OS.' }
function Get-CimInstance { [pscustomobject]@{ProductType=3} }
$unsupported=& ([scriptblock]::Create([string]$scripts.systemRestoreQuery)) | ConvertFrom-Json
if($unsupported.supported) { throw 'Windows Server must be unavailable.' }
if((& ([scriptblock]::Create($helper))) -ne 22) { throw 'Elevated helper must recheck client edition.' }
Write-Output 'System Restore query, verified-create and elevation wrapper fixtures passed. No native restore point or administrator prompt was invoked.'

# Storage fixtures run the production read-only query with local functions only.
$script:storageMode='normal'
function Get-PhysicalDisk {
 param([string]$ErrorAction)
 if($script:storageMode -eq 'denied') { throw 'Fixture inventory denied' }
 if($script:storageMode -eq 'empty') { return }
 $count=if($script:storageMode -eq 'many') {33} else {2}
 for($i=0;$i -lt $count;$i++) { [pscustomobject]@{DeviceId=[string]$i;Model='Fixture SSD';FriendlyName='private friendly label';SerialNumber='private serial';MediaType='SSD';BusType='NVMe';Size=1000000000000;HealthStatus=0} }
}
function Get-StorageReliabilityCounter {
 param($PhysicalDisk,[string]$ErrorAction)
 if($PhysicalDisk.DeviceId -eq '1') { throw 'Fixture driver denied' }
 $id=$PhysicalDisk.DeviceId
 if($script:storageMode -eq 'mismatch') { $id='unexpected-device' }
 $row=[pscustomobject]@{DeviceId=$id;Temperature=0;Wear=110;PowerOnHours=1200;ReadErrorsTotal=[UInt64]::MaxValue;ReadErrorsCorrected=$null;ReadErrorsUncorrected=[UInt64]0;WriteErrorsTotal=$null;WriteErrorsCorrected=$null;WriteErrorsUncorrected=$null}
 if($script:storageMode -eq 'ambiguous') { $row;$row;return }
 if($script:storageMode -eq 'missing') { return }
 if($script:storageMode -eq 'invalid') { $row.Temperature=-1; $row.Wear=256; $row.PowerOnHours='bad';$row.ReadErrorsTotal='18446744073709551616';$row.ReadErrorsUncorrected=$null }
 $row
}
$storage=& ([scriptblock]::Create([string]$scripts.storageReliability)) | ConvertFrom-Json
if($storage.devices.Count -ne 2 -or $storage.devices[0].readErrorsTotal -cne '18446744073709551615' -or $storage.devices[0].readErrorsTotal -isnot [string]) { throw 'Exact UInt64 storage counters were lost.' }
if($storage.devices[0].temperatureC -ne 0 -or $storage.devices[0].wearPercent -ne 110 -or $null -ne $storage.devices[0].writeErrorsTotal) { throw 'Storage zero, wear over 100 and missing readings must remain distinct.' }
if($storage.devices[0].health -ne 'Healthy' -or $storage.devices[0].countersStatus -ne 'reported' -or $storage.devices[1].countersStatus -ne 'unavailable' -or $storage.devices[1].reason -ne 'provider-unavailable') { throw 'Partial storage provider failure or health mapping failed.' }
if(($storage | ConvertTo-Json -Depth 6) -match 'private') { throw 'Private storage identity fields must be omitted.' }
foreach($mode in @('mismatch','ambiguous','missing','invalid')) {
 $script:storageMode=$mode
 $result=& ([scriptblock]::Create([string]$scripts.storageReliability)) | ConvertFrom-Json
 if($result.devices[0].countersStatus -ne 'unavailable' -or $null -ne $result.devices[0].temperatureC -or $null -ne $result.devices[0].readErrorsTotal) { throw ('Invalid storage counters accepted: '+$mode) }
}
$script:storageMode='empty'
$empty=& ([scriptblock]::Create([string]$scripts.storageReliability)) | ConvertFrom-Json
if($empty.devices.Count -ne 0 -or $empty.truncated) { throw 'Empty inventory must stay empty.' }
$script:storageMode='many'
$many=& ([scriptblock]::Create([string]$scripts.storageReliability)) | ConvertFrom-Json
if($many.devices.Count -ne 32 -or -not $many.truncated -or $many.devices[31].index -ne 31) { throw 'Storage inventory bound failed.' }
$script:storageMode='denied';$denied=$false
try { & ([scriptblock]::Create([string]$scripts.storageReliability)) | Out-Null } catch { $denied=$true }
if(-not $denied) { throw 'Denied inventory must not become a clean health result.' }
Write-Output 'Storage query passed isolated identity, UInt64, null, partial-failure and bounded-inventory fixtures. No physical storage was queried or changed.'




`);
  const executable = process.env.PANDORA_PWSH || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
  const { stdout } = await promisify(execFile)(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', checker, '-InputFile', payload], { timeout: 60000, maxBuffer: 1024 * 1024 });
  process.stdout.write(stdout);
} finally { await rm(directory, { recursive: true, force: true }); }
