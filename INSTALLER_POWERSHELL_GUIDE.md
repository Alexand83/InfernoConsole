# 🚀 Guida Installer PowerShell - Inferno Console

## 📋 Panoramica

Inferno Console ora utilizza installer PowerShell self-extracting per una distribuzione più robusta e compatibile con `electron-updater`.

## 📦 File Distribuiti

### Windows
- **`Inferno-Console-Installer.ps1`** - Installer principale
- **`Inferno-Console-Uninstaller.ps1`** - Uninstaller completo
- **`latest.yml`** - File di configurazione per auto-update

## 🛠️ Installazione

### Metodo 1: PowerShell (Raccomandato)
```powershell
# Scarica il file installer
# Esegui l'installer
powershell -ExecutionPolicy Bypass -File Inferno-Console-Installer.ps1
```

### Metodo 2: Doppio Click
1. Fai doppio click su `Inferno-Console-Installer.ps1`
2. Se richiesto, seleziona "Esegui con PowerShell"

## 🗑️ Disinstallazione

### Metodo 1: PowerShell
```powershell
powershell -ExecutionPolicy Bypass -File Inferno-Console-Uninstaller.ps1
```

### Metodo 2: Doppio Click
1. Fai doppio click su `Inferno-Console-Uninstaller.ps1`
2. Se richiesto, seleziona "Esegui con PowerShell"

## ✨ Funzionalità Installer

### Installer (`Inferno-Console-Installer.ps1`)
- ✅ Crea directory di installazione su Desktop
- ✅ Copia tutti i file dell'applicazione
- ✅ Crea shortcut desktop
- ✅ Crea shortcut Start Menu
- ✅ Opzione per avviare l'app dopo l'installazione
- ✅ Interfaccia utente chiara e informativa

### Uninstaller (`Inferno-Console-Uninstaller.ps1`)
- ✅ Termina processi in esecuzione
- ✅ Rimuove shortcut desktop
- ✅ Rimuove shortcut Start Menu
- ✅ Rimuove directory di installazione
- ✅ Pulizia completa del sistema

## 🔧 Configurazione Avanzata

### Directory di Installazione Personalizzata
```powershell
# Installa in una directory specifica
powershell -ExecutionPolicy Bypass -File Inferno-Console-Installer.ps1 -InstallDir "C:\Program Files\Inferno Console"
```

### Disinstallazione da Directory Specifica
```powershell
# Disinstalla da una directory specifica
powershell -ExecutionPolicy Bypass -File Inferno-Console-Uninstaller.ps1 -InstallDir "C:\Program Files\Inferno Console"
```

## 🚨 Risoluzione Problemi

### Errore "Execution Policy"
Se ricevi un errore di execution policy:
```powershell
# Imposta execution policy temporaneamente
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
# Poi esegui l'installer
.\Inferno-Console-Installer.ps1
```

### Errore "File Non Trovato"
Assicurati che:
1. Il file `win-unpacked` sia presente nella stessa directory
2. L'installer sia eseguito dalla directory corretta
3. I permessi di scrittura siano sufficienti

### Shortcut Non Creati
Se i shortcut non vengono creati:
1. Verifica i permessi di scrittura su Desktop e Start Menu
2. Esegui PowerShell come amministratore
3. Controlla che l'antivirus non blocchi la creazione dei shortcut

## 🔄 Integrazione con electron-updater

### Configurazione `latest.yml`
```yaml
version: v1.4.86
files:
  - url: Inferno-Console-Installer.ps1
    sha512: [hash]
    size: [size]
path: Inferno-Console-Installer.ps1
sha512: [hash]
releaseDate: '2025-01-02T21:42:00.000Z'
```

### Aggiornamento Automatico
L'installer PowerShell è completamente compatibile con `electron-updater`:
- ✅ Download automatico dell'installer
- ✅ Esecuzione automatica dell'installer
- ✅ Gestione degli aggiornamenti
- ✅ Rollback in caso di errori

## 📊 Vantaggi

### Rispetto agli Installer Batch
- ✅ **Più robusto**: Gestione errori avanzata
- ✅ **Più flessibile**: Parametri configurabili
- ✅ **Più sicuro**: Controllo permessi e validazione
- ✅ **Più informativo**: Logging dettagliato

### Rispetto agli Installer NSIS
- ✅ **Più semplice**: Nessuna dipendenza esterna
- ✅ **Più veloce**: Esecuzione diretta
- ✅ **Più compatibile**: Funziona su tutti i sistemi Windows
- ✅ **Più manutenibile**: Codice PowerShell leggibile

## 🎯 Best Practices

### Per Sviluppatori
1. **Testa sempre** l'installer su sistemi puliti
2. **Verifica** che tutti i file siano inclusi
3. **Controlla** che i shortcut funzionino correttamente
4. **Testa** l'uninstaller per pulizia completa

### Per Utenti
1. **Esegui sempre** l'uninstaller prima di reinstallare
2. **Chiudi** l'applicazione prima di disinstallare
3. **Backup** i tuoi dati prima di aggiornare
4. **Segnala** eventuali problemi agli sviluppatori

## 📞 Supporto

Per problemi o domande:
- 📧 Email: [supporto@infernoconsole.com]
- 🐛 Issues: [GitHub Issues]
- 📖 Documentazione: [Wiki del progetto]

---

**Inferno Console v1.4.86** - Sviluppato con ❤️ da Alessandro(NeverAgain)
