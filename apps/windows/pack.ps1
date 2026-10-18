$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$build = Join-Path $here "build"
New-Item -ItemType Directory -Force -Path $build | Out-Null
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (Test-Path $csc) {
  & $csc /nologo /t:winexe /r:System.Windows.Forms.dll /out:(Join-Path $build "Convert.exe") (Join-Path $here "launcher\Convert.cs")
  if ($LASTEXITCODE -ne 0) { throw "csc failed" }
  Write-Output "EXE $(Join-Path $build 'Convert.exe')"
} else {
  Write-Output "CSC missing"
}

$makeappx = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter makeappx.exe -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match "x64" } |
  Select-Object -First 1
if (-not $makeappx) {
  Write-Output "MSIX_SDK missing"
  exit 0
}

$layout = Join-Path $build "layout"
if (Test-Path $layout) { Remove-Item -Recurse -Force $layout }
New-Item -ItemType Directory -Force -Path (Join-Path $layout "assets") | Out-Null
Copy-Item (Join-Path $here "AppxManifest.xml") $layout
Copy-Item (Join-Path $here "assets\*") (Join-Path $layout "assets")
Copy-Item (Join-Path $build "Convert.exe") $layout
$msix = Join-Path $build "Convert.msix"
if (Test-Path $msix) { Remove-Item -Force $msix }
& $makeappx.FullName pack /d $layout /p $msix /o
Write-Output "MSIX $msix"
Write-Output "NOT_SUBMITTED"
