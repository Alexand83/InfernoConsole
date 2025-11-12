# 🧪 Test Auto-Update con Installer NSIS

## 📋 Piano di Test

### Prerequisiti
- ✅ Build versione portable completato
- ✅ Installer NSIS creato
- ⏳ Versione incrementata per simulazione

## 🎯 Scenario di Test

### **Situazione Iniziale**
```
Versione Installata: 1.4.150
Versione Nuova: 1.4.151 (simulata)
```

### **Obiettivo**
Verificare che l'auto-update:
1. Rileva la nuova versione
2. Scarica l'installer NSIS
3. Installa nella STESSA directory
4. Chiude e riavvia l'app automaticamente

---

## 📝 Step di Test

### **STEP 1: Installa Versione Corrente (1.4.150)**

```bash
# Esegui l'installer NSIS corrente
dist\Inferno-Console-Setup.exe
```

**Verifica**:
- [ ] App installata in: `%LOCALAPPDATA%\Inferno Console\`
- [ ] Shortcut Desktop creato
- [ ] Shortcut Start Menu creato
- [ ] Registro: `HKCU\Software\Inferno Console\InstallPath`
- [ ] Versione: 1.4.150

**Comando verifica**:
```powershell
# Verifica installazione
reg query "HKCU\Software\Inferno Console" /v InstallPath
reg query "HKCU\Software\Inferno Console" /v Version

# Verifica file
dir "%LOCALAPPDATA%\Inferno Console"
```

---

### **STEP 2: Incrementa Versione (Simula Nuova Release)**

```bash
# Incrementa versione a 1.4.151
npm version patch

# Rebuild portable
npm run dist:win:portable

# Rebuild installer NSIS
node scripts/build-nsis-installer.js
```

**Output Atteso**:
```
dist/
  ├─ Inferno-Console-win.exe (v1.4.151)
  └─ Inferno-Console-Setup.exe (v1.4.151)
```

---

### **STEP 3: Simula Release su GitHub**

**Opzione A: Crea Release Locale (Test Rapido)**

Crea file `dev-app-update.yml` per puntare a file locali:

```yaml
# electron/dev-app-update.yml
provider: generic
url: http://localhost:8080/releases
```

Avvia server locale:
```bash
# In una nuova finestra
cd dist
python -m http.server 8080
```

**Opzione B: Crea Release GitHub (Test Reale)**

```bash
# Crea tag
git tag v1.4.151
git push origin v1.4.151

# Vai su GitHub Releases
# Upload: Inferno-Console-Setup.exe
```

---

### **STEP 4: Avvia App e Testa Auto-Update**

```bash
# Avvia l'app installata (v1.4.150)
"%LOCALAPPDATA%\Inferno Console\Inferno Console.exe"
```

**Cosa Osservare**:

#### **T+5s**: Controllo Aggiornamento
```
Console log:
🔍 Controllo aggiornamenti...
📦 Aggiornamento disponibile: 1.4.151
```

**Verifica UI**:
- [ ] Notifica popup appare in alto a destra
- [ ] Testo: "Aggiornamento disponibile"
- [ ] Versione: "1.4.151"
- [ ] Dimensione: "~130 MB"
- [ ] Bottone: "Scarica"

---

#### **T+10s**: Click "Scarica"

**Verifica**:
- [ ] Progress bar appare
- [ ] Percentuale: 0% → 100%
- [ ] File scaricato in: `%USERPROFILE%\Desktop\Inferno Console\Updates\`

**Comando verifica**:
```powershell
dir "%USERPROFILE%\Desktop\Inferno Console\Updates"
# Deve contenere: Inferno-Console-Setup.exe
```

**Console log**:
```
📥 Download in corso...
✅ Download completato!
```

---

#### **T+60s**: Download Completato

**Verifica UI**:
- [ ] Notifica cambia
- [ ] Testo: "Download completato!"
- [ ] Bottone: "Installa e Riavvia"
- [ ] Icona: ✅ (verde)

---

#### **T+65s**: Click "Installa e Riavvia"

**Console log**:
```
🚀 [INSTALL] Esecuzione installer: C:\...\Updates\Inferno-Console-Setup.exe
📦 [INSTALL] Tipo: NSIS (modalità silenziosa)
✅ [INSTALL] Trovato installer NSIS: Inferno-Console-Setup.exe
```

**Verifica**:
- [ ] App si chiude dopo 2 secondi
- [ ] Installer NSIS si avvia (nessuna UI visibile)

---

#### **T+70s**: Installer NSIS Lavora

**Verifica Background**:
```powershell
# In un'altra finestra PowerShell
tasklist | findstr "Inferno-Console-Setup"
# Deve mostrare il processo installer

