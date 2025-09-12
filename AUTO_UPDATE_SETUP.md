# 🚀 Sistema di Auto-Update per DJ Console Pro

## 📋 Panoramica

Il sistema di auto-update è configurato per aggiornare automaticamente DJ Console Pro utilizzando GitHub Releases. Quando viene creato un nuovo tag su GitHub, viene automaticamente costruita e rilasciata una nuova versione dell'app.

## 🔧 Configurazione Attuale

### GitHub Actions
- **Build automatico**: Su ogni push ai branch principali
- **Release automatico**: Quando viene creato un tag (es. `v1.0.1`)
- **Piattaforme supportate**: Windows, macOS, Linux

### Auto-Updater
- **Controllo automatico**: All'avvio dell'app
- **Download in background**: Gli aggiornamenti vengono scaricati automaticamente
- **Notifiche utente**: L'utente viene informato quando è disponibile un aggiornamento

## 📦 Come Creare un Nuovo Release

### 1. Aggiorna la Versione
```bash
# Aggiorna la versione nel package.json
npm version patch  # per fix (1.0.0 -> 1.0.1)
npm version minor  # per nuove funzionalità (1.0.0 -> 1.1.0)
npm version major  # per breaking changes (1.0.0 -> 2.0.0)
```

### 2. Push del Tag
```bash
# Push del tag per triggerare il build automatico
git push origin --tags
```

### 3. GitHub Actions
- Il workflow `build-and-release.yml` si attiva automaticamente
- Costruisce l'app per Windows, macOS e Linux
- Crea un nuovo release su GitHub con tutti i file

## 🔄 Come Funziona l'Auto-Update

### Per l'Utente
1. **Controllo automatico**: All'avvio, l'app controlla se ci sono aggiornamenti
2. **Notifica**: Se disponibile, mostra una notifica all'utente
3. **Download**: L'aggiornamento viene scaricato in background
4. **Installazione**: L'utente può scegliere quando riavviare per applicare l'aggiornamento

### Per lo Sviluppatore
1. **Tag**: Crea un tag su GitHub (es. `v1.0.1`)
2. **Build**: GitHub Actions costruisce automaticamente l'app
3. **Release**: Viene creato un nuovo release con tutti i file
4. **Distribuzione**: Gli utenti ricevono automaticamente l'aggiornamento

## 🛠️ File di Configurazione

### `.github/workflows/build-and-release.yml`
- Workflow per build e release automatici
- Si attiva sui tag (es. `v*`)
- Costruisce per Windows, macOS, Linux

### `.github/workflows/build.yml`
- Workflow per build di test
- Si attiva su push ai branch principali
- Non crea release, solo build di test

### `electron/updater.js`
- Modulo per gestire l'auto-updater
- Controlla aggiornamenti all'avvio
- Gestisce download e installazione

### `package.json`
- Configurazione `publish` per GitHub
- Configurazione `build` per electron-builder

## 📱 Test dell'Auto-Update

### Test Locale
```bash
# Build di test
npm run dist:win

# L'app controllerà automaticamente gli aggiornamenti
npm run electron
```

### Test con Release
1. Crea un tag di test: `git tag v1.0.0-test`
2. Push del tag: `git push origin v1.0.0-test`
3. Verifica che GitHub Actions crei il release
4. Testa l'aggiornamento nell'app

## 🔒 Sicurezza

- **Firma digitale**: I release sono firmati (quando configurato)
- **Verifica hash**: L'auto-updater verifica l'integrità dei file
- **HTTPS**: Tutti i download avvengono su HTTPS

## 📊 Monitoraggio

### GitHub Actions
- Visita la tab "Actions" su GitHub per vedere lo stato dei build
- I log mostrano dettagli su build, test e release

### Log dell'App
- L'auto-updater scrive log nella console
- Controlla la console per debug degli aggiornamenti

## 🚨 Troubleshooting

### Build Fallisce
1. Controlla i log di GitHub Actions
2. Verifica che tutte le dipendenze siano installate
3. Controlla la configurazione di electron-builder

### Auto-Update Non Funziona
1. Verifica che il repository sia pubblico
2. Controlla che i release siano pubblici
3. Verifica la configurazione `publish` nel package.json

### Download Lento
1. I file sono grandi (100MB+), è normale
2. Considera l'uso di CDN per distribuzione
3. Implementa download progress per UX migliore

## 📈 Prossimi Miglioramenti

- [ ] Download progress bar nell'UI
- [ ] Controllo manuale aggiornamenti nelle settings
- [ ] Notifiche push per nuovi release
- [ ] Rollback automatico in caso di errori
- [ ] Delta updates per file più piccoli

## 📞 Supporto

Per problemi con l'auto-update:
1. Controlla i log di GitHub Actions
2. Verifica la configurazione del repository
3. Testa con un tag di test
4. Contatta il team di sviluppo

---

**Sviluppato da Alessandro(NeverAgain)**  
**Licenza MIT**  
**Repository**: https://github.com/Alexand83/InfernoConsole
