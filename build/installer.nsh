; Script NSIS personalizzato per Inferno Console
; Supporta modalità UPDATE (solo progress bar, no scelte)

!include "FileFunc.nsh"
!include "LogicLib.nsh"
!insertmacro GetParent

; Variabile per rilevare modalità UPDATE
Var UpdateMode

; ✅ Inizializzazione: rileva modalità UPDATE
!macro customInit
  ; Controlla se è stato passato /UPDATE come parametro
  ${GetParameters} $R0
  StrCpy $UpdateMode "0"
  ${StrContains} $R1 "/UPDATE" "$R0"
  ${If} $R1 != ""
    StrCpy $UpdateMode "1"
    
    ; In modalità UPDATE, leggi il path precedente dal registro
    ReadRegStr $INSTDIR HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$INSTDIR" "InstallLocation"
    ${If} $INSTDIR == ""
      ReadRegStr $INSTDIR HKCU "Software\Inferno Console" "InstallPath"
    ${EndIf}
  ${EndIf}
!macroend

!macro preInit
  ; ✅ FIX: Termina SOLO "Inferno Console.exe" (non node.exe o electron.exe generici)
  nsExec::ExecToLog 'taskkill /IM "Inferno Console.exe" /T /F 2>nul'
  Pop $0
  Sleep 1000
!macroend

!macro customInstall
  ; ✅ FIX: Termina SOLO "Inferno Console.exe" durante l'installazione
  nsExec::ExecToLog 'taskkill /IM "Inferno Console.exe" /T /F 2>nul'
  Pop $0
  Sleep 1000
  
  ; ✅ Mostra dettagli installazione
  ${If} $UpdateMode == "1"
    DetailPrint "Aggiornamento Inferno Console in corso..."
  ${Else}
    DetailPrint "Installazione Inferno Console in corso..."
  ${EndIf}
  Sleep 500
  
  DetailPrint "Estrazione file..."
  Sleep 300
  
  DetailPrint "Configurazione collegamenti..."
  ; ✅ Crea cartella nel menu Start
  CreateDirectory "$SMPROGRAMS\Inferno Console"
  
  ; ✅ Crea shortcut per l'APP nel menu Start
  CreateShortcut "$SMPROGRAMS\Inferno Console\Inferno Console.lnk" "$INSTDIR\Inferno Console.exe"
  
  ; ✅ Crea shortcut per l'UNINSTALLER nel menu Start
  CreateShortcut "$SMPROGRAMS\Inferno Console\Uninstall Inferno Console.lnk" "$INSTDIR\Uninstall Inferno Console.exe"
  Sleep 300
  
  DetailPrint "Registrazione applicazione..."
  Sleep 300
  
  ${If} $UpdateMode == "1"
    DetailPrint "Aggiornamento completato con successo!"
  ${Else}
    DetailPrint "Installazione completata con successo!"
  ${EndIf}
!macroend

!macro customUnInstall
  ; ✅ Mostra dettagli SOLO se non è chiamato dall'installer (disinstallazione manuale)
  ; Se è chiamato dall'installer, rimane silenzioso
  ${If} ${Silent}
    SetDetailsView hide
  ${Else}
    SetDetailsView show
  ${EndIf}
  
  ; Termina il processo Inferno Console durante la disinstallazione
  nsExec::ExecToLog 'taskkill /IM "Inferno Console.exe" /T /F 2>nul'
  Pop $0
  Sleep 500
  
  ; ✅ Rimuovi shortcut app dal menu Start
  Delete "$SMPROGRAMS\Inferno Console\Inferno Console.lnk"
  
  ; ✅ Rimuovi shortcut uninstaller dal menu Start
  Delete "$SMPROGRAMS\Inferno Console\Uninstall Inferno Console.lnk"
  
  ; ✅ Rimuovi cartella menu Start (solo se vuota)
  RMDir "$SMPROGRAMS\Inferno Console"
  
  ; ✅ BEST PRACTICE NSIS: Cambia working directory prima di rimuovere $INSTDIR
  ; Questo evita problemi di lock e permette la rimozione corretta
  SetOutPath "$TEMP"
  
  ; ✅ Rimuovi sottocartelle specifiche (solo se vuote)
  RMDir "$INSTDIR\locales"
  RMDir "$INSTDIR\resources"
  RMDir "$INSTDIR\swiftshader"
  Sleep 200
  
  ; ✅ Rimuovi la directory principale (solo se vuota)
  RMDir "$INSTDIR"
  Sleep 200
  
  ; ✅ Rimuovi la cartella parent se è vuota
  ${If} ${FileExists} "$INSTDIR"
    ; Directory non rimossa completamente
  ${Else}
    ${un.GetParent} "$INSTDIR" $0
    RMDir "$0"
  ${EndIf}
  
  ; Disinstallazione completata
!macroend

; ✅ Funzioni per saltare pagine in modalità UPDATE
Function .onInit
  ; Questa funzione viene chiamata all'avvio dell'installer
  ${GetParameters} $R0
  StrCpy $UpdateMode "0"
  ${StrContains} $R1 "/UPDATE" "$R0"
  ${If} $R1 != ""
    StrCpy $UpdateMode "1"
  ${EndIf}
FunctionEnd

Function PageDirectoryPre
  ${If} $UpdateMode == "1"
    Abort  ; Salta la pagina di scelta directory
  ${EndIf}
FunctionEnd

Function PageComponentsPre
  ${If} $UpdateMode == "1"
    Abort  ; Salta la pagina di scelta componenti
  ${EndIf}
FunctionEnd

