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
  
  ; ✅ SOLUZIONE DEFINITIVA: Usa PowerShell per rimozione forzata
  ; NSIS RMDir ha troppi bug, usiamo PowerShell che è più affidabile
  
  DetailPrint "Usando PowerShell per rimozione forzata..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path \"$INSTDIR\") { Remove-Item -Path \"$INSTDIR\" -Recurse -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500 }"'
  Pop $0
  
  ; Secondo tentativo se ancora presente
  ${If} ${FileExists} "$INSTDIR"
    DetailPrint "Directory ancora presente, secondo tentativo PowerShell..."
    Sleep 1000
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path \"$INSTDIR\") { Get-ChildItem -Path \"$INSTDIR\" -Recurse -Force | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue; Remove-Item -Path \"$INSTDIR\" -Force -ErrorAction SilentlyContinue }"'
    Pop $0
    Sleep 500
  ${EndIf}
  
  ; Verifica finale
  ${If} ${FileExists} "$INSTDIR"
    DetailPrint "ERRORE: Directory $INSTDIR non rimossa completamente"
  ${Else}
    DetailPrint "OK: Directory $INSTDIR rimossa con successo"
  ${EndIf}
  
  ; ✅ Rimuovi la cartella parent se è vuota (con PowerShell)
  ${un.GetParent} "$INSTDIR" $0
  DetailPrint "Tentativo rimozione parent: $0"
  
  ; Usa PowerShell per rimuovere parent solo se vuota
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path \"$0\") { if ((Get-ChildItem -Path \"$0\" -Force | Measure-Object).Count -eq 0) { Remove-Item -Path \"$0\" -Force -ErrorAction SilentlyContinue } }"'
  Pop $0
  Sleep 500
  
  ; Verifica finale parent
  ${un.GetParent} "$INSTDIR" $0
  ${If} ${FileExists} "$0"
    DetailPrint "AVVISO: Parent $0 non rimossa (potrebbe contenere altri file)"
    StrCpy $1 "AVVISO: Cartella parent non rimossa (contiene altri file)"
  ${Else}
    DetailPrint "OK: Parent $0 rimossa con successo"
    StrCpy $1 "OK: Tutte le cartelle rimosse"
  ${EndIf}
  
  ; ✅ Mostra riepilogo finale con pausa
  Sleep 1000
  MessageBox MB_OK|MB_ICONINFORMATION "Disinstallazione completata!$\n$\nDirectory: $INSTDIR$\nParent: $0$\n$\n$1"
!macroend
