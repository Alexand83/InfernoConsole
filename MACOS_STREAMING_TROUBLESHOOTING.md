# macOS Streaming Troubleshooting Guide

## Problemi Comuni e Soluzioni

### 1. FFmpeg non trovato o non funzionante

**Sintomi:**
- Streaming si avvia ma non entra mai online
- Errore "ffmpeg: command not found"
- Errore "spawn ENOENT"

**Soluzioni:**

#### A. Verifica che FFmpeg sia incluso nel build
La versione 1.4.28+ include automaticamente i binari FFmpeg per macOS:
- `ffmpeg-mac-x64` per Intel Mac
- `ffmpeg-mac-arm64` per Apple Silicon (M1/M2/M3)

#### B. Controlla i log per debug
Apri la Console di macOS e cerca i log di DJ Console:
```
🔍 [MAIN] Platform: darwin Arch: arm64
🔍 [MAIN] FFmpeg path resolved: /path/to/ffmpeg-mac-arm64
🔍 [MAIN] FFmpeg file exists: true
🔍 [MAIN] FFmpeg file size: 12345678 bytes
```

#### C. Verifica manualmente FFmpeg
Se hai problemi, puoi installare FFmpeg manualmente:
```bash
# Con Homebrew
brew install ffmpeg

# Poi imposta la variabile d'ambiente
export FFMPEG_PATH=/opt/homebrew/bin/ffmpeg
```

### 2. Problemi di Permessi

**Sintomi:**
- Errore "Permission denied"
- FFmpeg non si avvia

**Soluzioni:**
```bash
# Rendi eseguibile il binario FFmpeg
chmod +x /path/to/ffmpeg-mac-arm64
```

### 3. Problemi di Connessione Icecast

**Sintomi:**
- FFmpeg si avvia ma streaming non entra online
- Errore "400 Bad Request"
- Errore "401 Unauthorized"

**Soluzioni:**

#### A. Verifica configurazione Icecast
- **Host**: Usa l'IP locale del computer (es. `192.168.1.100`) invece di `localhost`
- **Porta**: Di solito `8000` per Icecast
- **Mount Point**: Deve iniziare con `/` (es. `/live`)
- **Username/Password**: Corretti per il server Icecast

#### B. Testa connessione manuale
```bash
# Testa se il server Icecast è raggiungibile
curl -I http://192.168.1.100:8000/

# Testa connessione con autenticazione
curl -I http://username:password@192.168.1.100:8000/live
```

### 4. Problemi di Audio Input

**Sintomi:**
- Streaming si avvia ma nessun audio
- Errore "No audio input detected"

**Soluzioni:**

#### A. Verifica permessi microfono
1. Vai su **Preferenze di Sistema** > **Sicurezza e Privacy** > **Privacy**
2. Seleziona **Microfono** dal menu laterale
3. Assicurati che DJ Console sia abilitato

#### B. Verifica dispositivo audio
1. Vai su **Preferenze di Sistema** > **Suono**
2. Verifica che il microfono selezionato sia corretto
3. Testa il microfono con altre applicazioni

### 5. Problemi di Rete

**Sintomi:**
- Connessione WebRTC fallisce
- Client non riesce a connettersi all'host

**Soluzioni:**

#### A. Usa IP locale invece di localhost
- **Host**: Usa l'IP del computer host (es. `192.168.1.100:8080`)
- **Non usare**: `localhost:8080` (funziona solo sul computer stesso)

#### B. Trova l'IP locale
```bash
# Trova l'IP della rete locale
ifconfig | grep "inet " | grep -v 127.0.0.1
```

#### C. Verifica firewall
1. Vai su **Preferenze di Sistema** > **Sicurezza e Privacy** > **Firewall**
2. Assicurati che DJ Console sia autorizzato

### 6. Debug Avanzato

#### A. Abilita logging dettagliato
I log di DJ Console sono salvati in:
```
~/Library/Application Support/dj-console/djconsole.log
```

#### B. Controlla output FFmpeg
I log includono:
- Comando FFmpeg completo
- Output di FFmpeg (stdout/stderr)
- Codici di errore dettagliati

#### C. Testa FFmpeg manualmente
```bash
# Testa FFmpeg con parametri simili
ffmpeg -f avfoundation -i ":0" -c:a libmp3lame -b:a 128k -f mp3 icecast://user:pass@host:port/mount
```

## Configurazione Raccomandata per macOS

### 1. Impostazioni Icecast
```
Host: 192.168.1.100 (IP locale del computer host)
Porta: 8000
Mount Point: /live
Username: source
Password: [password del server Icecast]
Formato: MP3
Bitrate: 128 kbps
```

### 2. Impostazioni Audio
```
Input Device: [Microfono principale]
Output Device: [Cuffie/Altoparlanti]
Sample Rate: 44100 Hz
Channels: 2 (Stereo)
```

### 3. Impostazioni WebRTC
```
Host: 192.168.1.100:8080 (IP locale del computer host)
Non usare localhost su computer diversi
```

## Contatti e Supporto

Se continui ad avere problemi:
1. Controlla i log dettagliati
2. Verifica la configurazione di rete
3. Testa con un server Icecast diverso
4. Prova con un microfono diverso

La versione 1.4.28+ include correzioni specifiche per macOS e logging dettagliato per il debug.
