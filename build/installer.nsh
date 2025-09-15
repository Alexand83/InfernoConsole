; Script NSIS personalizzato per DJ Console
; Gestisce la chiusura automatica dell'app durante l'installazione

!macro preInit
  ; Controlla se DJ Console è in esecuzione
  nsExec::ExecToLog 'tasklist /fi "imagename eq DJ Console.exe"'
  Pop $0
  StrCmp $0 0 +3
    MessageBox MB_OK|MB_ICONEXCLAMATION "DJ Console è in esecuzione. Chiudilo prima di continuare."
    Abort
  
  ; Controlla anche processi electron nascosti
  nsExec::ExecToLog 'tasklist /fi "imagename eq electron.exe"'
  Pop $0
  StrCmp $0 0 +3
    MessageBox MB_OK|MB_ICONEXCLAMATION "Processi Electron attivi rilevati. Chiudili prima di continuare."
    Abort
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