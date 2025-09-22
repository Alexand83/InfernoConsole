# macOS Microphone Troubleshooting Guide

## Problemi Comuni del Microfono su macOS

### 1. Microfono Built-in Non Funziona

**Sintomi:**
- Test microfono nelle impostazioni non funziona
- Nessun audio durante la collaborazione DJ
- Livello audio sempre a 0%
- Microfono risulta "abilitato" ma non funziona

**Soluzioni:**

#### A. Verifica Permessi Microfono
1. **Apri Preferenze di Sistema** > **Sicurezza e Privacy** > **Privacy**
2. **Seleziona "Microfono"** dal menu laterale
3. **Assicurati che DJ Console sia abilitato** (spunta verde)
4. Se non è presente, clicca il **"+"** e aggiungi DJ Console

#### B. Reset Permessi Microfono
Se il microfono non funziona nonostante i permessi:
```bash
# Reset completo dei permessi microfono
sudo tccutil reset Microphone
```
Poi riavvia DJ Console e accetta nuovamente i permessi.

#### C. Verifica Dispositivo Audio
1. **Apri Preferenze di Sistema** > **Suono**
2. **Tab "Input"** - verifica che il microfono built-in sia selezionato
3. **Testa il microfono** con altre applicazioni (QuickTime, GarageBand)

### 2. Fallback Automatico Implementato

La versione 1.4.29+ include un sistema di fallback robusto:

#### A. Livelli di Fallback
1. **Livello 1**: Dispositivo specifico dalle impostazioni
2. **Livello 2**: Dispositivo default con constraints standard
3. **Livello 3**: Constraints minimi (solo per macOS)

#### B. Logging Dettagliato
I log ora mostrano:
```
🎤 [SETTINGS] Test microfono locale avviato per: [device-id]
🎤 [SETTINGS] Tentativo con dispositivo specifico: [device-id]
⚠️ [SETTINGS] Dispositivo specifico fallito, provo con default
🎤 [SETTINGS] Stream ottenuto con dispositivo: default
🎤 [SETTINGS] Test microfono configurato: {
  requestedDeviceId: "...",
  actualDeviceUsed: "default",
  audioTracks: 1,
  readyState: "live",
  enabled: true,
  trackLabel: "Built-in Microphone",
  trackId: "...",
  trackSettings: {...}
}
```

### 3. Configurazione Raccomandata per macOS

#### A. Impostazioni Microfono
```
Input Device: Built-in Microphone (o il tuo microfono preferito)
Echo Cancellation: false (per macOS)
Noise Suppression: false (per macOS)
Auto Gain Control: false (per macOS)
Sample Rate: 44100 Hz
Channel Count: 1 (Mono)
```

#### B. Test del Microfono
1. **Vai su Impostazioni** > **Audio**
2. **Seleziona il microfono built-in**
3. **Clicca "Test Microfono"**
4. **Parla nel microfono** - dovresti vedere il livello salire
5. **Se non funziona**, il sistema proverà automaticamente i fallback

### 4. Debug Avanzato

#### A. Controlla i Log
Apri la Console di macOS e cerca:
```
🎤 [SETTINGS] Test microfono locale avviato
🎤 [RemoteDJHost] ===== CONFIGURAZIONE MICROFONO HOST =====
🎤 [RemoteDJClient] ===== CONFIGURAZIONE MICROFONO CLIENT =====
```

#### B. Verifica Dispositivi Disponibili
I log mostrano tutti i dispositivi audio disponibili:
```
🎤 [RemoteDJHost] Dispositivi audio input disponibili: 3
🎤 [RemoteDJHost] Dispositivo richiesto trovato: SÌ
🎤 [RemoteDJHost] Dispositivo richiesto: Built-in Microphone (device-id)
```

#### C. Test Manuale
Puoi testare manualmente il microfono:
```javascript
// Apri la Console del browser (F12)
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('Microfono funziona:', stream.getAudioTracks()[0].label)
    stream.getTracks().forEach(track => track.stop())
  })
  .catch(error => console.error('Errore microfono:', error))
```

### 5. Soluzioni Specifiche per Problemi Comuni

#### A. "NotAllowedError" o "Permission Denied"
- **Causa**: Permessi microfono negati
- **Soluzione**: Reset permessi e riaccetta

#### B. "NotFoundError" o "Device Not Found"
- **Causa**: Dispositivo non disponibile
- **Soluzione**: Il sistema proverà automaticamente il fallback

#### C. "NotReadableError" o "Device in Use"
- **Causa**: Microfono usato da un'altra app
- **Soluzione**: Chiudi altre app che usano il microfono

#### D. "OverconstrainedError"
- **Causa**: Constraints troppo restrittivi
- **Soluzione**: Il sistema proverà automaticamente constraints più semplici

### 6. Configurazione per Collaborazione DJ

#### A. Host (Computer Principale)
```
Microfono: Built-in Microphone
Fallback: Automatico a constraints minimi
Logging: Dettagliato per debug
```

#### B. Client (Mac Remoto)
```
Microfono: Built-in Microphone
Connessione: IP locale del host (es. 192.168.1.100:8080)
Fallback: Automatico a constraints minimi
```

### 7. Verifica Funzionamento

#### A. Test Completo
1. **Apri DJ Console**
2. **Vai su Impostazioni** > **Audio**
3. **Testa il microfono** - dovrebbe funzionare
4. **Avvia collaborazione DJ**
5. **Connetti un client** - dovrebbe sentire l'host
6. **Parla nel microfono** - dovrebbe essere trasmesso

#### B. Log di Successo
```
🎤 [SETTINGS] ✅ Fallback a constraints minimi completato
🎤 [RemoteDJHost] ✅ Dispositivo specifico utilizzato con successo
🎤 [RemoteDJClient] ✅ Fallback a dispositivo default completato
```

### 8. Contatti e Supporto

Se continui ad avere problemi:
1. **Controlla i log dettagliati** nella Console
2. **Verifica i permessi** nelle Preferenze di Sistema
3. **Testa con altre applicazioni** per escludere problemi hardware
4. **Prova con un microfono esterno** per confronto

La versione 1.4.29+ include correzioni specifiche per macOS e fallback automatici per garantire che il microfono funzioni sempre.
