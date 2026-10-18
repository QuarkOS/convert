$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path (Join-Path $here "..\..")
$out = Join-Path $repo "proof-out"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$log = Join-Path $out "capture.log"

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
  Log "SCREEN $name $($bounds.Width)x$($bounds.Height)"
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
  for ($x = 0; $x -lt $bounds.Width; $x += 32) {
    for ($y = 0; $y -lt $bounds.Height; $y += 32) {
      $colors[$bitmap.GetPixel($x, $y).ToArgb()] = $true
    }
  }
  $graphics.Dispose()
  $bitmap.Dispose()
  Log "COLORS $name $($colors.Count)"
  if ($colors.Count -le 2) {
    Remove-Item -Force $path
    Log "BLANK $name"
    return $false
  }
  return $true
}

function Focus-Explorer([string]$folder) {
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
  Log "WINDOW $title $($proc.Id)"
  return $true
}

function Open-Context([string]$file) {
  $folder = Split-Path $file -Parent
  Start-Process explorer.exe -ArgumentList "/select,`"$file`""
  Start-Sleep -Seconds 3
  if (-not (Focus-Explorer $folder)) { return $false }
  Add-Type -AssemblyName System.Windows.Forms
  Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait("+{F10}")
  Start-Sleep -Seconds 1
  return $true
}

function Read-MenuNames {
  Add-Type -AssemblyName UIAutomationClient
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

function Expand-ConvertTo {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName System.Windows.Forms
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $cond = New-Object System.Windows.Automation.PropertyCondition (
    [System.Windows.Automation.AutomationElement]::NameProperty,
    "Convert to"
  )
  $item = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
  if (-not $item) {
    Log "CONVERT_TO missing"
    return $false
  }
  Log "CONVERT_TO found"
  try {
    $pattern = $item.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
    $pattern.Expand()
    Log "EXPANDED pattern"
  } catch {
    try { $item.SetFocus() } catch { Log "FOCUS_ITEM $($_.Exception.Message)" }
    [System.Windows.Forms.SendKeys]::SendWait("{RIGHT}")
    Log "EXPANDED key"
  }
  Start-Sleep -Milliseconds 700
  return $true
}

try {
Log "CAPTURE_START session=$env:SESSIONNAME user=$env:USERNAME"
query user | ForEach-Object { Log "QUERY $_" }

$files = Join-Path $repo "proof-files"
New-Item -ItemType Directory -Force -Path $files | Out-Null
Copy-Item (Join-Path $repo "packages\core\fixtures\images\red.png") (Join-Path $files "red.png") -Force
Copy-Item (Join-Path $repo "packages\core\fixtures\documents\note.md") (Join-Path $files "note.md") -Force

Get-Process explorer -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process explorer.exe
Start-Sleep -Seconds 2

$png = Join-Path $files "red.png"
if (Open-Context $png) {
  $names = @(Read-MenuNames)
  if ($names -contains "Convert to") {
    Expand-ConvertTo | Out-Null
    Read-MenuNames | Out-Null
    Save-Shot "win-menu-png.png" | Out-Null
  } else {
    Save-Shot "win-menu-png-closed.png" | Out-Null
    Log "RETRY_CLASSIC"
    $clsid = "HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32"
    New-Item -Path $clsid -Force | Out-Null
    Set-Item -Path $clsid -Value ""
    Get-Process explorer -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process explorer.exe
    Start-Sleep -Seconds 2
    if (Open-Context $png) {
      Expand-ConvertTo | Out-Null
      Read-MenuNames | Out-Null
      Save-Shot "win-menu-png.png" | Out-Null
    }
  }
  [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
}

$md = Join-Path $files "note.md"
if (Open-Context $md) {
  Expand-ConvertTo | Out-Null
  Read-MenuNames | Out-Null
  Save-Shot "win-menu-md.png" | Out-Null
  [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
}

$window = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$here\window.ps1`"" -PassThru
Start-Sleep -Seconds 3
Save-Shot "win-empty-window.png" | Out-Null
if ($window -and -not $window.HasExited) { Stop-Process -Id $window.Id -Force -ErrorAction SilentlyContinue }

Log "CAPTURE_DONE"
} catch {
  Log "CAPTURE_ERROR $($_.Exception.Message)"
} finally {
  Set-Content -Path (Join-Path $out "capture.done") -Value "done"
}
