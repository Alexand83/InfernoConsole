# 🚀 GitHub Actions Workflow - Inferno Console

## 📋 Panoramica

Questo repository include un sistema completo di build e release automatizzato per **Inferno Console** con installer personalizzato.

## 🔄 Workflow Principale

### `build-and-release-simple.yml`

**Trigger:**
- Push su tag `v*` (es. `v1.4.104`)
- Workflow dispatch manuale

**Processo:**
1. **Build App Principale** - Crea `Inferno-Console-win.exe` (portable)
2. **Build Installer** - Crea `Inferno-Console-Installer.exe` (GUI personalizzato)
3. **Build Uninstaller** - Crea `Inferno-Console-Uninstaller.exe`
4. **Verifica File** - Controlla che tutti i file siano presenti e della dimensione corretta
5. **Crea Release** - Pubblica su GitHub con tutti gli asset

## 📦 Asset Release

Ogni release include:
- `Inferno-Console-Installer.exe` (~77MB) - Installer GUI professionale
- `Inferno-Console-Uninstaller.exe` (~66MB) - Uninstaller dedicato
- `Inferno-Console-win.exe` (~120MB) - App portable
- `latest.yml` - Metadati per electron-updater

## 🎯 Caratteristiche Installer

- **Interfaccia moderna** - Tema scuro NSIS-style
- **Navigazione sequenziale** - Solo bottoni Avanti/Indietro
- **Finestra ottimizzata** - 1300x1000 per log di installazione
- **Selezione directory** - Installa dove vuoi
- **Shortcut automatici** - Desktop e Start Menu
- **Log dettagliati** - Monitoraggio installazione
- **Blocco navigazione** - Durante installazione

## 🔄 Auto-Update

### `auto-update.yml`

**Trigger:**
- Schedule ogni 6 ore
- Workflow dispatch manuale

**Funzionalità:**
- Controlla aggiornamenti disponibili
- Notifica utenti automaticamente
- Integrato con electron-updater

## 🧪 Test Locale

Per testare il workflow completo:

```powershell
.\test-workflow.ps1
```

Questo script:
1. Builda l'app principale
2. Builda l'installer
3. Builda l'uninstaller
4. Verifica tutti i file
5. Lancia l'installer per test

## 🚀 Come Creare una Release

1. **Aggiorna versione** in `package.json`
2. **Commit e push** le modifiche
3. **Crea tag** con `git tag v1.4.104`
4. **Push tag** con `git push origin v1.4.104`
5. **GitHub Actions** eseguirà automaticamente il build e la release

## 📝 Note Tecniche

- **Node.js 18** - Versione supportata
- **Windows Latest** - Ambiente di build
- **Electron Builder** - Per packaging
- **PowerShell** - Per script di verifica
- **GitHub Releases API** - Per download dinamico

## 🔧 Configurazione

### Secrets Richiesti

- `GH_TOKEN` - Token GitHub per accesso API

### File di Configurazione

- `build/electron-builder-win.yml` - Configurazione build principale
- `installer/installer-builder.json` - Configurazione installer
- `installer/uninstaller-builder.json` - Configurazione uninstaller

## 📊 Monitoraggio

- **Build Status** - Visibile in GitHub Actions
- **Release Notes** - Generate automaticamente
- **File Size** - Verificati automaticamente
- **Error Handling** - Log dettagliati per debug

## 🎉 Risultato

Ogni release produce un installer professionale pronto per la distribuzione con:
- Interfaccia utente moderna
- Processo di installazione guidato
- Integrazione completa con electron-updater
- Supporto per percorsi di installazione personalizzati
