# 🔥 Inferno Console - Console DJ Professionale

Una console DJ professionale completa con **streaming live** e **automazione playlist** 24/7, implementata come applicazione web moderna con mixaggio audio avanzato e effetti in tempo reale.

## 🚀 **Funzionalità Principali**

### **🎵 Audio Engine Avanzato**
- **Web Audio API** per processamento audio real-time
- **Mixaggio live** di musica + microfono
- **Effetti audio professionali**: EQ 3-band, Reverb, Delay, Distortion
- **Compressione dinamica** per controllo dinamica
- **Crossfader** con curve configurabili

### **📡 Streaming Server Reale**
- **Server Icecast/Shoutcast** funzionante
- **Streaming live** su internet
- **Metadata real-time** (titolo, artista, album)
- **WebSocket** per comunicazione bidirezionale
- **Fallback automatico** se la trasmissione si interrompe

### **🤖 Automazione Intelligente**
- **Scheduler 24/7** per playlist automatiche
- **Regole di rotazione** intelligenti
- **Separazione artisti** e **bilanciamento generi**
- **Eventi ricorrenti** (giornalieri, settimanali, mensili)
- **Priorità configurabili** per eventi speciali

### **🎛️ Console DJ Professionale**
- **2 Deck Audio** indipendenti (A e B)
- **Waveform visualizer** real-time
- **Punti cue** e controlli di trasporto
- **Pitch control** e **sincronizzazione BPM**
- **Monitor headphones** e **VU meters**

### **📚 Gestione Libreria Avanzata**
- **Database locale** per grandi librerie
- **Tagging avanzato**: BPM, Key musicale, Energia
- **Ricerca intelligente** e **filtri multipli**
- **Import/Export** playlist
- **Analisi audio** e **waveform**

## 🛠️ **Installazione e Setup**

### **Prerequisiti**
- Node.js 16+ 
- npm o yarn
- Browser moderno con Web Audio API support

### **1. Installazione Dipendenze Frontend**
```bash
npm install
```

### **2. Installazione Dipendenze Server**
```bash
cd server
npm install
cd ..
```

### **3. Avvio Server di Streaming**
```bash
cd server
npm start
```

Il server sarà disponibile su:
- **HTTP**: http://localhost:8000
- **WebSocket**: ws://localhost:8000
- **Icecast**: http://localhost:8000/icecast
- **Stream**: http://localhost:8000/stream

### **4. Avvio Frontend Inferno Console**
```bash
npm run dev
```

L'applicazione sarà disponibile su: http://localhost:3000

## 🎯 **Come Usare**

### **🎤 Streaming Live**
1. **Connetti al server**: Clicca "Connect to Server" nel pannello streaming
2. **Attiva microfono**: Clicca l'icona microfono per abilitare input vocale
3. **Carica musica**: Trascina file audio sui deck
4. **Avvia streaming**: Clicca "Start Streaming" per trasmettere live
5. **Mixa audio**: Usa il crossfader per bilanciare musica e microfono

### **📅 Scheduler Automatico**
1. **Crea eventi**: Aggiungi playlist, jingle, promozioni
2. **Imposta ricorrenze**: Giornaliere, settimanali, mensili
3. **Configura regole**: Separazione artisti, bilanciamento generi
4. **Avvia automazione**: Il sistema gestirà tutto automaticamente 24/7

### **🎛️ Controlli DJ**
- **Deck A/B**: Carica tracce diverse su ogni deck
- **Crossfader**: Mixa tra i due deck
- **Effetti**: Applica EQ, reverb, delay in tempo reale
- **Cue Points**: Imposta punti di entrata per mix perfetti

## 🔧 **Configurazione Avanzata**

### **Server di Streaming**
```javascript
// server/streaming-server.js
const streamingServer = new StreamingServer()
streamingServer.start(8000) // Cambia porta se necessario
```

### **Web Audio Engine**
```typescript
// src/audio/WebAudioEngine.ts
const audioEngine = new WebAudioEngine()
await audioEngine.startMicrophone()
await audioEngine.loadMusic(audioFile)
```

### **Scheduler**
```typescript
// src/scheduler/PlaylistScheduler.ts
const scheduler = new PlaylistScheduler()
scheduler.addEvent({
  name: 'Morning Show',
  type: 'playlist',
  startTime: new Date('2024-01-01T08:00:00'),
  duration: 120, // 2 ore
  priority: 'high',
  isRecurring: true,
  recurringPattern: 'daily'
})
```

## 📡 **Streaming su Internet**

### **Configurazione Icecast**
1. **Port forwarding**: Apri porta 8000 sul router
2. **IP pubblico**: Usa il tuo IP pubblico per streaming esterno
3. **DNS**: Configura un dominio per accesso facile
4. **CDN**: Usa servizi come Cloudflare per distribuzione globale

### **Formati Supportati**
- **Audio**: MP3, AAC, OGG, WAV
- **Bitrate**: 64kbps - 320kbps configurabile
- **Sample Rate**: 44.1kHz, 48kHz
- **Channels**: Stereo, Mono

## 🎨 **Personalizzazione**

### **Temi e Colori**
```css
/* src/index.css */
:root {
  --dj-primary: #1a1a2e;
  --dj-secondary: #16213e;
  --dj-accent: #0f3460;
  --dj-highlight: #e94560;
  --dj-success: #4ade80;
  --dj-warning: #fbbf24;
  --dj-error: #f87171;
}
```

### **Layout e Componenti**
- **Responsive design** per tutti i dispositivi
- **Temi scuri/chiari** configurabili
- **Layout personalizzabile** con drag & drop
- **Shortcut keyboard** per controlli rapidi

## 🚨 **Risoluzione Problemi**

### **Audio non funziona**
- Verifica permessi microfono nel browser
- Controlla che Web Audio API sia supportato
- Riavvia il browser se necessario

### **Streaming non si connette**
- Verifica che il server sia avviato
- Controlla firewall e porte
- Verifica connessione internet

### **Performance lenta**
- Riduci qualità audio se necessario
- Chiudi altre applicazioni audio
- Usa hardware più potente per librerie grandi

## 🔮 **Roadmap Futura**

### **Fase 2 - Funzionalità Avanzate**
- [ ] **Analisi audio real-time** con FFT
- [ ] **Beat matching automatico** e sync
- [ ] **Cloud storage** per libreria
- [ ] **API REST** per integrazioni esterne
- [ ] **Mobile app** nativa

### **Fase 3 - Enterprise**
- [ ] **Multi-studio** support
- [ ] **Analytics avanzati** e reporting
- [ ] **Integrazione social media**
- [ ] **Monetizzazione** e ads
- [ ] **White-label** per stazioni radio

## 📄 **Licenza**

MIT License - Vedi [LICENSE](LICENSE) per dettagli.

## 🤝 **Contributi**

Contributi benvenuti! Vedi [CONTRIBUTING.md](CONTRIBUTING.md) per linee guida.

## 📞 **Supporto**

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: support@djconsolepro.com

---

**🔥 Inferno Console** - Trasforma il tuo browser in una console DJ professionale! 🚀
