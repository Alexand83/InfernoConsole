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
!macroend

!macro customFinish
  ; ✅ Crea shortcut per l'uninstaller nel menu Start (dopo che NSIS ha creato la cartella)
  CreateShortcut "$SMPROGRAMS\Inferno Console\Uninstall Inferno Console.lnk" "$INSTDIR\Uninstall Inferno Console.exe"
!macroend

!macro customUnInstall
  ; Termina il processo Inferno Console durante la disinstallazione
  nsExec::ExecToLog 'taskkill /IM "Inferno Console.exe" /T /F 2>nul'
  Pop $0
  Sleep 500
!macroend

!macro customRemoveFiles
  ; ✅ Questa macro viene eseguita DOPO la rimozione dei file da parte di NSIS
  ; Rimuovi TUTTE le sottocartelle rimaste
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  
  ; Rimuovi la directory principale
  RMDir "$INSTDIR"
  
  ; ✅ Rimuovi anche la cartella parent se è vuota (es: "InfernoNuovo")
  ${GetParent} "$INSTDIR" $0
  RMDir "$0"
!macroend
