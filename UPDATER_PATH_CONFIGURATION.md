# 🔧 Configurazione Path Download Aggiornamenti

## 📁 **Path di Default**
- **Attuale**: `C:\Users\[USERNAME]\AppData\Local\inferno-console-updater\pending`
- **Nuovo**: `%USERPROFILE%\InfernoConsole\Updates` (es. `C:\Users\[USERNAME]\InfernoConsole\Updates`)

## 🔄 **Flusso Aggiornamento**

### **1. Download (Temporaneo)**
- **Path**: `%USERPROFILE%\InfernoConsole\Updates\`
- **File**: `Inferno-Console-win.exe` (temporaneo)
- **Scopo**: File di aggiornamento scaricato

### **2. Installazione (Definitivo)**
- **Path**: `%LOCALAPPDATA%\Programs\Inferno Console\`
- **File**: `Inferno-Console-win.exe` (definitivo)
- **Scopo**: File dell'applicazione installata

### **3. Shortcut Desktop**
- **Path**: `%USERPROFILE%\Desktop\Inferno Console.lnk`
- **Target**: `%LOCALAPPDATA%\Programs\Inferno Console\Inferno-Console-win.exe`
- **Scopo**: Collegamento al file definitivo installato

## 🛠️ **Come Cambiare il Path**

### **Metodo 1: Modifica package.json (RACCOMANDATO)**
```json
{
  "updater": {
    "downloadPath": "C:\\Il\\Tuo\\Path\\Personalizzato\\Updates"
  }
}
```

### **Metodo 2: Modifica app-update.yml**
```yaml
provider: github
owner: Alexand83
repo: InfernoConsole
updaterCacheDirName: inferno-console-updater
updaterCacheDir: C:\Il\Tuo\Path\Personalizzato\Updates
```

### **Metodo 3: Modifica Programmaticamente**
Nel file `electron/updater.js`, linea 20:
```javascript
const customUpdateDir = 'C:\\Il\\Tuo\\Path\\Personalizzato\\Updates'
```

## ✅ **Vantaggi del Nuovo Path**

1. **📁 Path Fisso**: Non dipende dal nome utente
2. **🔒 Accesso Semplice**: Facile da trovare e gestire
3. **🧹 Pulizia**: Directory dedicata per gli aggiornamenti
4. **⚙️ Configurabile**: Facilmente modificabile

## 🚀 **Come Applicare le Modifiche**

1. **Modifica** il path nel `package.json`
2. **Riavvia** l'applicazione
3. **Verifica** che la directory sia stata creata
4. **Testa** un aggiornamento per confermare

## 📋 **Path Suggeriti**

- `C:\InfernoConsole\Updates` (default)
- `D:\InfernoConsole\Updates` (se hai un disco D:)
- `C:\ProgramData\InfernoConsole\Updates` (per tutti gli utenti)
- `%USERPROFILE%\InfernoConsole\Updates` (nella home dell'utente)

## ⚠️ **Note Importanti**

- La directory viene creata automaticamente se non esiste
- Assicurati che l'app abbia i permessi di scrittura
- Il path deve essere assoluto (non relativo)
- Usa `\\` per i separatori su Windows
