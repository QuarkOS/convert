param(
  [switch]$Sign
)

class ThrowawayCert {
  static [string] WritePfx([string]$path, [string]$password) {
    $csp = New-Object System.Security.Cryptography.CspParameters(24, "Microsoft Enhanced RSA and AES Cryptographic Provider")
    $csp.Flags = [System.Security.Cryptography.CspProviderFlags]144
    $csp.KeyContainerName = "ConvertThrowaway"
    $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider(2048, $csp)
    $request = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest(
      "CN=Convert",
      $rsa,
      [System.Security.Cryptography.HashAlgorithmName]::SHA256,
      [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
    )
    $oids = New-Object System.Security.Cryptography.OidCollection
    [void]$oids.Add((New-Object System.Security.Cryptography.Oid("1.3.6.1.5.5.7.3.3")))
    $request.CertificateExtensions.Add((New-Object System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension($oids, $false)))
    $request.CertificateExtensions.Add((New-Object System.Security.Cryptography.X509Certificates.X509KeyUsageExtension(
      [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,
      $false
    )))
    $cert = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddDays(2))
    [System.IO.File]::WriteAllBytes($path, $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password))
    return $cert.Subject
  }
}

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here "..\..")).Path
$build = Join-Path $here "build"
New-Item -ItemType Directory -Force -Path $build | Out-Null

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$exe = Join-Path $build "Convert.exe"
if (-not (Test-Path $csc)) { throw "csc is not on this PC" }
& $csc /nologo /target:winexe /reference:System.Windows.Forms.dll "/out:$exe" (Join-Path $here "launcher\Convert.cs")
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $exe)) { throw "csc failed" }
Write-Output "EXE $exe"

$tools = Join-Path $repo "tools\sdk-buildtools"
$marker = Join-Path $tools "Microsoft.Windows.SDK.BuildTools.extracted"
if (-not (Test-Path $marker)) {
  New-Item -ItemType Directory -Force -Path $tools | Out-Null
  $version = "10.0.28000.2705"
  $nupkg = Join-Path $tools "Microsoft.Windows.SDK.BuildTools.nupkg"
  $url = "https://api.nuget.org/v3-flatcontainer/microsoft.windows.sdk.buildtools/$version/microsoft.windows.sdk.buildtools.$version.nupkg"
  Write-Output "SDK_DOWNLOAD $version"
  Invoke-WebRequest -Uri $url -OutFile $nupkg -UseBasicParsing
  $zip = "$nupkg.zip"
  Copy-Item $nupkg $zip -Force
  Expand-Archive -Path $zip -DestinationPath $tools -Force
  Set-Content -Path $marker -Value $version
}

$makeappx = Get-ChildItem $tools -Recurse -Filter makeappx.exe | Where-Object { $_.FullName -match "\\x64\\" } | Select-Object -First 1
$signtool = Get-ChildItem $tools -Recurse -Filter signtool.exe | Where-Object { $_.FullName -match "\\x64\\" } | Select-Object -First 1
if (-not $makeappx) { throw "makeappx.exe was not in Microsoft.Windows.SDK.BuildTools" }
if (-not $signtool) { throw "signtool.exe was not in Microsoft.Windows.SDK.BuildTools" }
Write-Output "MAKEAPPX $($makeappx.FullName)"
Write-Output "SIGNTOOL $($signtool.FullName)"

$layout = Join-Path $build "layout"
if (Test-Path $layout) { Remove-Item -Recurse -Force $layout }
New-Item -ItemType Directory -Force -Path (Join-Path $layout "assets") | Out-Null
Copy-Item (Join-Path $here "AppxManifest.xml") $layout
Copy-Item (Join-Path $here "assets\*") (Join-Path $layout "assets")
Copy-Item $exe $layout
$msix = Join-Path $build "Convert.msix"
if (Test-Path $msix) { Remove-Item -Force $msix }
& $makeappx.FullName pack /d $layout /p $msix /o
if ($LASTEXITCODE -ne 0) { throw "makeappx failed" }
Write-Output "MSIX_PACKED $msix"
Write-Output "NOT_SUBMITTED"

if (-not $Sign) { exit 0 }

$pfx = Join-Path $env:TEMP "convert-throwaway.pfx"
$password = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
$secure = ConvertTo-SecureString $password -AsPlainText -Force
try {
  $subject = [ThrowawayCert]::WritePfx($pfx, $password)
  Write-Output "CERT_SUBJECT $subject"
  Import-PfxCertificate -FilePath $pfx -Password $secure -CertStoreLocation "Cert:\CurrentUser\TrustedPeople" | Out-Null
  try {
    Import-PfxCertificate -FilePath $pfx -Password $secure -CertStoreLocation "Cert:\LocalMachine\TrustedPeople" | Out-Null
    Write-Output "CERT_TRUST local-machine"
  } catch {
    Write-Output "CERT_TRUST current-user"
  }

  $unlock = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"
  if (-not (Test-Path $unlock)) { New-Item -Path $unlock -Force | Out-Null }
  New-ItemProperty -Path $unlock -Name "AllowAllTrustedApps" -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $unlock -Name "AllowDevelopmentWithoutDevLicense" -Value 1 -PropertyType DWord -Force | Out-Null

  & $signtool.FullName sign /fd SHA256 /f $pfx /p $password $msix
  if ($LASTEXITCODE -ne 0) { throw "signtool failed" }
  Write-Output "MSIX_SIGNED"
} finally {
  if (Test-Path $pfx) { Remove-Item -Force $pfx }
}

Add-AppxPackage -Path $msix -ForceUpdateFromAnyVersion
Write-Output "APPX_INSTALLED"
Get-AppxPackage Quack.Convert | Format-List Name, PackageFullName, Version, Status, Publisher, InstallLocation, SignatureKind, IsFramework
