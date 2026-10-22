Unicode true
Target amd64-unicode
RequestExecutionLevel user
ManifestDPIAware true

!define APP "Convert"
!define VER "1.0.0"
!ifndef PAYLOAD
  !define PAYLOAD "setup-payload"
!endif

Name "${APP}"
OutFile "Convert-Setup-${VER}.exe"
InstallDir "$LOCALAPPDATA\Programs\Convert"
InstallDirRegKey HKCU "Software\Convert" "InstallDir"

Function .onInit
  SetShellVarContext current
FunctionEnd

Function un.onInit
  SetShellVarContext current
FunctionEnd

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD}\*.*"
  WriteRegStr HKCU "Software\Convert" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Convert" "Version" "${VER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Convert" "DisplayName" "Convert ${VER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Convert" "DisplayVersion" "${VER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Convert" "Publisher" "Convert"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Convert" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Convert" "QuietUninstallString" "$\"$INSTDIR\Uninstall.exe$\" /S"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Convert" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Convert" "NoRepair" 1
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS"
  CreateShortcut "$SMPROGRAMS\Convert.lnk" "$INSTDIR\Convert.cmd" "" "$INSTDIR\apps\windows\assets\Square44x44Logo.png"
  !include "setup-menu-install.nsh"
SectionEnd

Section "Uninstall"
  !include "setup-menu-uninstall.nsh"
  Delete "$SMPROGRAMS\Convert.lnk"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Convert"
  DeleteRegKey HKCU "Software\Convert"
SectionEnd
