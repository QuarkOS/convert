$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "node is not on PATH" }
$hostScript = Join-Path $here "src\host.ts"
$errFile = Join-Path $env:TEMP "convert-menu-err.txt"
$json = & $node --disable-warning=ExperimentalWarning --experimental-strip-types $hostScript --menu 2>$errFile
if ($LASTEXITCODE -ne 0) { throw (Get-Content -Raw $errFile) }
$text = ($json | Out-String).Trim()
$start = $text.IndexOf("[")
$end = $text.LastIndexOf("]")
if ($start -lt 0 -or $end -le $start) { throw "Convert did not return a menu" }
$text = $text.Substring($start, $end - $start + 1)
Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$serializer.MaxJsonLength = 67108864
$entries = $serializer.DeserializeObject($text)
foreach ($entry in $entries) {
  $names = $entry["extensions"]
  if ($null -eq $names -or $names.Count -eq 0) { $names = @([string]$entry["extension"]) }
  foreach ($ext in $names) {
    $base = "HKCU:\Software\Classes\SystemFileAssociations\.$ext\shell\ConvertTo"
    New-Item -Path $base -Force | Out-Null
    Set-ItemProperty -Path $base -Name "MUIVerb" -Value "Convert to"
    Set-ItemProperty -Path $base -Name "SubCommands" -Value ""
    foreach ($target in $entry["targets"]) {
      $verb = Join-Path $base "shell\$target"
      New-Item -Path $verb -Force | Out-Null
      Set-ItemProperty -Path $verb -Name "MUIVerb" -Value ".$target"
      $command = Join-Path $verb "command"
      New-Item -Path $command -Force | Out-Null
      $run = '"' + $node + '" --disable-warning=ExperimentalWarning --experimental-strip-types "' + $hostScript + '" --to ' + $target + ' "%1"'
      $relative = $command -replace "^HKCU:\\", ""
      $writable = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($relative)
      if (-not $writable) { throw "Could not open $command" }
      $writable.SetValue("", $run)
      $writable.Close()
    }
  }
}
Write-Output "registered $($entries.Count) extensions"
