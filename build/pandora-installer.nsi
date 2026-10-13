; A normal per-user NSIS installer. WriteUninstaller runs during installation,
; so building on Linux never executes a Windows helper or needs Wine.
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
!include "nsProcess.nsh"
!include "${PROJECT_DIR}\release\pandora-owned-files.nsh"
!define REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\io.sonnier.pandora"
Name "PANDORA — Created by Sonnier"
BrandingText "Created by Sonnier"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\PANDORA"
ShowInstDetails show
ShowUninstDetails show
CRCCheck on
!define MUI_ABORTWARNING
!ifndef MUI_ICON
  !define MUI_ICON "${BUILD_RESOURCES_DIR}\icon.ico"
!endif
!ifndef MUI_UNICON
  !define MUI_UNICON "${BUILD_RESOURCES_DIR}\icon.ico"
!endif
!define MUI_WELCOMEPAGE_TITLE "PANDORA — Created by Sonnier"
!define MUI_WELCOMEPAGE_TEXT "Local hardware insights, reviewed settings, and a safer cleanup workflow.$\r$\n$\r$\nInstalls for your Windows account. No administrator access is required.$\r$\n$\r$\nThis development build is unsigned."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\PANDORA.exe"
!insertmacro MUI_PAGE_FINISH
!define MUI_UNWELCOMEPAGE_TITLE "Uninstall PANDORA"
!define MUI_UNWELCOMEPAGE_TEXT "Before uninstalling, use Restore & History to restore preferences you no longer want.$\r$\n$\r$\nUninstalling removes PANDORA files and shortcuts. It keeps your settings and rollback history and does not change Windows preferences."
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

!macro RequireClosed
  retryClose:
    ${nsProcess::FindProcess} "PANDORA.exe" $0
    ${If} $0 == 0
      MessageBox MB_RETRYCANCEL|MB_ICONINFORMATION "Close PANDORA after any cleanup or settings operation finishes, then click Retry." /SD IDCANCEL IDRETRY retryClose
      Abort
    ${EndIf}
    ${nsProcess::Unload}
!macroend
Function .onInit
  SetShellVarContext current
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "PANDORA requires 64-bit Windows."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "PANDORA requires Windows 10 or later. Windows 11 x64 is recommended."
    Abort
  ${EndIf}
  SetRegView 64
  ReadRegStr $0 HKCU "${REGKEY}" "InstallLocation"
  ${If} $0 != ""
    StrCpy $INSTDIR $0
  ${EndIf}
  !insertmacro RequireClosed
FunctionEnd

Function .onVerifyInstDir
  ; Never overwrite a nonempty unrelated directory, including a drive root.
  FindFirst $R8 $R9 "$INSTDIR\*.*"
  checkEntry:
    StrCmp $R9 "" emptyDirectory
    StrCmp $R9 "." nextEntry
    StrCmp $R9 ".." nextEntry hasContents
  nextEntry:
    FindNext $R8 $R9
    Goto checkEntry
  emptyDirectory:
    FindClose $R8
    Goto done
  hasContents:
    FindClose $R8
  ReadRegStr $0 HKCU "${REGKEY}" "InstallLocation"
  ${If} $0 != $INSTDIR
    Abort
  ${EndIf}
  IfFileExists "$INSTDIR\pandora-install.id" done
  Abort
  done:
FunctionEnd

Section "PANDORA"
  !insertmacro RequireClosed
  ; Directory validation is also required for silent /D installs.
  Call .onVerifyInstDir
  ClearErrors
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall PANDORA.exe"
  FileOpen $0 "$INSTDIR\pandora-install.id" w
  FileWrite $0 "io.sonnier.pandora"
  FileClose $0
  IfErrors installFailed
  WriteRegStr HKCU "${REGKEY}" "InstallLocation" "$INSTDIR"
  ClearErrors
  !insertmacro PandoraInstallFiles
  IfErrors installFailed
  SetOutPath "$INSTDIR"
  CreateShortcut "$SMPROGRAMS\PANDORA.lnk" "$INSTDIR\PANDORA.exe"
  CreateShortcut "$DESKTOP\PANDORA.lnk" "$INSTDIR\PANDORA.exe"
  WriteRegStr HKCU "${REGKEY}" "DisplayName" "PANDORA — Created by Sonnier"
  WriteRegStr HKCU "${REGKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${REGKEY}" "Publisher" "Sonnier"
  WriteRegStr HKCU "${REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${REGKEY}" "DisplayIcon" "$INSTDIR\PANDORA.exe,0"
  WriteRegStr HKCU "${REGKEY}" "UninstallString" '$\"$INSTDIR\Uninstall PANDORA.exe$\"'
  WriteRegStr HKCU "${REGKEY}" "QuietUninstallString" '$\"$INSTDIR\Uninstall PANDORA.exe$\" /S'
  WriteRegDWORD HKCU "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${REGKEY}" "NoRepair" 1
  Goto finished
  installFailed:
    MessageBox MB_OK|MB_ICONSTOP "PANDORA could not finish installation. Close the app, check free space and folder permissions, then run Setup again."
    SetErrorLevel 1
    Abort
  finished:
SectionEnd

Function un.onInit
  SetShellVarContext current
  SetRegView 64
  ReadRegStr $0 HKCU "${REGKEY}" "InstallLocation"
  ${If} $0 != $INSTDIR
    MessageBox MB_OK|MB_ICONSTOP "This is not the registered PANDORA installation folder. No files were removed."
    Abort
  ${EndIf}
  IfFileExists "$INSTDIR\pandora-install.id" +3
    MessageBox MB_OK|MB_ICONSTOP "The PANDORA installation marker is missing. No files were removed."
    Abort
  !insertmacro RequireClosed
FunctionEnd
Section "Uninstall"
  ClearErrors
  !insertmacro PandoraRemoveFiles
  ; If files were locked, keep registration so the user can rerun uninstall.
  !insertmacro PandoraCheckRemoval
  Delete "$SMPROGRAMS\PANDORA.lnk"
  Delete "$DESKTOP\PANDORA.lnk"
  Delete "$INSTDIR\pandora-install.id"
  Delete "$INSTDIR\Uninstall PANDORA.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${REGKEY}"
  Goto finished
  uninstallFailed:
    MessageBox MB_OK|MB_ICONSTOP "Some PANDORA files could not be removed. Close the app and run uninstall again. Your settings and history are preserved."
    SetErrorLevel 1
    Abort
  finished:
SectionEnd
