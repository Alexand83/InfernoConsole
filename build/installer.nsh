; Script NSIS personalizzato per Inferno Console
; Gestisce la chiusura automatica dell'app durante l'installazione

; Include funzioni per manipolazione path
!include "FileFunc.nsh"
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
  
  ; ✅ Rimuovi TUTTA la directory di installazione con /r (ricorsivo)
  RMDir /r "$INSTDIR"
  
  ; ✅ Rimuovi la cartella parent se è vuota
  ${un.GetParent} "$INSTDIR" $0
  RMDir "$0"
!macroend
