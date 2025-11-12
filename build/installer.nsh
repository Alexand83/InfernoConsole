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
  
  ; ✅ Crea shortcut per l'uninstaller nel menu Start
  CreateDirectory "$SMPROGRAMS\Inferno Console"
  CreateShortcut "$SMPROGRAMS\Inferno Console\Uninstall Inferno Console.lnk" "$INSTDIR\Uninstall Inferno Console.exe"
!macroend

!macro customUnInstall
  ; Termina il processo Inferno Console durante la disinstallazione
  nsExec::ExecToLog 'taskkill /IM "Inferno Console.exe" /T /F 2>nul'
  Pop $0
  Sleep 500
  
  ; ✅ Rimuovi shortcut uninstaller dal menu Start
  Delete "$SMPROGRAMS\Inferno Console\Uninstall Inferno Console.lnk"
  
  ; ✅ Rimuovi TUTTE le sottocartelle
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  
  ; ✅ Rimuovi la directory principale
  RMDir "$INSTDIR"
  
  ; ✅ Rimuovi la cartella parent se è vuota (metodo semplice)
  ; Ottieni il path parent rimuovendo l'ultimo componente
  StrCpy $0 "$INSTDIR"
  
  ; Trova l'ultimo backslash
  ${un.GetParent} "$0" $1
  
  ; Prova a rimuovere la directory parent (solo se vuota)
  RMDir "$1"
!macroend
