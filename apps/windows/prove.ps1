$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here "..\..")).Path
$out = Join-Path $repo "proof-out"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$log = Join-Path $out "prove.log"

function Log([string]$message) {
  Add-Content -Path $log -Value $message
  Write-Output $message
}

function Have([string]$name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Log "PROVE_START"
Log "PWD $repo"
query user | ForEach-Object { Log "QUERY $_" }

$tools = Join-Path $repo "tools"
New-Item -ItemType Directory -Force -Path $tools | Out-Null

if (-not (Have "node")) {
  Log "STEP node-download"
  $zip = Join-Path $tools "node.zip"
  $url = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath $tools -Force
  $nodeHome = Join-Path $tools "node-v22.14.0-win-x64"
  $env:PATH = "$nodeHome;$env:PATH"
}
Log "NODE $(node -v)"

if (-not (Have "ffmpeg")) {
  Log "STEP ffmpeg-static"
  try {
    npm install --prefix $tools ffmpeg-static@5.2.0 --no-fund --no-audit
    $ffmpeg = Join-Path $tools "node_modules\ffmpeg-static\ffmpeg.exe"
    if (Test-Path $ffmpeg) {
      $bin = Join-Path $tools "ffmpeg-bin"
      New-Item -ItemType Directory -Force -Path $bin | Out-Null
      Copy-Item $ffmpeg (Join-Path $bin "ffmpeg.exe") -Force
      $env:PATH = "$bin;$env:PATH"
      Log "FFMPEG $ffmpeg"
    } else {
      Log "FFMPEG missing after install"
    }
  } catch {
    Log "FFMPEG_DOWNLOAD $($_.Exception.Message)"
  }
} else {
  Log "FFMPEG on PATH"
}

Log "STEP npm-install"
Set-Location $repo
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Log "STEP test"
npm test -w @convert/windows
if ($LASTEXITCODE -ne 0) { throw "windows tests failed" }

Log "STEP typecheck"
npm run typecheck -w @convert/windows
if ($LASTEXITCODE -ne 0) { throw "windows typecheck failed" }

$fixture = Join-Path $repo "packages\core\fixtures\images\red.png"
$batch = Join-Path $out "batch"
New-Item -ItemType Directory -Force -Path $batch | Out-Null
Copy-Item $fixture (Join-Path $batch "one.png") -Force
Copy-Item $fixture (Join-Path $batch "two.png") -Force
$hostScript = Join-Path $here "src\host.ts"
$samples = @()
foreach ($n in 1..5) {
  Remove-Item (Join-Path $batch "one.jpg") -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $batch "two.jpg") -ErrorAction SilentlyContinue
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & node --disable-warning=ExperimentalWarning --experimental-strip-types $hostScript --to jpg (Join-Path $batch "one.png") (Join-Path $batch "two.png")
  if ($LASTEXITCODE -ne 0) { throw "batch convert failed" }
  $sw.Stop()
  $samples += $sw.ElapsedMilliseconds
  Log "SAMPLE $n $($sw.ElapsedMilliseconds)"
}
foreach ($name in @("one.jpg", "two.jpg")) {
  $bytes = [IO.File]::ReadAllBytes((Join-Path $batch $name))
  if ($bytes[0] -ne 0xFF -or $bytes[1] -ne 0xD8 -or $bytes[2] -ne 0xFF) { throw "$name is not jpeg" }
  Log "JPEG $name $($bytes.Length)"
}
Log "PERF $($samples -join ',')"

$before = Test-Path "HKCU:\Software\Classes\SystemFileAssociations\.png\shell\ConvertTo"
Log "REG_BEFORE $before"
Log "STEP register"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here "register-menu.ps1")
if ($LASTEXITCODE -ne 0) { throw "register-menu failed" }
$after = Test-Path "HKCU:\Software\Classes\SystemFileAssociations\.png\shell\ConvertTo"
$cmdKey = "HKCU:\Software\Classes\SystemFileAssociations\.png\shell\ConvertTo\shell\jpg\command"
$cmd = (Get-Item -LiteralPath $cmdKey).GetValue("")
Log "REG_AFTER $after"
Log "REG_CMD $cmd"
if ($cmd -notmatch " --to jpg ") { throw "jpg verb was not registered" }

