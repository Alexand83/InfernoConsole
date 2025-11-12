; Inferno Console - NSIS Installer Script
; Versione: 1.0.0
; Descrizione: Installer professionale per Inferno Console DJ Software

;--------------------------------
; Include Modern UI
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

;--------------------------------
; Configurazione Generale

; Nome dell'applicazione
!define APPNAME "Inferno Console"
!define COMPANYNAME "Inferno Console Team"
!define DESCRIPTION "Professional DJ Software"

; Versione (sarà sostituita dinamicamente)
!define VERSIONMAJOR 1
!define VERSIONMINOR 4
!define VERSIONBUILD 150

; Identificatore univoco per il registro
!define APPGUID "{8B5F7C3A-9D2E-4F1B-A8C6-3E7D9F2A1B4C}"

; File eseguibile principale
!define EXENAME "Inferno Console.exe"

; URL del progetto
!define HELPURL "https://github.com/Alexand83/InfernoConsole"
!define UPDATEURL "https://github.com/Alexand83/InfernoConsole/releases"
!define ABOUTURL "https://github.com/Alexand83/InfernoConsole"

; Nome del file installer
Name "${APPNAME}"
OutFile "..\dist\Inferno-Console-Setup.exe"
BrandingText "${APPNAME} Installer"

; Directory di installazione predefinita
InstallDir "$LOCALAPPDATA\${APPNAME}"

; Richiedi privilegi utente (non admin)
RequestExecutionLevel user

; Icona dell'installer
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

; Compressione
SetCompressor /SOLID lzma
SetCompressorDictSize 64

;--------------------------------
; Variabili

Var StartMenuFolder

