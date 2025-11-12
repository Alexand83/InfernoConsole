# Guida Auto-Update con Installer NSIS

## 🎯 Panoramica

L'auto-updater di Inferno Console è stato modificato per usare l'installer NSIS invece del file `.exe` diretto. Questo garantisce:

- ✅ **Aggiornamenti nella stessa directory** (rileva installazione esistente)
- ✅ **Chiusura automatica** dell'app prima dell'update
- ✅ **Installazione silenziosa** (modalità `/S`)
- ✅ **Shortcuts mantenuti** (Desktop + Start Menu)
- ✅ **Dati utente preservati**

## 📦 Come Funziona

### 1. Rilevamento Aggiornamento

L'auto-updater cerca file con questi nomi (in ordine di priorità):

1. `Inferno-Console-Setup.exe` (installer NSIS)
2. `Inferno-Console-Installer.exe` (installer NSIS alternativo)
3. Qualsiasi file `.exe` (fallback)

```javascript:109:130:electron/updater.js
if (process.platform === 'win32') {
  // Windows: cerca PRIMA l'installer NSIS, poi fallback su .exe
  selectedFile = info.files.find(file => 
    file.url && (
      file.url.includes('Setup.exe') ||
      file.url.includes('Installer.exe') ||
      file.url.includes('setup') ||
      file.url.includes('installer')
    )
  )
  
  // Fallback: cerca file .exe, .msi, o qualsiasi file Windows
  if (!selectedFile) {
    selectedFile = info.files.find(file => 
      file.url && (
        file.url.includes('.exe') || 
        file.url.includes('.msi') ||
        file.url.includes('win') ||
        file.url.includes('windows')
      )
    )
  }
}
```

### 2. Download

L'utente clicca "Scarica" nella notifica di aggiornamento:
- L'installer NSIS viene scaricato in `%USERPROFILE%\Desktop\Inferno Console\Updates\`
- Progress bar mostra l'avanzamento

### 3. Installazione

L'utente clicca "Installa e Riavvia":
- L'app rileva se è un installer NSIS
- Esegue l'installer con flag `/S` (modalità silenziosa)
- L'app si chiude automaticamente
- L'installer NSIS:
  1. Rileva la directory di installazione esistente dal registro
  2. Chiude eventuali processi `Inferno Console.exe` ancora attivi
  3. Sovrascrive i file nella stessa directory
  4. Mantiene shortcuts e configurazioni
  5. Riavvia l'app automaticamente

```javascript:1062:1138:electron/main.js
ipcMain.handle('install-update', async () => {
  try {
    const { spawn } = require('child_process')
    const path = require('path')
    const os = require('os')
    const fs = require('fs')
    
    // Cerca l'installer scaricato (NSIS Setup o vecchio installer)
    const updateDir = updater.customUpdateDir
    let installerPath = null
    let isNSISInstaller = false
    
    // Cerca prima l'installer NSIS
    const nsisFiles = ['Inferno-Console-Setup.exe', 'Inferno-Console-Installer.exe']
    for (const filename of nsisFiles) {
      const testPath = path.join(updateDir, filename)
      if (fs.existsSync(testPath)) {
        installerPath = testPath
        isNSISInstaller = true
        console.log(`✅ [INSTALL] Trovato installer NSIS: ${filename}`)
        break
      }
    }
    
    // ✅ NUOVO: Se è NSIS, esegui in modalità silenziosa con /S
    const args = isNSISInstaller ? ['/S'] : []
    
    // Esegui l'installer
    const installer = spawn(installerPath, args, {
      detached: true,
      stdio: 'ignore'
    })
    
    installer.unref()
    
    // Chiudi l'app dopo 2 secondi
    setTimeout(() => {
      console.log('👋 [INSTALL] Chiusura app per permettere l\'aggiornamento...')
      app.quit()
    }, 2000)
    
    return { 
      success: true, 
      message: isNSISInstaller 
        ? 'Installer NSIS avviato in modalità silenziosa. L\'app si aggiornerà automaticamente.' 
        : 'Installer avviato, l\'app si chiuderà tra 2 secondi',
      isNSIS: isNSISInstaller
    }
  } catch (error) {
    console.error('Errore nell\'installazione aggiornamento:', error)
    throw error
  }
})
```

## 🚀 Pubblicare un Aggiornamento

### Step 1: Build dell'Installer NSIS

```bash
# Compila l'installer
node scripts/build-nsis-installer.js

# Output: dist/Inferno-Console-Setup.exe (~130 MB)
```

### Step 2: Crea Release su GitHub

```bash
# 1. Aggiorna versione in package.json
npm version patch  # o minor, o major

# 2. Commit e push
git add package.json
git commit -m "chore: bump version to 1.4.151"
git push

# 3. Crea tag
git tag v1.4.151
git push origin v1.4.151
```

### Step 3: Upload su GitHub Releases

1. Vai su: https://github.com/Alexand83/InfernoConsole/releases/new
2. Seleziona il tag: `v1.4.151`
3. Titolo: `v1.4.151 - Descrizione aggiornamento`
4. Descrizione:
   ```markdown
   ## 🎉 Novità
   - Feature 1
   - Feature 2
   
   ## 🐛 Bug Fix
   - Fix 1
   - Fix 2
   
   ## 📦 Installazione
   Scarica `Inferno-Console-Setup.exe` per l'installazione completa.
   ```
