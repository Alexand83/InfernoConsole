# 🚀 Sistema di Release Automatiche con Delta Updates

## 📋 Panoramica

Questo sistema automatizza completamente il processo di release dell'applicazione, inclusa la generazione di delta patches per aggiornamenti incrementali.

## 🔧 Componenti

### 1. **GitHub Actions Workflow** (`.github/workflows/release.yml`)
- Trigger automatico su tag git o manuale
- Build automatico dell'applicazione
- Generazione di delta patches
- Creazione di release GitHub con assets

### 2. **Script di Release** (`scripts/create-release.js`)
- Aggiorna automaticamente la versione
- Genera delta patches
- Crea git tag
- Prepara file per la release

### 3. **Generatore Delta Patches** (`scripts/generate-delta-release.js`)
- Crea patch incrementali tra versioni
- Genera manifest con metadati
- Calcola risparmi di banda

## 🚀 Come Creare una Release

### Metodo 1: Script Automatico (Raccomandato)
```bash
# Crea una nuova release
npm run release:create 1.4.110

# Push del tag per attivare GitHub Actions
git push origin v1.4.110
```

### Metodo 2: Manuale
```bash
# 1. Aggiorna versione
npm version 1.4.110

# 2. Genera delta patches
npm run release:delta

# 3. Build e commit
npm run build
git add .
git commit -m "Release v1.4.110"
git tag v1.4.110
git push origin v1.4.110
```

### Metodo 3: GitHub Actions Manuale
1. Vai su GitHub → Actions
2. Seleziona "Release with Delta Updates"
3. Clicca "Run workflow"
4. Inserisci la versione (es. `1.4.110`)

## 📁 Struttura Release

```
releases/
├── 1.4.108/
│   ├── manifest.json
│   ├── main.exe.patch
│   ├── app.asar.patch
│   ├── config.json.patch
│   └── Inferno-Console-Setup-1.4.108.exe
├── 1.4.109/
│   ├── manifest.json
│   ├── main.exe.patch
│   ├── app.asar.patch
│   ├── config.json.patch
│   └── Inferno-Console-Setup-1.4.109.exe
└── 1.4.110/
    ├── manifest.json
    ├── main.exe.patch
    ├── app.asar.patch
    ├── config.json.patch
    └── Inferno-Console-Setup-1.4.110.exe
```

## 📊 Delta Updates

### Vantaggi
- **95% riduzione download** (77MB → 3-5MB)
- **10-20x più veloce** (2-5 minuti → 10-30 secondi)
- **Fallback automatico** se i delta falliscono
- **Verifica integrità** dei file

### Come Funziona
1. **Generazione**: Script crea patch tra versioni consecutive
2. **Manifest**: File JSON con metadati e hash
3. **Download**: Client scarica solo le differenze
4. **Applicazione**: Patch vengono applicate ai file esistenti
5. **Verifica**: Hash verificati per integrità

## 🔄 Workflow GitHub Actions

### Trigger
- **Automatico**: Push di tag git (`v*`)
- **Manuale**: Workflow dispatch con input versione

### Processo
1. **Setup**: Checkout, Node.js, dependencies
2. **Version**: Estrae versione da tag o input
3. **Build**: Compila l'applicazione
4. **Delta**: Genera patch incrementali
5. **Assets**: Crea installer e file di release
6. **Release**: Crea GitHub release con assets
7. **Cleanup**: Pulisce file temporanei

## 📝 Manifest File

```json
{
  "version": "1.4.110",
  "previousVersion": "1.4.109",
  "timestamp": "2025-10-08T10:00:00.000Z",
  "files": [
    {
      "path": "main.exe",
      "hash": "abc123def456",
      "size": 1200,
      "delta": {
        "patchSize": 1200,
        "patchHash": "patch123"
      }
    }
  ],
  "totalSize": 3300,
  "fullSize": 77000000,
  "savings": "95.7%"
}
```

## 🛠️ Script Disponibili

```bash
# Release
npm run release:create [version]    # Crea release completa
npm run release:delta               # Genera solo delta patches
npm run release:auto                # Build + delta patches

# Delta Updates
npm run delta:generate              # Genera delta patches
npm run delta:test                  # Test con versioni fake
npm run delta:test-system           # Test completo del sistema

# Build
npm run build:delta                 # Build + delta patches
npm run build                       # Build standard
```

## 🔍 Debugging

### Log GitHub Actions
1. Vai su GitHub → Actions
2. Seleziona la run
3. Espandi i step per vedere i log

### Log Locali
```bash
# Test delta patches
npm run delta:test-system

# Verifica file generati
ls -la releases/
cat releases/1.4.110/manifest.json
```

## 📋 Checklist Release

- [ ] Versione aggiornata in `package.json`
- [ ] Changelog aggiornato
- [ ] Test delta patches
- [ ] Build funzionante
- [ ] Git tag creato
- [ ] Push su GitHub
- [ ] GitHub Actions completato
- [ ] Release assets verificati

## 🚨 Troubleshooting

### Errori Comuni

1. **"No previous version found"**
   - Normale per la prima release
   - Verrà creato un installer completo

2. **"Delta patch generation failed"**
   - Controlla che le versioni precedenti esistano
   - Verifica permessi file system

3. **"GitHub Actions failed"**
   - Controlla i log in GitHub → Actions
   - Verifica che il tag sia stato pushato

4. **"Release assets not found"**
   - Verifica che il build sia completato
   - Controlla che i file siano nella directory corretta

## 📞 Supporto

Per problemi o domande:
1. Controlla i log GitHub Actions
2. Verifica la documentazione
3. Testa localmente con `npm run delta:test-system`
4. Controlla la struttura dei file in `releases/`

---

**Sistema di Release v1.0** - Automatizzato con Delta Updates 🚀
