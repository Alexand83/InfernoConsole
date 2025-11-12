# 🧪 TEST AUTO-UPDATER LOCALE - ISTRUZIONI RAPIDE

## 📋 Cosa serve:
- ✅ Build già fatta (`npm run build`)
- ✅ 2 terminali aperti

## 🚀 PROCEDURA COMPLETA (3 passi):

### 1️⃣ TERMINALE 1: Avvia il server mock

```bash
npm run test:update
```

Dovresti vedere:
```
🧪 TEST LOCALE AUTO-UPDATER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Versione corrente: 1.4.182
📦 Versione mock: 999.999.999
🌐 Server mock: http://localhost:3456

✅ Server mock avviato su http://localhost:3456
```

**NON CHIUDERE QUESTO TERMINALE!** Lascialo girare in background.

---

### 2️⃣ TERMINALE 2: Avvia l'app in modalità test

**Opzione A - Con PowerShell:**
```powershell
.\start-test-mode.ps1
```

**Opzione B - Con npm:**
```bash
npm run test:update:app
```

**Opzione C - Con bat:**
```cmd
start-test-mode.bat
```

L'app si aprirà e nei log vedrai:
```
🔍 [UPDATE] Modalità: TEST LOCALE
🔍 [UPDATE] URL: http://localhost:3456/repos/...
```

---

### 3️⃣ NELL'APP: Testa il controllo aggiornamenti

1. Apri l'app
2. Vai in **Impostazioni** ⚙️
3. Trova il pulsante **"Controlla Aggiornamenti"**
4. Clicca sul pulsante

**RISULTATO ATTESO:**

✅ Dovresti vedere un popup/notifica che dice:
```
📦 Aggiornamento disponibile: 999.999.999
📊 Dimensione: 1.0 MB
```

---

## 🔍 VERIFICA CHE FUNZIONI:

### ✅ Server Mock (Terminale 1):
Dovresti vedere richieste HTTP:
```
📡 GET /repos/Alexand83/InfernoConsole/releases/latest
📡 GET /download/latest.yml
```

### ✅ App Electron (Terminale 2):
Dovresti vedere nei log:
```
🔍 [UPDATE] Modalità: TEST LOCALE
🔍 Controllo aggiornamenti tramite API GitHub...
📦 Versione corrente: 1.4.182
📦 Versione più recente: 999.999.999
✅ Nuova versione disponibile!
📥 Installer trovato: Inferno-Console-Setup.exe
📊 Dimensione: 1.00 MB
```

---

## 🧪 TEST DA FARE:

### Test 1: Controllo Update ✅
- [ ] Il pulsante "Controlla Aggiornamenti" funziona
- [ ] Compare la notifica di aggiornamento
- [ ] La versione mostrata è `999.999.999`
- [ ] La dimensione è `1.0 MB`

### Test 2: Download ✅
- [ ] Clicca "Scarica Aggiornamento"
- [ ] Il download parte automaticamente
- [ ] La progress bar si aggiorna (0% → 100%)
- [ ] Il download NON si blocca allo 0%
- [ ] Il download completa con successo

### Test 3: NO Loop Istanze ✅
- [ ] Chiudi e riapri l'app più volte
- [ ] NON si aprono istanze multiple
- [ ] NON c'è controllo automatico all'avvio
- [ ] L'app parte normalmente

---

## 🛑 FERMARE IL TEST:

### Terminale 1 (Server Mock):
Premi `CTRL + C`

### Terminale 2 (App):
Chiudi l'app normalmente

---

## ⚠️ IMPORTANTE:

### ✅ Il codice è SICURO per commit!
La modalità test usa una **variabile d'ambiente** (`UPDATE_TEST_MODE=local`).

Quando l'app gira normalmente (senza la variabile), usa GitHub in automatico.

**NON serve ripristinare nulla!** Il codice funziona sia per test che per produzione.

---

## 🐛 PROBLEMI COMUNI:

### ❌ "Server mock non raggiungibile"
- Controlla che il server sia avviato (Terminale 1)
- Verifica che la porta 3456 sia libera

### ❌ "Nessun aggiornamento disponibile"
- Controlla che nei log ci sia: `Modalità: TEST LOCALE`
- Se vedi `Modalità: PRODUZIONE`, rilancia con `npm run test:update:app`

### ❌ "Download non parte"
- Controlla i log del server mock
- Verifica che il file `test-update/Inferno-Console-Setup.exe` esista

---

## 📝 DOPO IL TEST:

I file di test sono in `.gitignore`, non verranno committati.

Puoi cancellarli se vuoi:
```bash
rmdir /s test-update
del test-*.js
```

---

## 🎯 RECAP VELOCE:

1. `npm run test:update` → Server mock ON
2. `npm run test:update:app` → App in modalità test
3. Vai in Impostazioni → Controlla Aggiornamenti
4. Verifica che vedi versione `999.999.999`
5. Testa il download
6. CTRL+C per fermare

**Fine! 🎉**