5. **IMPORTANTE**: Carica il file con nome **esatto**:
   - `Inferno-Console-Setup.exe` (preferito)
   - Oppure `Inferno-Console-Installer.exe`
6. Pubblica la release

### Step 4: Verifica Auto-Update

L'auto-updater controllerà automaticamente ogni 5 secondi dopo l'avvio:

```javascript
// electron/updater.js
setTimeout(() => {
  this.checkForUpdates()
}, 5000) // Aspetta 5 secondi dopo l'avvio
```

## 🔧 Configurazione

### Modificare Directory di Download

Nel `package.json`:

```json
{
  "updater": {
    "downloadPath": "%USERPROFILE%\\Desktop\\Inferno Console\\Updates",
    "installPath": "%USERPROFILE%\\Desktop\\Inferno Console"
  }
}
```

### Modificare Frequenza Controllo

In `electron/updater.js`:

```javascript
// Cambia il timeout (in millisecondi)
setTimeout(() => {
  this.checkForUpdates()
}, 5000) // 5 secondi
```

## 🎨 Personalizzazione Installer NSIS

### Modificare Testi

In `installer/inferno-console.nsi`:

```nsis
!define MUI_WELCOMEPAGE_TEXT "Testo personalizzato..."
!define MUI_FINISHPAGE_RUN_TEXT "Avvia l'applicazione"
```

### Aggiungere File Extra

```nsis
Section "Installazione" SecInstall
  ; ... codice esistente ...
  
  ; Aggiungi file extra
  File "README.md"
  File "LICENSE"
SectionEnd
```

### Modalità Silenziosa Personalizzata

L'installer supporta questi parametri:

```bash
# Installazione silenziosa (nessuna UI)
Inferno-Console-Setup.exe /S

# Installazione silenziosa + directory custom
Inferno-Console-Setup.exe /S /D=C:\Custom\Path

# Installazione normale (con UI)
Inferno-Console-Setup.exe
```

## 📊 Flusso Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. App Avviata                                              │
│    └─> Auto-updater controlla GitHub ogni 5 secondi        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Aggiornamento Rilevato                                   │
│    └─> Notifica: "Aggiornamento disponibile v1.4.151"      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Utente Clicca "Scarica"                                  │
│    └─> Download: Inferno-Console-Setup.exe (~130 MB)       │
│    └─> Progress bar: 0% → 100%                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Download Completato                                      │
│    └─> Notifica: "Download completato!"                    │
│    └─> Bottone: "Installa e Riavvia"                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Utente Clicca "Installa e Riavvia"                      │
│    └─> App rileva installer NSIS                           │
│    └─> Esegue: Inferno-Console-Setup.exe /S                │
│    └─> App si chiude dopo 2 secondi                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Installer NSIS (Modalità Silenziosa)                    │
│    ├─> Legge registro: InstallPath esistente               │
│    ├─> Chiude processi: Inferno Console.exe                │
│    ├─> Sovrascrive file nella stessa directory             │
│    ├─> Mantiene shortcuts e configurazioni                 │
│    └─> Riavvia app automaticamente                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. App Aggiornata                                           │
│    └─> Versione: v1.4.151                                  │
│    └─> Stessa directory di prima                           │
│    └─> Tutti i dati preservati                             │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Troubleshooting

### Problema: "Installer non trovato"

**Causa**: Nome file errato su GitHub Releases

**Soluzione**: Assicurati che il file si chiami esattamente:
- `Inferno-Console-Setup.exe` (preferito)
- Oppure `Inferno-Console-Installer.exe`

### Problema: "App non si chiude"

**Causa**: Processi bloccati

**Soluzione**: L'installer NSIS chiude automaticamente con `taskkill /F`

### Problema: "Installazione in directory diversa"

**Causa**: Registro non trovato

**Soluzione**: L'installer NSIS legge da `HKCU\Software\Inferno Console\InstallPath`

Verifica con:
```powershell
reg query "HKCU\Software\Inferno Console" /v InstallPath
```

### Problema: "Auto-updater non rileva aggiornamento"

**Causa**: Versione non incrementata

**Soluzione**: Assicurati che `package.json` abbia versione > corrente

```bash
# Incrementa versione
npm version patch

# Verifica
node -e "console.log(require('./package.json').version)"
```

## 📝 Checklist Release

- [ ] Build installer NSIS: `node scripts/build-nsis-installer.js`
- [ ] Incrementa versione: `npm version patch`
- [ ] Commit: `git commit -m "chore: bump version"`
- [ ] Push: `git push`
- [ ] Crea tag: `git tag v1.4.151 && git push origin v1.4.151`
- [ ] Crea release su GitHub
- [ ] Upload `Inferno-Console-Setup.exe`
- [ ] Pubblica release
- [ ] Testa auto-update su app installata

## 🎯 Best Practices

1. **Naming Convention**: Usa sempre `Inferno-Console-Setup.exe`
2. **Versioning**: Segui Semantic Versioning (MAJOR.MINOR.PATCH)
3. **Testing**: Testa sempre su installazione pulita + aggiornamento
4. **Changelog**: Documenta tutte le modifiche nella release
5. **Backup**: L'installer NSIS non fa backup, gli utenti dovrebbero farlo

## 🔗 Link Utili

- [NSIS Documentation](https://nsis.sourceforge.io/Docs/)
- [Electron Updater](https://www.electron.build/auto-update)
- [Semantic Versioning](https://semver.org/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)

