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
  ; ✅ Mostra dettagli SOLO se non è chiamato dall'installer (disinstallazione manuale)
  ; Se è chiamato dall'installer, rimane silenzioso
  ${If} ${Silent}
    SetDetailsView hide
  ${Else}
    SetDetailsView show
  ${EndIf}
  
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
  
  ; ✅ BEST PRACTICE NSIS: Cambia working directory prima di rimuovere $INSTDIR
  ; Questo evita problemi di lock e permette la rimozione corretta
  SetOutPath "$TEMP"
  
  ; ✅ Rimuovi sottocartelle specifiche (solo se vuote)
  RMDir "$INSTDIR\locales"
  RMDir "$INSTDIR\resources"
  RMDir "$INSTDIR\swiftshader"
  Sleep 200
  
  ; ✅ Rimuovi la directory principale (solo se vuota)
  RMDir "$INSTDIR"
  Sleep 200
  
  ; ✅ Rimuovi la cartella parent se è vuota
  ${If} ${FileExists} "$INSTDIR"
    ; Directory non rimossa completamente
  ${Else}
    ${un.GetParent} "$INSTDIR" $0
    RMDir "$0"
  ${EndIf}
  
  ; Disinstallazione completata
!macroend
