param()

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here "..\..")).Path
$out = Join-Path $repo "proof-out"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$log = Join-Path $out "ship.log"

function Log([string]$message) {
  Add-Content -Path $log -Value $message
  [Console]::Out.WriteLine($message)
  [Console]::Out.Flush()
}

class InteractiveSession {
  static [bool] Open([bool]$userInteractive, [string]$sessionName) {
    if (-not $userInteractive) { return $false }
    if ([string]::IsNullOrWhiteSpace($sessionName)) { return $false }
    if ($sessionName -eq "Services") { return $false }
    return $true
  }
}

Log "SHIP_START"
Log "REPO $repo"
if (-not [InteractiveSession]::Open([Environment]::UserInteractive, [string]$env:SESSIONNAME)) {
  Log "NOT_INTERACTIVE user=$env:USERNAME session=$env:SESSIONNAME userInteractive=$([Environment]::UserInteractive)"
  Log "NOT_INTERACTIVE a logged-on desktop session is required"
  exit 1
}
Log "INTERACTIVE user=$env:USERNAME session=$env:SESSIONNAME"

$tools = Join-Path $repo "tools"
New-Item -ItemType Directory -Force -Path $tools | Out-Null
$nodeHome = Join-Path $tools "node-v22.14.0-win-x64"
if (-not (Test-Path (Join-Path $nodeHome "node.exe")) -and -not (Get-Command node -ErrorAction SilentlyContinue)) {
  Log "STEP node-download"
  $zip = Join-Path $tools "node.zip"
  Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip" -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath $tools -Force
}
if (Test-Path (Join-Path $nodeHome "node.exe")) { $env:PATH = "$nodeHome;$env:PATH" }
Log "NODE $(node -v)"
Set-Location $repo
Log "STEP npm-install"
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) {
  Log "NPM_FAIL $LASTEXITCODE"
  exit $LASTEXITCODE
}

Log "STEP register-menu"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here "register-menu.ps1")
if ($LASTEXITCODE -ne 0) {
  Log "REGISTER_FAIL $LASTEXITCODE"
  exit $LASTEXITCODE
}
Log "REGISTER_OK"

Log "STEP desktop-capture"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here "desktop-capture.ps1") -Repo $repo
$shot = Join-Path $out "explorer.png"
Log "SCREENSHOT $shot"
if (Test-Path (Join-Path $out "desktop.log")) {
  Get-Content (Join-Path $out "desktop.log") | ForEach-Object { Log "DESK $_" }
}
if (-not (Test-Path $shot)) { Log "SHOT_MISSING" }

Log "STEP msix"
$msixLog = Join-Path $out "msix.log"
$saved = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here "pack-msix.ps1") -Sign > $msixLog 2>&1
$msixExit = $LASTEXITCODE
$ErrorActionPreference = $saved
if (Test-Path $msixLog) {
  Get-Content $msixLog | ForEach-Object { Log $_ }
}
Log "MSIX_EXIT $msixExit"
$pkg = Get-AppxPackage Quack.Convert | Format-List Name, PackageFullName, Version, Status, Publisher, InstallLocation, SignatureKind, IsFramework | Out-String
Log "APPX_PACKAGE Quack.Convert"
Log $pkg.Trim()
if (-not (Test-Path $shot)) { exit 1 }
if ($msixExit -ne 0) { exit $msixExit }
Log "SHIP_DONE"
exit 0
