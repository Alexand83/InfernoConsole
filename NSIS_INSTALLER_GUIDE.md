# Inferno Console - Guida NSIS Installer

## 📋 Prerequisiti

### 1. Installare NSIS
- Scarica NSIS da: https://nsis.sourceforge.io/Download
- Installa nella directory predefinita: `C:\Program Files (x86)\NSIS\`
- Oppure imposta la variabile d'ambiente `NSIS_PATH` con il percorso personalizzato

### 2. Verificare Node.js
```bash
node --version
```

## 🚀 Build dell'Installer

### Metodo 1: Script Automatico (Consigliato)
```bash
# Windows
scripts\build-nsis-installer.bat

# Oppure direttamente con Node
node scripts/build-nsis-installer.js
```

### Metodo 2: Manuale
```bash
# 1. Scarica/copia l'exe in dist-electron/
# 2. Compila con NSIS
"C:\Program Files (x86)\NSIS\makensis.exe" installer\inferno-console.nsi
```

## 📦 Output

L'installer verrà creato in:
```
dist/Inferno-Console-Setup.exe
```

## ✨ Caratteristiche dell'Installer

### Durante l'Installazione
- ✅ **Chiusura automatica** dell'app se in esecuzione
- ✅ **Rilevamento installazione esistente** (aggiornamento)
- ✅ **Scelta directory** di installazione
- ✅ **Creazione shortcuts** (Desktop + Start Menu)
- ✅ **Registrazione** in Add/Remove Programs
- ✅ **Progress bar** dettagliata

### Uninstaller
- ✅ **Chiusura automatica** dell'app prima della disinstallazione
- ✅ **Rimozione completa** di tutti i file
- ✅ **Pulizia registro** di sistema
- ✅ **Rimozione shortcuts**
- ✅ **Conferma** prima della disinstallazione

## 🔧 Personalizzazione

### Modificare la Versione
La versione viene letta automaticamente da `package.json`:
```json
{
  "version": "1.4.139"
}
```

### Modificare l'Icona
Sostituisci il file:
```
installer/assets/icon.ico
```

### Modificare i Testi
Modifica il file:
```
installer/inferno-console.nsi
```

Cerca le sezioni:
- `!define MUI_WELCOMEPAGE_TEXT` - Testo pagina benvenuto
- `!define MUI_FINISHPAGE_RUN_TEXT` - Testo bottone avvio
- Etc.

## 🛠️ Troubleshooting

### Errore: "NSIS non trovato"
```bash
# Imposta la variabile d'ambiente
set NSIS_PATH=C:\Percorso\Personalizzato\NSIS\makensis.exe
```

### Errore: "File non trovato"
Verifica che esista:
```
dist-electron/Inferno-Console-win.exe
```

### Errore: "Installer già in esecuzione"
- Chiudi eventuali installer aperti
- Termina il processo `Inferno-Console-Setup.exe` dal Task Manager

## 📝 Note Importanti

### Sicurezza
- L'installer **NON richiede privilegi di amministratore**
- Installa in `%LOCALAPPDATA%\Inferno Console` (user-writable)
- Registra solo in `HKCU` (non `HKLM`)

### Chiusura App
L'installer chiude automaticamente l'app con:
1. **Tentativo gentile**: `taskkill /IM "Inferno Console.exe" /T`
2. **Attesa**: 2 secondi
3. **Chiusura forzata** (se necessario): `taskkill /F /IM "Inferno Console.exe" /T`

### Aggiornamenti
- L'installer **rileva automaticamente** installazioni esistenti
- Propone la stessa directory per aggiornamenti
- Sovrascrive i file esistenti mantenendo i dati utente

## 🎯 Comandi NPM

Aggiungi al `package.json`:
```json
{
  "scripts": {
    "build:nsis": "node scripts/build-nsis-installer.js",
    "build:installer": "npm run build:nsis"
  }
}
```

Poi esegui:
```bash
npm run build:nsis
```

## 📊 Dimensioni

- **Installer compresso**: ~80-120 MB (dipende dall'app)
- **Installazione completa**: ~150-200 MB
- **Compressione**: LZMA (massima)

## 🔗 Link Utili

- NSIS Documentation: https://nsis.sourceforge.io/Docs/
- Modern UI 2: https://nsis.sourceforge.io/Docs/Modern%20UI%202/Readme.html
- NSIS Examples: https://nsis.sourceforge.io/Category:Code_Examples

## ⚡ Build Veloce

Per build rapidi durante lo sviluppo:
```bash
# Usa build locale invece di scaricare da GitHub
copy dist\Inferno-Console-win.exe dist-electron\
node scripts/build-nsis-installer.js
```

## 🎨 Personalizzazione Avanzata

### Aggiungere Pagine Custom
Modifica `inferno-console.nsi`:
```nsis
!insertmacro MUI_PAGE_CUSTOM MyCustomPage
```

### Aggiungere File Extra
```nsis
Section "Installazione" SecInstall
  ; ... codice esistente ...
  
  ; Aggiungi file extra
  File "README.md"
  File "LICENSE"
  
  ; Crea sottocartelle
  SetOutPath "$INSTDIR\resources"
  File /r "resources\*.*"
SectionEnd
```

### Multi-lingua
L'installer supporta già Italiano e Inglese. Per aggiungere altre lingue:
```nsis
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "German"
```

## 🚨 Problemi Comuni

### 1. App non si chiude
**Soluzione**: Verifica che il nome del processo sia corretto:
```nsis
!define EXENAME "Inferno Console.exe"
```

### 2. Shortcuts non funzionano
**Soluzione**: Verifica i percorsi nel registro:
```
HKCU\Software\Inferno Console\InstallPath
```

### 3. Uninstaller non rimuove tutto
**Soluzione**: Aggiungi i file mancanti nella sezione `Uninstall`:
```nsis
Delete "$INSTDIR\tuofile.ext"
```

## 📞 Supporto

Per problemi o domande:
- GitHub Issues: https://github.com/Alexand83/InfernoConsole/issues
- Documentazione NSIS: https://nsis.sourceforge.io/Main_Page

