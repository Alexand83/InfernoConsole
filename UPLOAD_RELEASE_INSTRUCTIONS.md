# 📦 Istruzioni Upload Release v1.4.151

## 🚀 Step da Seguire

### 1. Vai su GitHub Releases
```
https://github.com/Alexand83/InfernoConsole/releases/new
```

### 2. Configura Release

**Tag**: `v1.4.151` (seleziona dal dropdown)

**Titolo**: `v1.4.151 - Auto-Update NSIS Integration`

**Descrizione**:
```markdown
## 🎉 Novità v1.4.151

### ✨ Caratteristiche Principali
- ✅ **Installer NSIS** integrato con auto-updater
- ✅ **Aggiornamenti automatici** nella stessa directory
- ✅ **Installazione silenziosa** (modalità `/S`)
- ✅ **Chiusura automatica** dell'app prima dell'update
- ✅ **Shortcuts preservati** (Desktop + Start Menu)

### 🔧 Miglioramenti Tecnici
- Ottimizzazione memoria durante import massivi (cleanup ogni 50 file)
- Fix durata brani in File Manager (analisi audio robusta)
- Fix connessione DJ Remoto (ngrok WebSocket)
- DevTools shortcuts (F12, Ctrl+Shift+I)

### 📦 Installazione
Scarica `Inferno-Console-Setup.exe` per l'installazione completa con auto-updater.

### 🔄 Aggiornamento
Se hai già installato una versione precedente, l'app rileverà automaticamente questo aggiornamento e lo installerà nella stessa directory.

---

**Dimensione**: ~127 MB (compresso LZMA)  
**Compatibilità**: Windows 7+  
**Tipo**: Installer NSIS con auto-updater
```

### 3. Upload File

**IMPORTANTE**: Carica **SOLO** questo file:

```
📁 File da caricare:
   dist/Inferno-Console-Setup.exe  (~127 MB)
```

**NON caricare**:
- ❌ Inferno-Console-win.exe (portable - non serve per auto-update)
- ❌ Altri file installer vecchi

### 4. Pubblica

- [ ] Deseleziona "Set as a pre-release"
- [ ] Deseleziona "Set as the latest release" (se vuoi)
- [ ] Click "Publish release"

---

## ✅ Verifica

Dopo la pubblicazione, verifica che:

1. Release visibile su: `https://github.com/Alexand83/InfernoConsole/releases`
2. File presente: `Inferno-Console-Setup.exe`
3. Dimensione corretta: ~127 MB

---

## 🧪 Test Auto-Update

Dopo il caricamento:

1. Riavvia l'app v1.4.150
2. Aspetta 5 secondi
3. Dovresti vedere notifica: "Aggiornamento disponibile v1.4.151"
4. Click "Scarica" → Download installer NSIS
5. Click "Installa e Riavvia" → App si aggiorna nella stessa directory

---

## 📝 File Location

Il file da caricare si trova qui:
```
C:\djconsole\dist\Inferno-Console-Setup.exe
```

