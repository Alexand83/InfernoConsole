; Script NSIS personalizzato per Inferno Console
; Gestisce la chiusura automatica dell'app durante l'installazione

; Include funzioni per manipolazione path
!include "FileFunc.nsh"

!macro preInit
  ; ✅ FIX: Termina SOLO "Inferno Console.exe" (non node.exe o electron.exe generici)
  ; Usa /T per terminare anche i processi figli
  nsExec::ExecToLog 'taskkill /IM "Inferno Console.exe" /T /F 2>nul'
  Pop $0
  
  ; Aspetta un momento per assicurarsi che il processo sia terminato
  Sleep 1000
!macroend

!macro customInstall
  ; ✅ FIX: Termina SOLO "Inferno Console.exe" durante l'installazione
  nsExec::ExecToLog 'taskkill /IM "Inferno Console.exe" /T /F 2>nul'
  Pop $0
  
  ; Aspetta un momento per assicurarsi che il processo sia terminato
  Sleep 1000
  
  ; ✅ Crea shortcut per l'uninstaller nel menu Start
  CreateShortcut "$SMPROGRAMS\Inferno Console\Uninstall Inferno Console.lnk" "$INSTDIR\Uninstall Inferno Console.exe"
!macroend

!macro customUnInstall
  ; Termina il processo Inferno Console durante la disinstallazione
  nsExec::ExecToLog 'taskkill /IM "Inferno Console.exe" /T /F 2>nul'
  Pop $0
  Sleep 500
  
  ; ✅ Rimuovi TUTTE le directory di installazione (anche se vuote)
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  RMDir "$INSTDIR"
  
  ; ✅ Rimuovi anche la cartella parent se è vuota (es: "InfernoNuovo")
  ; Ottieni la directory parent
  ${GetParent} "$INSTDIR" $0
  ; Prova a rimuoverla solo se è vuota
  RMDir "$0"
!macroend