# Verifica chiusura app
tasklist | findstr "Inferno Console"
# NON deve mostrare nulla (app chiusa)
```

**Console log (se visibile)**:
```
🔧 [NSIS] Rilevata installazione esistente: C:\Users\...\AppData\Local\Inferno Console
🔧 [NSIS] Chiusura processi attivi...
🔧 [NSIS] Sovrascrittura file...
✅ [NSIS] Installazione completata!
```

---

#### **T+85s**: Installazione Completata

**Verifica Manuale**:
```powershell
# Verifica versione aggiornata
reg query "HKCU\Software\Inferno Console" /v Version
# Output: 1.4.151

# Verifica file aggiornato
dir "%LOCALAPPDATA%\Inferno Console\Inferno Console.exe"
# Verifica data modifica (deve essere recente)

# Verifica version.txt
type "%LOCALAPPDATA%\Inferno Console\version.txt"
# Output: Inferno Console v1.4.151
```

**Verifica App**:
- [ ] App si riavvia automaticamente (opzionale)
- [ ] Shortcuts ancora presenti (Desktop + Start Menu)
- [ ] Directory STESSA di prima
- [ ] Dati utente preservati (playlist, settings)

---

#### **T+90s**: Avvia App Aggiornata

```bash
# Avvia manualmente se non si è riavviata
"%LOCALAPPDATA%\Inferno Console\Inferno Console.exe"
```

**Verifica UI**:
- [ ] App si avvia correttamente
- [ ] Versione in Info: "1.4.151"
- [ ] Nessuna notifica di aggiornamento
- [ ] Tutte le funzionalità funzionanti

**Console log**:
```
✅ [APP] Versione: 1.4.151
✅ [APP] Installazione: C:\Users\...\AppData\Local\Inferno Console
```

---

## ✅ Checklist Finale

### **Funzionalità**
- [ ] Auto-updater rileva nuova versione
- [ ] Download installer NSIS
- [ ] Installazione silenziosa
- [ ] App si chiude automaticamente
- [ ] Installer aggiorna nella STESSA directory
- [ ] App si riavvia (opzionale)

### **Integrità**
- [ ] Shortcuts mantenuti
- [ ] Dati utente preservati
- [ ] Registro aggiornato
- [ ] Nessun file duplicato
- [ ] Nessuna directory extra creata

### **Performance**
- [ ] Download veloce (progress bar fluida)
- [ ] Installazione rapida (~15 secondi)
- [ ] Nessun crash o errore
- [ ] Memoria stabile

---

## 🐛 Troubleshooting

### Problema: "Aggiornamento non rilevato"

**Verifica**:
```powershell
# Controlla versione corrente
node -e "console.log(require('./package.json').version)"

# Controlla GitHub releases
curl https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest
```

**Soluzione**:
- Assicurati che `package.json` sia incrementato
- Verifica che la release sia pubblica su GitHub
- Controlla console per errori API

---

### Problema: "Download fallito"

**Verifica**:
```powershell
# Controlla directory download
dir "%USERPROFILE%\Desktop\Inferno Console\Updates"

# Controlla permessi
icacls "%USERPROFILE%\Desktop\Inferno Console\Updates"
```

**Soluzione**:
- Verifica connessione internet
- Controlla spazio disco disponibile
- Verifica permessi directory

---

### Problema: "Installazione non parte"

**Verifica**:
```powershell
# Controlla se installer è NSIS
"%USERPROFILE%\Desktop\Inferno Console\Updates\Inferno-Console-Setup.exe" /?
# Deve mostrare opzioni NSIS

# Controlla processi
tasklist | findstr "Inferno"
```

**Soluzione**:
- Chiudi manualmente l'app prima di installare
- Esegui installer come amministratore (se necessario)
- Verifica antivirus non blocca installer

---

### Problema: "App non si riavvia"

**Soluzione**:
- Avvia manualmente da shortcut Desktop
- Verifica che l'installer abbia completato
- Controlla log Windows Event Viewer

---

## 📊 Metriche di Successo

| Metrica | Target | Risultato |
|---------|--------|-----------|
| Tempo rilevamento | < 10s | ⏱️ ___ s |
| Tempo download | < 60s | ⏱️ ___ s |
| Tempo installazione | < 20s | ⏱️ ___ s |
| Tempo totale | < 90s | ⏱️ ___ s |
| Directory corretta | ✅ | ☐ |
| Dati preservati | ✅ | ☐ |
| Nessun errore | ✅ | ☐ |

---

## 📝 Note di Test

**Data Test**: _______________

**Versione Iniziale**: 1.4.150

**Versione Finale**: 1.4.151

**Sistema Operativo**: Windows ___

**Risultato**: ☐ PASS | ☐ FAIL

**Note**:
```
[Inserisci note qui]
```

---

## 🎯 Prossimi Test

- [ ] Test con versione molto vecchia (es. 1.3.x → 1.4.151)
- [ ] Test con installazione in directory custom
- [ ] Test con app in esecuzione (verifica chiusura forzata)
- [ ] Test con connessione lenta (verifica resume download)
- [ ] Test con spazio disco insufficiente
- [ ] Test rollback in caso di errore

