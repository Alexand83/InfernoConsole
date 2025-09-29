# Sistema Shortcut per App Portabili

## 🎯 Problema Risolto

Le app Electron portabili (creates con `electron-builder --win portable`) si comportano in modo diverso dalle app installate:

1. **App Installata**: L'exe è in `C:\Users\...\AppData\Local\Programs\Inferno Console\Inferno Console.exe`
2. **App Portabile**: L'exe si estrae temporaneamente in `C:\Users\...\AppData\Local\Temp\...\Inferno Console.exe`

## 🔧 Soluzione Implementata

### 1. **Rimozione Path Info**
- ❌ Rimosso il display del percorso dell'app nelle impostazioni
- ❌ Rimosso l'API `getAppPath` 
- ✅ Le app portabili non mostrano percorsi interni

### 2. **Shortcut Intelligente**
Il sistema ora crea shortcut che puntano al **file portabile originale**, non a quello estratto:

```javascript
// ✅ CORRETTO: Punto al file portabile originale
const exePath = process.execPath // File portabile originale
const portableDir = path.dirname(exePath) // Cartella del file portabile

shortcut.create(desktopPath, {
  target: exePath,           // File portabile originale
  desc: 'Inferno Console - DJ Software',
  icon: exePath,             // Icona dal file portabile
  workingDir: portableDir    // Cartella del file portabile
})
```

### 3. **Creazione Automatica**
Lo shortcut viene creato automaticamente in 3 momenti:

1. **All'avvio** (solo se non esiste)
2. **Dopo download update** (`update-downloaded`)
3. **Dopo installazione update** (`update-installed`)

## 🎵 Vantaggi

- ✅ **Shortcut funzionante**: Punta sempre al file portabile originale
- ✅ **Aggiornamento automatico**: Si ricrea ad ogni update
- ✅ **Compatibilità**: Funziona con versioni vecchie che si aggiornano
- ✅ **Pulizia UI**: Nessun percorso interno mostrato all'utente

## 🔍 Debug

Per verificare che funzioni:

1. **Controlla i log**:
   ```
   🔗 [SHORTCUT] Target (portatile): C:\path\to\Inferno Console.exe
   ✅ [SHORTCUT] Shortcut portabile creato all'avvio!
   ```

2. **Verifica lo shortcut**:
   - Proprietà → Destinazione deve puntare al file `.exe` portabile
   - Proprietà → Cartella iniziale deve essere la cartella del file portabile

## 📁 File Modificati

- `electron/main.js`: Sistema shortcut portabile
- `src/components/Settings.tsx`: Rimosso display path
- `electron/preload.js`: Rimosso API getAppPath
- `src/types/global.d.ts`: Rimosso tipo getAppPath

## 🚀 Risultato

L'app portabile ora crea shortcut funzionanti che:
- Puntano al file portabile originale
- Si aggiornano automaticamente
- Non mostrano percorsi interni all'utente
- Funzionano anche per aggiornamenti da versioni vecchie