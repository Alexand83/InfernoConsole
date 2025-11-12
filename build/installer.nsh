; Script NSIS personalizzato per Inferno Console
; Gestisce la chiusura automatica dell'app durante l'installazione

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
  
  ; ✅ Rimuovi la directory principale (dopo che NSIS ha rimosso i file)
  RMDir "$INSTDIR"
  
  ; ✅ Rimuovi la cartella parent se è vuota
  Push "$INSTDIR"
  Call un.GetParent
  Pop $0
  RMDir "$0"
!macroend

; Funzione per ottenere la directory parent
Function un.GetParent
  Exch $0
  Push $1
  Push $2
  
  StrCpy $1 $0 1 -1
  StrCmp $1 "\" 0 +3
    StrCpy $0 $0 -1
    Goto -3
  
  StrCpy $2 $0 1 -1
  StrCmp $2 "\" 0 +3
    StrCpy $0 $0 -1
    Goto -3
  
  StrCpy $1 0
  IntOp $1 $1 - 1
  StrCpy $2 $0 1 $1
  StrCmp $2 "" end
  StrCmp $2 "\" 0 -3
  StrCpy $0 $0 $1
  
  end:
  Pop $2
  Pop $1
  Exch $0
FunctionEnd
