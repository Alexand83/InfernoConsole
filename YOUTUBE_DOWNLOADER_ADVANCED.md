# 🎵 Sistema Avanzato YouTube Downloader

## 🚀 **Caratteristiche Principali**

### ✅ **Sistema di Bypass Multiplo**
- **yt-dlp** come downloader principale (più aggiornato e robusto)
- **youtube-dl** come fallback
- **Sistema di proxy rotation** per bypassare blocchi IP
- **User-Agent rotation** per evitare rilevamento
- **Retry automatico** con backoff esponenziale

### 🔄 **Gestione Proxy Avanzata**
- Lista proxy pubblici gratuiti preconfigurata
- Test automatico dei proxy all'avvio
- Rotazione automatica dei proxy
- Supporto per HTTP, HTTPS, SOCKS4, SOCKS5
- Aggiunta/rimozione proxy dinamica

### 🛡️ **Anti-Rilevamento**
- User-Agent realistici e variabili
- Headers HTTP ottimizzati
- Sleep intervals casuali
- Retry con strategie diverse
- Timeout configurabili

## 📦 **Installazione**

### 1. **Installazione Automatica**
```bash
npm install
# Lo script postinstall installerà automaticamente yt-dlp e youtube-dl
```

### 2. **Installazione Manuale**
```bash
# Installa yt-dlp
pip install --upgrade yt-dlp

# Installa youtube-dl (opzionale)
pip install --upgrade youtube-dl

# Installa FFmpeg (richiesto per conversione audio)
# Windows: winget install ffmpeg
# macOS: brew install ffmpeg
# Linux: sudo apt install ffmpeg
```

### 3. **Verifica Installazione**
```bash
npm run install-youtube-tools
```

## 🔧 **Configurazione**

### **Proxy Pubblici Preconfigurati**
Il sistema include una lista di proxy pubblici gratuiti in `src/config/proxyList.json`:

```json
{
  "proxyList": [
    {
      "host": "8.8.8.8",
      "port": 8080,
      "protocol": "http",
      "description": "Google DNS Proxy"
    }
  ]
}
```

### **Aggiunta Proxy Personalizzati**
Puoi aggiungere proxy personalizzati tramite l'interfaccia o l'API:

```javascript
// Aggiungi proxy tramite API
await window.electronAPI.invoke('add-proxy', {
  host: 'your-proxy.com',
  port: 8080,
  protocol: 'http',
  username: 'optional',
  password: 'optional'
})
```

## 🎯 **Utilizzo**

### **Download Semplice**
```javascript
// Il sistema userà automaticamente la strategia migliore
const result = await window.electronAPI.downloadYouTubeAudio({
  url: 'https://www.youtube.com/watch?v=VIDEO_ID',
  quality: '192',
  outputPath: './downloads/',
  downloadId: 'unique-id'
})
```

### **Test Metodi Disponibili**
```javascript
// Testa tutti i metodi per un URL
const results = await window.electronAPI.invoke('test-youtube-methods', url)
console.log(results) // Mostra quali metodi funzionano
```

### **Gestione Proxy**
```javascript
// Testa tutti i proxy
const workingProxies = await window.electronAPI.invoke('test-all-proxies')

// Forza rotazione proxy
await window.electronAPI.invoke('force-proxy-rotation')

// Ottieni statistiche proxy
const stats = await window.electronAPI.invoke('get-proxy-stats')
```

## 🔍 **Strategie di Download**

### **1. Sistema Avanzato (Priorità Alta)**
- yt-dlp con proxy rotation
- yt-dlp standard
- youtube-dl con proxy rotation
- youtube-dl standard

### **2. Sistema Originale (Fallback)**
- youtube-dl-exec
- play-dl
- ytdl-core

## 🛠️ **Risoluzione Problemi**

### **Errore: "Tutti i downloader hanno fallito"**
1. Verifica che yt-dlp sia installato: `yt-dlp --version`
2. Testa i proxy: usa il pannello "Gestione Proxy"
3. Prova con un URL diverso
4. Controlla la connessione internet

### **Errore: "Nessun proxy disponibile"**
1. Aggiungi proxy personalizzati
2. Testa i proxy esistenti
3. Verifica la connessione internet

### **Download Lento**
1. Aggiungi proxy più veloci
2. Riduci il numero di retry
3. Usa proxy geograficamente più vicini

## 📊 **Monitoraggio**

### **Log Dettagliati**
Il sistema fornisce log dettagliati per ogni operazione:
```
🔄 [YOUTUBE] Tentativo con sistema avanzato...
✅ [YOUTUBE] Successo con yt-dlp-proxy
🔄 [PROXY] Cambio proxy per il prossimo tentativo...
```

### **Statistiche Proxy**
- Numero totale di proxy
- Proxy funzionanti
- Indice corrente
- Storico richieste

## 🔒 **Sicurezza e Privacy**

### **Proxy Anonimi**
- I proxy pubblici non tracciano le richieste
- User-Agent variabili per evitare fingerprinting
- Headers HTTP ottimizzati per sembrare traffico normale

### **Nessun Log Permanente**
- I proxy non vengono salvati permanentemente
- Le richieste non vengono loggate
- I file temporanei vengono puliti automaticamente

## 🚀 **Performance**

### **Ottimizzazioni**
- Download paralleli quando possibile
- Cache dei proxy funzionanti
- Retry intelligente con backoff
- Timeout configurabili

### **Risorse Sistema**
- Uso minimo di memoria
- Processi isolati per ogni download
- Cleanup automatico dei file temporanei

## 📈 **Aggiornamenti**

### **Aggiornamento Automatico**
Il sistema si aggiorna automaticamente:
- yt-dlp viene aggiornato ad ogni installazione
- I proxy vengono testati periodicamente
- Le strategie vengono ottimizzate continuamente

### **Aggiornamento Manuale**
```bash
# Aggiorna yt-dlp
pip install --upgrade yt-dlp

# Aggiorna youtube-dl
pip install --upgrade youtube-dl

# Riavvia l'applicazione
```

## 🎯 **Best Practices**

### **Per Massima Affidabilità**
1. Usa proxy premium per uso intensivo
2. Mantieni yt-dlp aggiornato
3. Testa periodicamente i proxy
4. Usa timeout appropriati

### **Per Massima Velocità**
1. Usa proxy geograficamente vicini
2. Riduci il numero di retry
3. Usa connessioni stabili
4. Evita proxy sovraccarichi

## 🆘 **Supporto**

### **Log di Debug**
Abilita i log dettagliati per il debug:
```javascript
// Nel main process
console.log('🔍 [DEBUG] Dettagli operazione:', details)
```

### **Test Completo**
```bash
# Testa tutto il sistema
npm run install-youtube-tools
npm run electron
# Usa il pannello "Test Metodi" nell'interfaccia
```

---

## 🎉 **Conclusione**

Questo sistema avanzato risolve i principali problemi dei downloader YouTube:
- ✅ Bypassa blocchi IP con proxy rotation
- ✅ Evita rilevamento con User-Agent variabili
- ✅ Gestisce errori con retry intelligente
- ✅ Fornisce fallback multipli
- ✅ Offre monitoraggio e debug completi

**Il sistema è progettato per essere robusto, veloce e affidabile anche quando YouTube cambia le sue protezioni.**
