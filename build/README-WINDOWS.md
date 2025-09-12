# Build DJ Console per Windows

Questo documento spiega come compilare DJ Console per Windows utilizzando Electron.

## Prerequisiti

### Software richiesto
- **Node.js** (versione 18 o superiore) - [Download](https://nodejs.org/)
- **npm** (incluso con Node.js)
- **Git** (per clonare il repository)

### Verifica installazione
Apri PowerShell o Command Prompt e verifica:
```bash
node --version
npm --version
git --version
```

## Metodi di Build

### 1. Build Automatico (Raccomandato)

#### Opzione A: Script Batch
```bash
# Doppio click su:
build/build-windows.bat
```

#### Opzione B: Script PowerShell
```powershell
# Esegui in PowerShell:
.\build\build-windows.ps1

# Con opzioni:
.\build\build-windows.ps1 -Clean -Verbose
```

### 2. Build Manuale

#### Passo 1: Installazione dipendenze
```bash
npm install
```

#### Passo 2: Build React
```bash
npm run build
```

#### Passo 3: Build Electron per Windows
```bash
# Build completo (NSIS + Portable)
npm run build:win

# Solo installer NSIS
npm run dist:win:nsis

# Solo versione portable
npm run dist:win:portable

# Build con pulizia
npm run build:win:clean
```

## File di Output

Dopo il build, i file si trovano in `dist-electron/`:

- **DJ-Console-{version}-win-x64.exe** - Installer per Windows 64-bit
- **DJ-Console-{version}-win-ia32.exe** - Installer per Windows 32-bit
- **DJ-Console-{version}-win-x64-portable.exe** - Versione portable

## Configurazione

### File di Configurazione
- `build/electron-builder-win.yml` - Configurazione principale
- `build/installer.nsh` - Script NSIS personalizzato
- `build/win-config.js` - Configurazione JavaScript

### Personalizzazione
Puoi modificare:
- Nome dell'app in `build/electron-builder-win.yml`
- Icone in `build/icon.ico`
- Script di installazione in `build/installer.nsh`

## Risoluzione Problemi

### Errore: "electron-builder non trovato"
```bash
npm install -g electron-builder
```

### Errore: "ffmpeg non trovato"
```bash
npm install @ffmpeg-installer/ffmpeg
```

### Errore: "Build fallito"
1. Verifica che Node.js sia aggiornato
2. Cancella cache: `npm run clean`
3. Reinstalla dipendenze: `rm -rf node_modules && npm install`

### Errore: "Permessi insufficienti"
- Esegui PowerShell come Amministratore
- Verifica che l'antivirus non blocchi il processo

## Ottimizzazioni

### Compressione
- Il build utilizza compressione massima per ridurre la dimensione
- I file FFmpeg sono esclusi dalla compressione ASAR

### Architetture Supportate
- **x64** (64-bit) - Raccomandato per sistemi moderni
- **ia32** (32-bit) - Per compatibilità con sistemi legacy

## Distribuzione

### Installer NSIS
- Crea shortcut su Desktop e Start Menu
- Permette di scegliere directory di installazione
- Supporta disinstallazione completa

### Versione Portable
- Non richiede installazione
- Può essere eseguita da USB o cartella
- Non crea shortcut o registri di sistema

## Supporto

Per problemi o domande:
1. Controlla i log di build in `dist-electron/`
2. Verifica la configurazione in `build/`
3. Controlla le dipendenze con `npm list`

## Note Tecniche

- **Electron Version**: 28.2.0
- **Node.js Version**: 18+
- **Build Tool**: electron-builder 25.1.8
- **Compression**: ASAR con esclusioni per FFmpeg
- **Target**: Windows 7+ (x64/ia32)
