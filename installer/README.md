# 🔥 Inferno Console Custom Installer

Un installer personalizzato per Inferno Console, completamente sviluppato in Node.js senza dipendenze esterne come NSIS.

## ✨ Caratteristiche

- **🎨 Interfaccia Grafica Moderna**: GUI Electron elegante e user-friendly
- **💻 Modalità CLI**: Supporto per installazione da riga di comando
- **📁 Selezione Directory**: L'utente può scegliere dove installare l'app
- **🌐 Download Automatico**: Scarica automaticamente l'app da GitHub
- **🔗 Shortcut Intelligenti**: Crea shortcut desktop e Start Menu
- **🗑️ Uninstaller Integrato**: Genera un uninstaller automatico
- **📝 Log Dettagliati**: Feedback completo durante l'installazione
- **🛡️ Gestione Errori**: Gestione robusta degli errori
- **⚡ Veloce**: Installer leggero (~5MB) che scarica solo quando necessario

## 🚀 Utilizzo

### Modalità GUI (Raccomandata)
```bash
node main.js --gui
```

### Modalità CLI
```bash
node main.js
```

### Build dell'Installer
```bash
npm run build
```

## 📁 Struttura del Progetto

```
installer/
├── main.js              # File principale dell'installer
├── package.json         # Dipendenze e script
├── build.js             # Script di build
├── gui/                 # Interfaccia grafica
│   ├── index.html       # HTML principale
│   ├── style.css        # Stili CSS
│   └── script.js        # Logica frontend
├── utils/               # Moduli di utilità
│   ├── downloader.js    # Gestione download
│   ├── installer.js     # Logica installazione
│   └── shortcuts.js     # Gestione shortcut
└── assets/              # Risorse (icone, etc.)
    └── icon.ico         # Icona installer
```

## 🔧 Dipendenze

- **Electron**: Per l'interfaccia grafica
- **Axios**: Per il download da GitHub
- **fs-extra**: Per operazioni file avanzate
- **Progress**: Per barre di progresso
- **Chalk**: Per output colorato
- **Inquirer**: Per interfaccia CLI
- **node-windows**: Per gestione servizi Windows

## 📋 Funzionalità

### 1. Selezione Directory
- Desktop (raccomandato)
- Programmi (richiede admin)
- Documenti
- Directory personalizzata

### 2. Download e Installazione
- Download automatico da GitHub Releases
- Verifica integrità file
- Copia nella directory selezionata
- Creazione file di configurazione

### 3. Shortcut e Registrazione
- Shortcut desktop
- Shortcut Start Menu
- Registrazione nel registro di sistema
- Icone personalizzate

### 4. Uninstaller
- Generazione automatica uninstaller
- Rimozione completa dell'app
- Pulizia shortcut e registro

## 🛠️ Sviluppo

### Installazione Dipendenze
```bash
npm install
```

### Sviluppo Locale
```bash
npm run dev
```

### Build Produzione
```bash
npm run build
```

## 📦 Integrazione con GitHub Actions

L'installer si integra perfettamente con il workflow GitHub Actions esistente:

1. **Build Automatico**: Si costruisce automaticamente ad ogni release
2. **Download GitHub**: Scarica l'app dalle GitHub Releases
3. **Distribuzione**: Viene pubblicato come asset della release

## 🎯 Vantaggi rispetto a NSIS

- ✅ **Controllo Totale**: Codice completamente personalizzabile
- ✅ **Interfaccia Moderna**: GUI Electron professionale
- ✅ **Nessuna Dipendenza**: Non richiede NSIS o altri installer
- ✅ **Facilmente Estendibile**: Aggiungi funzionalità facilmente
- ✅ **Debug Semplice**: Log dettagliati per troubleshooting
- ✅ **Cross-Platform**: Facilmente adattabile per macOS/Linux

## 🔍 Troubleshooting

### Errori Comuni

1. **Download Fallito**
   - Verifica connessione internet
   - Controlla che la release GitHub esista

2. **Permessi Insufficienti**
   - Esegui come amministratore per installazione in Programmi
   - Verifica permessi di scrittura nella directory

3. **Shortcut Non Creati**
   - Verifica che PowerShell sia disponibile
   - Controlla permessi di scrittura su Desktop e Start Menu

### Log Dettagliati

L'installer fornisce log dettagliati per ogni operazione:
- ✅ Operazioni completate con successo
- ⚠️ Avvisi (non bloccanti)
- ❌ Errori critici
- ℹ️ Informazioni generali

## 📄 Licenza

MIT License - Vedi file LICENSE per dettagli.

## 👥 Contributi

I contributi sono benvenuti! Apri una issue o una pull request.

---

**Inferno Console Installer v1.0.0** - Made with ❤️ by Inferno Console Team
