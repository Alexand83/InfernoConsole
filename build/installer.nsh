; Script NSIS personalizzato per DJ Console
; Gestisce la chiusura automatica dell'app durante l'installazione

!macro preInit
  ; Termina automaticamente tutti i processi DJ Console/Electron
  nsExec::ExecToLog 'taskkill /f /im "DJ Console.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /f /im "electron.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /f /im "node.exe"'
  Pop $0
  
  ; Aspetta un momento per assicurarsi che i processi siano terminati
  Sleep 2000
!macroend

!macro customInstall
  ; Termina tutti i processi DJ Console/Electron se sono in esecuzione
  nsExec::ExecToLog 'taskkill /f /im "DJ Console.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /f /im "electron.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /f /im "node.exe"'
  Pop $0
  
  ; Controlla se ci sono file bloccati
  nsExec::ExecToLog 'handle.exe -p "DJ Console.exe"'
  Pop $0
  StrCmp $0 0 +2
    Sleep 3000
  
  Sleep 2000
!macroend

!macro customUnInstall
  ; Termina il processo DJ Console durante la disinstallazione
  nsExec::ExecToLog 'taskkill /f /im "DJ Console.exe"'
  Pop $0
  Sleep 1000
!macroend