# Runs only on a disposable GitHub-hosted Windows runner. Never a user's PC.
$ErrorActionPreference = 'Stop'
if ($env:CI -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') { throw 'Installer integration requires a disposable GitHub-hosted runner.' }
$install = Join-Path $env:LOCALAPPDATA 'Programs\PANDORA'
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\io.sonnier.pandora'
if ((Test-Path $install) -or (Test-Path $key)) { throw 'Refusing to overwrite an existing PANDORA installation.' }
$loginKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$loginName = 'io.sonnier.pandora'
if ((Get-ItemProperty -Path $loginKey -Name $loginName -ErrorAction SilentlyContinue)) { throw 'Refusing to overwrite an existing PANDORA startup entry.' }
$setup = Get-Item 'release/PANDORA-Setup-0.1.0-x64.exe'
$process = Start-Process $setup.FullName -ArgumentList '/S' -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Installer returned $($process.ExitCode)." }
$executable = Join-Path $install 'PANDORA.exe'
$uninstaller = Join-Path $install 'Uninstall PANDORA.exe'
if (-not (Test-Path $executable) -or -not (Test-Path $uninstaller)) { throw 'Installed executable or uninstaller missing.' }
if ((Get-ItemProperty $key).InstallLocation -ne $install) { throw 'Per-user uninstall registration does not match.' }
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'PANDORA.lnk'
$startLink = Join-Path ([Environment]::GetFolderPath('Programs')) 'PANDORA.lnk'
if (-not (Test-Path $desktopLink) -or -not (Test-Path $startLink)) { throw 'A requested shortcut is missing.' }
$env:PANDORA_SMOKE_EXECUTABLE = $executable
& node scripts/smoke-desktop.mjs
if ($LASTEXITCODE -ne 0) { throw 'Installed desktop read-only launch failed.' }
& node scripts/test-installed-lifecycle.mjs
if ($LASTEXITCODE -ne 0) { throw 'Installed startup and tray lifecycle checks failed.' }
Remove-Item Env:PANDORA_SMOKE_EXECUTABLE
$userData = Join-Path $env:APPDATA 'PANDORA'
New-Item -ItemType Directory -Path $userData -Force | Out-Null
$sentinel = Join-Path $userData ('installer-check-' + [Guid]::NewGuid() + '.txt')
$unrelated = Join-Path $install 'user-added-file.txt'
Set-Content -LiteralPath $sentinel -Value 'Preserve app data' -NoNewline
Set-Content -LiteralPath $unrelated -Value 'Preserve unrelated file' -NoNewline
try {
  $process = Start-Process $uninstaller -ArgumentList '/S' -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Uninstaller returned $($process.ExitCode)." }
  if ((Test-Path $executable) -or (Test-Path $key) -or (Test-Path $desktopLink) -or (Test-Path $startLink)) { throw 'Owned app, registration or shortcuts remain after uninstall.' }
  if ((Get-ItemProperty -Path $loginKey -Name $loginName -ErrorAction SilentlyContinue)) { throw 'Owned sign-in entry remains after uninstall.' }
  if ((Get-Content -Raw $sentinel) -ne 'Preserve app data') { throw 'Uninstall modified application data.' }
  if ((Get-Content -Raw $unrelated) -ne 'Preserve unrelated file') { throw 'Uninstall modified an unrelated file.' }
  # Reinstall in a separate empty directory and verify an external replacement is preserved.
  $externalInstall = Join-Path $env:LOCALAPPDATA 'Programs\PANDORA-lifecycle-conflict'
  if (Test-Path $externalInstall) { throw 'Unexpected conflict-fixture directory already exists.' }
  $process = Start-Process $setup.FullName -ArgumentList @('/S', ('/D=' + $externalInstall)) -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw 'Conflict-fixture installation failed.' }
  $externalCommand = '"C:\Pandora-Lifecycle-Fixture\Other.exe"'
  New-ItemProperty -Path $loginKey -Name $loginName -Value $externalCommand -PropertyType String -Force | Out-Null
  try {
    $process = Start-Process (Join-Path $externalInstall 'Uninstall PANDORA.exe') -ArgumentList '/S' -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw 'Conflict-fixture uninstallation failed.' }
    if ((Get-ItemPropertyValue -Path $loginKey -Name $loginName) -cne $externalCommand) { throw 'Uninstaller modified an external startup entry.' }
  } finally {
    if ((Get-ItemPropertyValue -Path $loginKey -Name $loginName -ErrorAction SilentlyContinue) -ceq $externalCommand) { Remove-ItemProperty -Path $loginKey -Name $loginName }
  }
  'Per-user install, launch, sign-in/tray controls, uninstall, startup conflict preservation and data preservation passed.'
} finally {
  # Remove only these disposable fixtures, never recursively remove user data.
  Remove-Item -LiteralPath $sentinel,$unrelated -ErrorAction SilentlyContinue
}