$mdKey = "HKCU:\Software\Classes\SystemFileAssociations\.md\shell\ConvertTo\shell"
$mdTargets = @(Get-ChildItem $mdKey | ForEach-Object { $_.PSChildName })
Log "MD_TARGETS $($mdTargets -join ',')"
if ($mdTargets -notcontains "docx" -or $mdTargets -notcontains "pdf") { throw "markdown menu is missing docx or pdf" }
if ($mdTargets -contains "mp3") { throw "markdown menu offers mp3" }

$pngKey = "HKCU:\Software\Classes\SystemFileAssociations\.png\shell\ConvertTo\shell"
$pngTargets = @(Get-ChildItem $pngKey | ForEach-Object { $_.PSChildName })
Log "PNG_TARGETS $($pngTargets -join ',')"
if ($pngTargets -contains "heic") { throw "png menu offers heic" }
if ($pngTargets -contains "mp3") { throw "png menu offers mp3" }

if (Have "ffmpeg") {
  $wav = Join-Path $repo "packages\core\fixtures\audio\tone.wav"
  $mp3 = Join-Path $repo "packages\core\fixtures\audio\tone.mp3"
  & node --disable-warning=ExperimentalWarning --experimental-strip-types $hostScript --to mp3 $wav
  if ($LASTEXITCODE -ne 0) { throw "wav convert failed" }
  if (Have "ffprobe") {
    & ffprobe -hide_banner -show_streams $mp3
  } else {
    Log "FFPROBE missing"
    $audioLog = Join-Path $out "audio.txt"
    cmd.exe /c "ffmpeg -hide_banner -i `"$mp3`" > `"$audioLog`" 2>&1 & exit /b 0"
    Get-Content $audioLog | ForEach-Object { Log "AUDIO $_" }
    $audioText = Get-Content -Raw $audioLog
    if ($audioText -notmatch "Audio:") { throw "mp3 has no audio stream" }
  }
  if (-not (Test-Path $mp3)) { throw "wav convert wrote no mp3" }
  Log "WAV_OK $mp3"
} else {
  Log "WAV_SKIP ffmpeg is not installed"
}

Log "STEP pack"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here "pack.ps1")

Log "INTERACTIVE $([Environment]::UserInteractive)"
query session 2>&1 | ForEach-Object { Log "SESSION $_" }
Log "STEP capture"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here "capture-menu.ps1")
$shot = Join-Path $out "win-menu-png.png"
if (-not (Test-Path $shot)) {
  Log "STEP psexec"
  try {
    $zip = Join-Path $tools "PSTools.zip"
    Invoke-WebRequest -Uri "https://download.sysinternals.com/files/PSTools.zip" -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath (Join-Path $tools "PSTools") -Force
    $psexec = Join-Path $tools "PSTools\PsExec64.exe"
    $query = query session 2>&1 | Out-String
    $session = $null
    if ($query -match "console\s+(\d+)") { $session = [int]$Matches[1] }
    elseif ($query -match "(\d+)\s+Active") { $session = [int]$Matches[1] }
    if ($null -eq $session) {
      Log "PSEXEC no console session"
    } else {
      Log "PSEXEC session $session"
      & $psexec -accepteula -nobanner -i $session -w $repo powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here "capture-menu.ps1")
    }
  } catch {
    Log "PSEXEC_FAILED $($_.Exception.Message)"
  }
}

Get-ChildItem $out -Filter *.png -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Output "BEGIN_SHOT $($_.Name)"
  Write-Output ([Convert]::ToBase64String([IO.File]::ReadAllBytes($_.FullName)))
  Write-Output "END_SHOT $($_.Name)"
}
if (Test-Path (Join-Path $out "capture.log")) {
  Log "CAPTURE_LOG_FOLLOWS"
  Get-Content (Join-Path $out "capture.log") | ForEach-Object { Log "CAP $_" }
}
Log "PROVE_DONE"
