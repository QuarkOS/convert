$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundled = Join-Path $here "..\..\runtime\node.exe"
if (Test-Path -LiteralPath $bundled) {
  $node = (Resolve-Path -LiteralPath $bundled).Path
} else {
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
}
if (-not $node) { throw "Convert's runtime is missing" }
$hostBuilt = Join-Path $here "host.mjs"
if (Test-Path -LiteralPath $hostBuilt) {
  $hostScript = $hostBuilt
  $hostArgs = @("--disable-warning=ExperimentalWarning", $hostScript)
} else {
  $hostScript = Join-Path $here "src\host.ts"
  $hostArgs = @("--disable-warning=ExperimentalWarning", "--experimental-strip-types", $hostScript)
}
$files = @($args | Where-Object { $_ -and (Test-Path -LiteralPath $_) })

$form = New-Object System.Windows.Forms.Form
$form.Text = "Convert"
$form.ClientSize = New-Object System.Drawing.Size(420, 280)
$form.StartPosition = "CenterScreen"
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

if ($files.Count -eq 0) {
  $empty = New-Object System.Windows.Forms.Label
  $empty.Text = "No file is selected."
  $empty.AutoSize = $true
  $empty.Location = New-Object System.Drawing.Point(24, 28)
  $form.Controls.Add($empty)
  [void]$form.ShowDialog()
  exit 0
}

$list = New-Object System.Windows.Forms.ListBox
$list.Location = New-Object System.Drawing.Point(24, 24)
$list.Size = New-Object System.Drawing.Size(372, 120)
foreach ($file in $files) { [void]$list.Items.Add([IO.Path]::GetFileName($file)) }
$form.Controls.Add($list)

$errFile = Join-Path $env:TEMP "convert-targets-err.txt"
$targetsJson = & $node @hostArgs --targets @files 2>$errFile
if ($LASTEXITCODE -ne 0) { throw (Get-Content -Raw $errFile) }
$targetText = ($targetsJson | Out-String).Trim()
$targetStart = $targetText.IndexOf("[")
$targetEnd = $targetText.LastIndexOf("]")
if ($targetStart -lt 0 -or $targetEnd -le $targetStart) { throw "Convert did not return targets" }
$targetText = $targetText.Substring($targetStart, $targetEnd - $targetStart + 1)
Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$targets = $serializer.DeserializeObject($targetText)
$picker = New-Object System.Windows.Forms.ComboBox
$picker.Location = New-Object System.Drawing.Point(24, 160)
$picker.Size = New-Object System.Drawing.Size(160, 28)
$picker.DropDownStyle = "DropDownList"
foreach ($target in $targets) { [void]$picker.Items.Add(".$target") }
if ($picker.Items.Count -gt 0) { $picker.SelectedIndex = 0 }
$form.Controls.Add($picker)

$status = New-Object System.Windows.Forms.Label
$status.AutoSize = $true
$status.Location = New-Object System.Drawing.Point(24, 220)
if ($picker.Items.Count -eq 0) { $status.Text = "These files have no shared conversion." }
$form.Controls.Add($status)

$button = New-Object System.Windows.Forms.Button
$button.Text = "Convert"
$button.Location = New-Object System.Drawing.Point(200, 158)
$button.Enabled = $picker.Items.Count -gt 0
$button.Add_Click({
  $choice = $picker.SelectedItem.ToString().TrimStart(".")
  $output = & $node @hostArgs --to $choice @files 2>&1
  $status.Text = ($output | Select-Object -Last 4) -join " "
})
$form.Controls.Add($button)
[void]$form.ShowDialog()
