$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "node is not on PATH" }
$hostScript = Join-Path $here "src\host.ts"
$json = & $node --disable-warning=ExperimentalWarning --experimental-strip-types $hostScript --menu
$entries = @($json | ConvertFrom-Json)
foreach ($entry in $entries) {
  $names = @($entry.extensions)
  if ($names.Count -eq 0) { $names = @($entry.extension) }
  foreach ($ext in $names) {
    $base = "HKCU:\Software\Classes\SystemFileAssociations\.$ext\shell\ConvertTo"
    New-Item -Path $base -Force | Out-Null
    Set-ItemProperty -Path $base -Name "MUIVerb" -Value "Convert to"
    Set-ItemProperty -Path $base -Name "SubCommands" -Value ""
    foreach ($target in @($entry.targets)) {
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
