$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here "..\..")).Path
$out = Join-Path $repo "proof-out"
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Log([string]$message) {
  Add-Content -Path (Join-Path $out "ship.log") -Value $message
  [Console]::Out.WriteLine($message)
  [Console]::Out.Flush()
}

function Query-Text([string]$command) {
  $pref = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $text = & cmd.exe /c "$command & exit /b 0" 2>&1 | Out-String
  $ErrorActionPreference = $pref
  return $text.Trim()
}

class LoopbackSession {
  static [string] Connect([string]$user, [string]$password, [string]$temp, [string]$mstsc) {
    New-Item -Path "HKCU:\Software\Microsoft\Terminal Server Client" -Force | Out-Null
    New-ItemProperty -Path "HKCU:\Software\Microsoft\Terminal Server Client" -Name "AuthenticationLevelOverride" -Value 0 -PropertyType DWord -Force | Out-Null
    $rdp = Join-Path $temp "convert-loopback.rdp"
    $body = "full address:s:127.0.0.1`r`nusername:s:$user`r`nprompt for credentials:i:0`r`nauthentication level:i:0`r`n"
    Set-Content -Path $rdp -Encoding ASCII -Value $body
    & cmdkey.exe /generic:TERMSRV/127.0.0.1 /user:$user /pass:$password | Out-Null
    $proc = Start-Process -FilePath $mstsc -ArgumentList $rdp -PassThru
    return "mstsc.exe /v:127.0.0.1 pid=$($proc.Id)"
  }
}

Log "SHIP_START"
$tools = Join-Path $repo "tools"
New-Item -ItemType Directory -Force -Path $tools | Out-Null
$nodeHome = Join-Path $tools "node-v22.14.0-win-x64"
if (-not (Test-Path (Join-Path $nodeHome "node.exe"))) {
  Log "STEP node-download"
  $zip = Join-Path $tools "node.zip"
  Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip" -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath $tools -Force
}
$env:PATH = "$nodeHome;$env:PATH"
Log "NODE $(node -v)"
Set-Location $repo
Log "STEP npm-install"
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Log "STEP msix"
try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here "pack-msix.ps1") -Sign
  Log "MSIX_EXIT $LASTEXITCODE"
} catch {
  Log "MSIX_FAIL $($_.Exception.Message)"
}

Log "STEP desktop-user"
Log "WHOAMI $(whoami)"
Log "SESSION_BEFORE $(Query-Text 'query session')"
Log "USER_BEFORE $(Query-Text 'query user')"
$pass = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
$secure = ConvertTo-SecureString $pass -AsPlainText -Force
$existing = Get-LocalUser -Name "convertshot" -ErrorAction SilentlyContinue
if ($existing) { Remove-LocalUser -Name "convertshot" }
New-LocalUser -Name "convertshot" -Password $secure -PasswordNeverExpires -UserMayNotChangePassword | Out-Null
Add-LocalGroupMember -Group "Remote Desktop Users" -Member "convertshot"
Add-LocalGroupMember -Group "Administrators" -Member "convertshot"
Set-ItemProperty -Path "HKLM:\System\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -Value 0
Set-Service TermService -StartupType Manual -ErrorAction SilentlyContinue
Start-Service TermService
netsh advfirewall firewall set rule group="remote desktop" new enable=Yes | Out-Null
Log "RDP_SERVICE $((Get-Service TermService).Status)"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\convertwork\apps\windows\desktop-capture.ps1"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "convertshot"
$principal = New-ScheduledTaskPrincipal -UserId "convertshot" -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName "ConvertDesktop" -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Log "TASK_REGISTERED"

Log "ATTEMPT1 local mstsc loopback to 127.0.0.1"
try {
  Log ([LoopbackSession]::Connect("convertshot", $pass, $env:TEMP, "$env:SystemRoot\System32\mstsc.exe"))
} catch {
  Log "ATTEMPT1_FAIL $($_.Exception.Message)"
}
$deadline = (Get-Date).AddSeconds(50)
$seen = $false
$query = ""
while ((Get-Date) -lt $deadline) {
  $query = Query-Text "query user"
  if ($query -match "convertshot") {
    $seen = $true
    Log "QUERY $query"
    break
  }
  Start-Sleep -Seconds 3
}
if (-not $seen) {
  Log "ATTEMPT1_FAIL query user never showed convertshot"
  Log "QUERY $query"
  Log "SESSION_AFTER $(Query-Text 'query session')"
  Log "ATTEMPT2 Start-Process -FilePath powershell.exe -Credential COMPUTER\convertshot -LoadUserProfile -ArgumentList desktop-capture.ps1"
  try {
    $cred = New-Object System.Management.Automation.PSCredential ("$env:COMPUTERNAME\convertshot", $secure)
    Start-Process -FilePath "powershell.exe" -Credential $cred -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File C:\convertwork\apps\windows\desktop-capture.ps1" -LoadUserProfile
    Log "ATTEMPT2_STARTED"
  } catch {
    Log "ATTEMPT2_FAIL $($_.Exception.Message)"
  }
}

$wait = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $wait -and -not (Test-Path (Join-Path $out "desktop.done"))) { Start-Sleep -Seconds 2 }
if (Test-Path (Join-Path $out "desktop.log")) {
  Get-Content (Join-Path $out "desktop.log") | ForEach-Object { Log "DESK $_" }
}
$shot = Join-Path $out "explorer.png"
if (Test-Path $shot) {
  Write-Output "BEGIN_SHOT explorer.png"
  Write-Output ([Convert]::ToBase64String([IO.File]::ReadAllBytes($shot)))
  Write-Output "END_SHOT explorer.png"
  Log "SHOT_OK"
} else {
  Log "SHOT_MISSING"
}
Log "SHIP_DONE"
