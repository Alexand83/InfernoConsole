; Custom NSIS script per DJ Console
; Questo file contiene configurazioni aggiuntive per l'installer Windows

!macro customHeader
  ; Header personalizzato per l'installer
  !define MUI_WELCOMEPAGE_TITLE "Benvenuto in DJ Console"
  !define MUI_WELCOMEPAGE_TEXT "Questo programma installerà DJ Console sul tuo computer.$\r$\n$\r$\nDJ Console è una console DJ professionale con interfaccia in stile RadioBoss.$\r$\n$\r$\nClicca Avanti per continuare."
  !define MUI_FINISHPAGE_TITLE "Installazione completata"
  !define MUI_FINISHPAGE_TEXT "DJ Console è stato installato con successo sul tuo computer.$\r$\n$\r$\nClicca Fine per completare l'installazione."
!macroend

!macro customInit
  ; Inizializzazioni personalizzate
  ; Verifica se è necessario installare Visual C++ Redistributable
  ; (se necessario per ffmpeg o altre dipendenze)
!macroend

!macro customInstall
  ; File aggiuntivi da installare
  ; Crea cartelle aggiuntive se necessario
  CreateDirectory "$INSTDIR\logs"
  CreateDirectory "$INSTDIR\audio"
!macroend

!macro customUnInstall
  ; Pulizia durante la disinstallazione
  RMDir /r "$INSTDIR\logs"
  RMDir /r "$INSTDIR\audio"
!macroend
