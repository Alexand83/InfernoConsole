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
  
  ; ✅ Rimuovi TUTTA la directory di installazione con /r (ricorsivo)
  ; Usa /REBOOTOK per forzare la rimozione anche se ci sono lock
  RMDir /r /REBOOTOK "$INSTDIR"
  
  ; Aspetta un momento per permettere a Windows di completare
  Sleep 500
  
  ; Secondo tentativo se la directory esiste ancora
  ${If} ${FileExists} "$INSTDIR"
    DetailPrint "Directory ancora presente, secondo tentativo..."
    RMDir /r "$INSTDIR"
    Sleep 500
  ${EndIf}
  
  ; Verifica finale
  ${If} ${FileExists} "$INSTDIR"
    DetailPrint "ERRORE: Directory $INSTDIR non rimossa completamente"
  ${Else}
    DetailPrint "OK: Directory $INSTDIR rimossa con successo"
  ${EndIf}
  
  ; ✅ Rimuovi la cartella parent se è vuota (con retry)
  ${un.GetParent} "$INSTDIR" $0
  DetailPrint "Tentativo rimozione parent: $0"
  
  ; Primo tentativo
  RMDir "$0"
  
  ; Verifica se esiste ancora
  ${If} ${FileExists} "$0"
    DetailPrint "Parent ancora esistente, secondo tentativo..."
    Sleep 500
    RMDir "$0"
    
    ${If} ${FileExists} "$0"
      DetailPrint "AVVISO: Parent $0 non rimossa (potrebbe contenere altri file)"
      StrCpy $1 "AVVISO: Cartella parent non rimossa (contiene altri file)"
    ${Else}
      DetailPrint "OK: Parent $0 rimossa al secondo tentativo"
      StrCpy $1 "OK: Tutte le cartelle rimosse"
    ${EndIf}
  ${Else}
    DetailPrint "OK: Parent $0 rimossa al primo tentativo"
    StrCpy $1 "OK: Tutte le cartelle rimosse"
  ${EndIf}
  
  ; ✅ Mostra riepilogo finale con pausa
  Sleep 1000
  MessageBox MB_OK|MB_ICONINFORMATION "Disinstallazione completata!$\n$\nDirectory: $INSTDIR$\nParent: $0$\n$\n$1"
!macroend
