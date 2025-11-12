; Script NSIS personalizzato per Inferno Console
; Gestisce la chiusura automatica dell'app durante l'installazione

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

!macro customUnInstall
  ; Termina il processo Inferno Console durante la disinstallazione
  nsExec::ExecToLog 'taskkill /IM "Inferno Console.exe" /T /F 2>nul'
  Pop $0
  Sleep 500
!macroend
