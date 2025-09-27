# RELEASE v1.4.51 - Fix Generazione Automatica latest.yml

## 🚀 Data Rilascio
**27 Settembre 2025 - 18:15 UTC**

## 🔧 Fix Principali

### ✅ Generazione Automatica latest.yml
- **Fix sintassi YAML** - Corretta indentazione nel workflow GitHub Actions
- **Token GitHub** - Confermato uso corretto di `GH_TOKEN`
- **Script automatico** - latest.yml generato con SHA512 e dimensioni reali
- **Upload automatico** - File caricato come asset della release

### 🛠️ Miglioramenti Workflow
- **Validazione YAML** - Risolto errore di sintassi su linea 66
- **Generazione dinamica** - SHA512 e size calcolati automaticamente dal .exe
- **Compatibilità** - Supporto per Windows e macOS

## 🎯 Obiettivo
Testare la generazione automatica di `latest.yml` per risolvere definitivamente l'errore "Release non ancora disponibile!" nell'auto-updater.

## 📋 File Modificati
- `.github/workflows/build-and-release-simple.yml` - Fix sintassi YAML
- `package.json` - Versione aggiornata a v1.4.51

## 🔍 Test Richiesti
1. Verificare che GitHub Actions generi correttamente `latest.yml`
2. Testare auto-updater con nuova release
3. Confermare download automatico funzionante

---
**Build**: v1.4.51  
**Data**: 2025-09-27T18:15:00.000Z  
**Status**: 🟡 In Testing