;--------------------------------
; Pagine dell'Installer

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Benvenuto in ${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "Questo installer ti guiderà nell'installazione di ${APPNAME}.$\r$\n$\r$\nSe ${APPNAME} è attualmente in esecuzione, verrà chiuso automaticamente prima di procedere.$\r$\n$\r$\nClicca Avanti per continuare."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY

; Pagina Start Menu
!define MUI_STARTMENUPAGE_REGISTRY_ROOT "HKCU"
!define MUI_STARTMENUPAGE_REGISTRY_KEY "Software\${APPNAME}"
!define MUI_STARTMENUPAGE_REGISTRY_VALUENAME "Start Menu Folder"
!define MUI_STARTMENUPAGE_DEFAULTFOLDER "${APPNAME}"
!insertmacro MUI_PAGE_STARTMENU Application $StartMenuFolder

!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Avvia ${APPNAME}"
!define MUI_FINISHPAGE_LINK "Visita il sito del progetto"
!define MUI_FINISHPAGE_LINK_LOCATION "${ABOUTURL}"
!insertmacro MUI_PAGE_FINISH

;--------------------------------
; Pagine dell'Uninstaller

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

;--------------------------------
; Lingue

!insertmacro MUI_LANGUAGE "Italian"
!insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Funzioni di Utilità

; Funzione per chiudere l'applicazione se in esecuzione
Function CloseRunningApp
  DetailPrint "Controllo se ${APPNAME} è in esecuzione..."
  
  ; Cerca il processo
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ${EXENAME}" /NH'
  Pop $0 ; exit code
  Pop $1 ; output
  
  ${If} $0 == 0
    StrCpy $2 $1 ${EXENAME} ; cerca il nome del processo nell'output
    ${If} $2 == "${EXENAME}"
      DetailPrint "${APPNAME} è in esecuzione. Chiusura in corso..."
      
      ; Prova a chiudere gentilmente
      nsExec::ExecToLog 'taskkill /IM "${EXENAME}" /T'
      Sleep 2000
      
      ; Verifica se è ancora in esecuzione
      nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ${EXENAME}" /NH'
      Pop $0
      Pop $1
      
      StrCpy $2 $1 ${EXENAME}
      ${If} $2 == "${EXENAME}"
        DetailPrint "${APPNAME} non risponde. Chiusura forzata..."
        nsExec::ExecToLog 'taskkill /F /IM "${EXENAME}" /T'
        Sleep 1000
      ${Else}
        DetailPrint "${APPNAME} chiuso correttamente."
      ${EndIf}
    ${Else}
      DetailPrint "${APPNAME} non è in esecuzione."
    ${EndIf}
  ${EndIf}
FunctionEnd

; Funzione per verificare se è un aggiornamento
Function CheckExistingInstall
  ; Controlla se esiste già un'installazione
  ReadRegStr $0 HKCU "Software\${APPNAME}" "InstallPath"
  ${If} $0 != ""
    ${If} ${FileExists} "$0\${EXENAME}"
      DetailPrint "Installazione esistente trovata in: $0"
      StrCpy $INSTDIR $0
    ${EndIf}
  ${EndIf}
FunctionEnd

;--------------------------------
; Sezione Installer

Section "Installazione" SecInstall
  SectionIn RO ; Obbligatoria
  
  ; Chiudi l'app se in esecuzione
  Call CloseRunningApp
  
  ; Imposta la directory di output
  SetOutPath "$INSTDIR"
  
  ; Copia i file dell'applicazione
  DetailPrint "Copia file dell'applicazione..."
  
  ; File principale (da scaricare da GitHub releases)
  File "/oname=${EXENAME}" "..\dist-electron\Inferno-Console-win.exe"
  
  ; Crea file di versione
  FileOpen $0 "$INSTDIR\version.txt" w
  FileWrite $0 "Inferno Console v${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}$\r$\n"
  FileWrite $0 "Installato il: $\r$\n"
  FileWrite $0 "Directory: $INSTDIR$\r$\n"
  FileClose $0
  
  ; Scrivi nel registro
  DetailPrint "Registrazione dell'applicazione..."
  WriteRegStr HKCU "Software\${APPNAME}" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\${APPNAME}" "Version" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
  WriteRegStr HKCU "Software\${APPNAME}" "InstallDate" "$\r$\n"
  
  ; Aggiungi a Add/Remove Programs
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${COMPANYNAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "HelpLink" "${HELPURL}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLUpdateInfo" "${UPDATEURL}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLInfoAbout" "${ABOUTURL}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMinor" ${VERSIONMINOR}
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair" 1
  
  ; Calcola dimensione installazione
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "EstimatedSize" "$0"
  
  ; Crea uninstaller
  DetailPrint "Creazione uninstaller..."
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Crea shortcuts
  DetailPrint "Creazione shortcuts..."
  
  ; Shortcut Desktop
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  
  ; Shortcut Start Menu
  !insertmacro MUI_STARTMENU_WRITE_BEGIN Application
    CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
    CreateShortcut "$SMPROGRAMS\$StartMenuFolder\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
    CreateShortcut "$SMPROGRAMS\$StartMenuFolder\Disinstalla ${APPNAME}.lnk" "$INSTDIR\uninstall.exe"
  !insertmacro MUI_STARTMENU_WRITE_END
  
  DetailPrint "Installazione completata!"
SectionEnd

;--------------------------------
; Sezione Uninstaller

Section "Uninstall"
  ; Chiudi l'app se in esecuzione
  DetailPrint "Controllo se ${APPNAME} è in esecuzione..."
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ${EXENAME}" /NH'
  Pop $0
  Pop $1
  
  StrCpy $2 $1 ${EXENAME}
  ${If} $2 == "${EXENAME}"
    DetailPrint "${APPNAME} è in esecuzione. Chiusura in corso..."
    nsExec::ExecToLog 'taskkill /F /IM "${EXENAME}" /T'
    Sleep 2000
  ${EndIf}
  
  ; Rimuovi file
  DetailPrint "Rimozione file dell'applicazione..."
  Delete "$INSTDIR\${EXENAME}"
  Delete "$INSTDIR\Inferno-Console-win.exe"
  Delete "$INSTDIR\version.txt"
  Delete "$INSTDIR\installer-config.json"
  Delete "$INSTDIR\uninstall.exe"
  
  ; Rimuovi shortcuts
  DetailPrint "Rimozione shortcuts..."
  Delete "$DESKTOP\${APPNAME}.lnk"
  
  !insertmacro MUI_STARTMENU_GETFOLDER Application $StartMenuFolder
  Delete "$SMPROGRAMS\$StartMenuFolder\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\$StartMenuFolder\Disinstalla ${APPNAME}.lnk"
  RMDir "$SMPROGRAMS\$StartMenuFolder"
  
  ; Rimuovi directory se vuota
  RMDir "$INSTDIR"
  
  ; Rimuovi dal registro
  DetailPrint "Rimozione dal registro di sistema..."
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  DeleteRegKey HKCU "Software\${APPNAME}"
  
  DetailPrint "Disinstallazione completata!"
SectionEnd

;--------------------------------
; Callback Functions

Function .onInit
  ; Controlla se esiste già un'installazione
  Call CheckExistingInstall
  
  ; Verifica se l'installer è già in esecuzione
  System::Call 'kernel32::CreateMutex(i 0, i 0, t "InfernoConsoleInstallerMutex") i .r1 ?e'
  Pop $R0
  ${If} $R0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "L'installer di ${APPNAME} è già in esecuzione."
    Abort
  ${EndIf}
FunctionEnd

Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Sei sicuro di voler disinstallare ${APPNAME}?" IDYES +2
  Abort
FunctionEnd

