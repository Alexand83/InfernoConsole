; Script NSIS personalizzato per Inferno Console
; Gestisce la chiusura automatica dell'app durante l'installazione

!macro preInit
  ; Termina automaticamente tutti i processi Inferno Console/Electron
  nsExec::ExecToLog 'taskkill /f /im "Inferno Console.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /f /im "electron.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /f /im "node.exe"'
  Pop $0
  
  ; Aspetta un momento per assicurarsi che i processi siano terminati
  Sleep 2000
!macroend

!macro customInstall
  ; Termina tutti i processi Inferno Console/Electron se sono in esecuzione
  nsExec::ExecToLog 'taskkill /f /im "Inferno Console.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /f /im "electron.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /f /im "node.exe"'
  Pop $0
  
  ; Aspetta un momento per assicurarsi che i processi siano terminati
  Sleep 2000
!macroend

!macro customUnInstall
  ; Termina il processo Inferno Console durante la disinstallazione
  nsExec::ExecToLog 'taskkill /f /im "Inferno Console.exe"'
  Pop $0
  Sleep 1000
!macroend
