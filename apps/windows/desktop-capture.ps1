param(
  [string]$Repo
)

$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($Repo)) {
  $Repo = (Resolve-Path (Join-Path $here "..\..")).Path
}
$repo = $Repo
$out = Join-Path $repo "proof-out"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$log = Join-Path $out "desktop.log"

function Log([string]$message) {
  Add-Content -Path $log -Value $message
  Write-Output $message
}

function Save-Shot([string]$name) {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen
  if (-not $screen) {
    Log "NO_SCREEN $name"
    return $false
  }
  $bounds = $screen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  } catch {
    Log "COPY_FAILED $name $($_.Exception.Message)"
    return $false
  }
  $path = Join-Path $out $name
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $colors = @{}
  for ($x = 0; $x -lt $bounds.Width; $x += 24) {
    for ($y = 0; $y -lt $bounds.Height; $y += 24) {
      $colors[$bitmap.GetPixel($x, $y).ToArgb()] = $true
    }
  }
  $graphics.Dispose()
  $bitmap.Dispose()
  Log "COLORS $name $($colors.Count) $($bounds.Width)x$($bounds.Height)"
  if ($colors.Count -le 2) {
    Remove-Item -Force $path -ErrorAction SilentlyContinue
    Log "BLANK $name"
    return $false
  }
  return $true
}

function Focus-Folder([string]$folder) {
  if (-not ("ConvertFocus" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ConvertFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
  }
  $title = Split-Path $folder -Leaf
  $proc = Get-Process explorer -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$title*" } |
    Select-Object -First 1
  if (-not $proc) {
    Log "NO_WINDOW $title"
    Get-Process explorer -ErrorAction SilentlyContinue | ForEach-Object { Log "EXPLORER_TITLE $($_.MainWindowTitle)" }
    return $false
  }
  [void][ConvertFocus]::ShowWindow($proc.MainWindowHandle, 9)
  [void][ConvertFocus]::SetForegroundWindow($proc.MainWindowHandle)
  Log "WINDOW $title"
  return $true
}

function Read-MenuNames {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName System.Windows.Forms
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $cond = New-Object System.Windows.Automation.PropertyCondition (
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::MenuItem
  )
  $items = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
  $names = @()
  foreach ($item in $items) { $names += $item.Current.Name }
  Log ("MENU " + ($names -join " | "))
  return $names
}

function Open-Classic([string]$file) {
  Add-Type -AssemblyName System.Windows.Forms
  $folder = Split-Path $file -Parent
  Start-Process explorer.exe -ArgumentList "/select,`"$file`""
  Start-Sleep -Seconds 3
  if (-not (Focus-Folder $folder)) { return $false }
  Start-Sleep -Milliseconds 500
  [System.Windows.Forms.SendKeys]::SendWait("+{F10}")
  Start-Sleep -Seconds 1
  $names = @(Read-MenuNames)
  $more = $names | Where-Object { $_ -eq "Show more options" } | Select-Object -First 1
  if ($more) {
    Log "SHOW_MORE"
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $cond = New-Object System.Windows.Automation.PropertyCondition (
      [System.Windows.Automation.AutomationElement]::NameProperty,
      "Show more options"
    )
    $item = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
    if ($item) {
      try {
        $invoke = $item.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $invoke.Invoke()
        Log "SHOW_MORE_INVOKED"
      } catch {
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Log "SHOW_MORE_KEY $($_.Exception.Message)"
      }
      Start-Sleep -Seconds 1
      $names = @(Read-MenuNames)
    }
  }
  if ($names -contains "Convert to") {
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $cond = New-Object System.Windows.Automation.PropertyCondition (
      [System.Windows.Automation.AutomationElement]::NameProperty,
      "Convert to"
    )
    $item = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
    if ($item) {
      try { $item.SetFocus() } catch { Log "FOCUS_ITEM $($_.Exception.Message)" }
      [System.Windows.Forms.SendKeys]::SendWait("{RIGHT}")
      Start-Sleep -Milliseconds 700
      Read-MenuNames | Out-Null
    }
    return $true
  }
  return $false
}

try {
  Log "DESKTOP_START user=$env:USERNAME session=$env:SESSIONNAME interactive=$([Environment]::UserInteractive)"
  $nodeHome = Join-Path $repo "tools\node-v22.14.0-win-x64"
  if (Test-Path (Join-Path $nodeHome "node.exe")) { $env:PATH = "$nodeHome;$env:PATH" }
  $files = Join-Path $repo "proof-files"
  New-Item -ItemType Directory -Force -Path $files | Out-Null
  Copy-Item (Join-Path $repo "packages\core\fixtures\images\red.png") (Join-Path $files "red.png") -Force
  $png = Join-Path $files "red.png"
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here "register-menu.ps1")
  Log "REGISTER_EXIT $LASTEXITCODE"

  $opened = $false
  try {
    $opened = Open-Classic $png
  } catch {
    Log "ATTEMPT1_ERROR $($_.Exception.Message)"
  }
  if ($opened) {
    $saved = Save-Shot "explorer.png"
    if ($saved) { Log "ATTEMPT1_OK" } else { Log "ATTEMPT1_FAIL screenshot was blank" }
  } else {
    Log "ATTEMPT1_FAIL Convert to was not in the classic menu"
    Save-Shot "attempt1-debug.png" | Out-Null
  }

  if (-not (Test-Path (Join-Path $out "explorer.png"))) {
    Log "ATTEMPT2 classic-menu registry"
    $clsid = "HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32"
    New-Item -Path $clsid -Force | Out-Null
    Set-Item -Path $clsid -Value ""
    Get-Process explorer -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process explorer.exe
    Start-Sleep -Seconds 2
    $opened = $false
    try {
      $opened = Open-Classic $png
    } catch {
      Log "ATTEMPT2_ERROR $($_.Exception.Message)"
    }
    if ($opened -and (Save-Shot "explorer.png")) {
      Log "ATTEMPT2_OK"
    } else {
      Log "ATTEMPT2_FAIL Convert to was still not visible"
    }
  }
} catch {
  Log "DESKTOP_ERROR $($_.Exception.Message)"
} finally {
  $ok = Test-Path (Join-Path $out "explorer.png")
  Set-Content -Path (Join-Path $out "desktop.done") -Value $(if ($ok) { "SUCCESS" } else { "FAIL" })
  Log "DESKTOP_DONE $ok"
  if (-not $ok) { exit 1 }
}
