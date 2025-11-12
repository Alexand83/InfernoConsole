; Script NSIS personalizzato per Inferno Console
; Gestisce la chiusura automatica dell'app durante l'installazione

; Include funzioni per manipolazione path e logica
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!insertmacro GetParent

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
  
  ; ✅ Crea cartella nel menu Start
  CreateDirectory "$SMPROGRAMS\Inferno Console"
  
  ; ✅ Crea shortcut per l'APP nel menu Start (nella stessa cartella dell'uninstaller)
  CreateShortcut "$SMPROGRAMS\Inferno Console\Inferno Console.lnk" "$INSTDIR\Inferno Console.exe"
  
  ; ✅ Crea shortcut per l'UNINSTALLER nel menu Start
  CreateShortcut "$SMPROGRAMS\Inferno Console\Uninstall Inferno Console.lnk" "$INSTDIR\Uninstall Inferno Console.exe"
!macroend

!macro customUnInstall
  ; ✅ Mostra SEMPRE i dettagli durante la disinstallazione
  SetDetailsView show
  
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
  
  ; ✅ LOG: Mostra cosa stiamo per cancellare
  DetailPrint "Rimozione directory: $INSTDIR"
  
  ; ✅ BEST PRACTICE NSIS: Cambia working directory prima di rimuovere $INSTDIR
  ; Questo evita problemi di lock e permette la rimozione corretta
  SetOutPath "$TEMP"
  DetailPrint "Working directory cambiata in TEMP"
  Sleep 500
  
  ; ✅ Rimuovi sottocartelle specifiche (solo se vuote)
  DetailPrint "Rimozione sottocartelle..."
  RMDir "$INSTDIR\locales"
  RMDir "$INSTDIR\resources"
  RMDir "$INSTDIR\swiftshader"
  Sleep 200
  
  ; ✅ Rimuovi la directory principale (solo se vuota)
  DetailPrint "Rimozione directory principale..."
  RMDir "$INSTDIR"
  Sleep 500
  
  ; Verifica finale
  ${If} ${FileExists} "$INSTDIR"
    DetailPrint "AVVISO: Directory $INSTDIR non completamente vuota (potrebbero esserci file utente)"
    StrCpy $1 "AVVISO: Alcuni file potrebbero rimanere (file utente o in uso)"
  ${Else}
    DetailPrint "OK: Directory $INSTDIR rimossa con successo"
    
    ; ✅ Rimuovi la cartella parent se è vuota
    ${un.GetParent} "$INSTDIR" $0
    DetailPrint "Tentativo rimozione parent: $0"
    RMDir "$0"
    Sleep 200
    
    ${If} ${FileExists} "$0"
      DetailPrint "AVVISO: Parent $0 non rimossa (contiene altri file)"
      StrCpy $1 "OK: App rimossa. Parent contiene altri file"
    ${Else}
      DetailPrint "OK: Parent $0 rimossa con successo"
      StrCpy $1 "OK: Tutte le cartelle rimosse completamente"
    ${EndIf}
  ${EndIf}
  
  ; ✅ Mostra riepilogo finale con pausa
  Sleep 1000
  MessageBox MB_OK|MB_ICONINFORMATION "Disinstallazione completata!$\n$\nDirectory: $INSTDIR$\nParent: $0$\n$\n$1"
!macroend
