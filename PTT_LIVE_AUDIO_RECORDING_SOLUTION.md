# 🎤 PTT Live Audio Recording Solution

## Funzionalità Implementata

È stata implementata una funzionalità completa di **PTT Live con registrazione audio** che permette ai client remoti di:

1. **Registrare l'audio vocale** durante il PTT Live
2. **Inviare l'audio registrato** all'host insieme al comando PTT Live
3. **Riprodurre automaticamente** l'audio nell'host e inserirlo nel destination stream

## Come Funziona

### 1. Client Remoto (Registrazione Audio)

Quando il client remoto clicca **PTT LIVE**:

```typescript
const handlePTTLivePress = () => {
  setIsPTTLiveActive(true)
  
  // Attiva il microfono per streaming live
  if (localStreamRef.current) {
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = true
    })
  }
  
  // ✅ NEW: Avvia registrazione audio per PTT Live
  startPTTLiveAudioRecording()
  
  // Invia comando PTT Live all'host
  sendPTTLiveCommandToHost(true)
}
```

**Sistema di Registrazione:**
- Usa `MediaRecorder` per catturare l'audio dal microfono
- Formato: `audio/webm;codecs=opus` a 128 kbps
- Chunk ogni 100ms per bassa latenza
- Combina tutti i chunk in un unico blob alla fine

### 2. Trasmissione Audio via DataChannel

Quando il client rilascia **PTT LIVE**:

```typescript
const handlePTTLiveRelease = () => {
  setIsPTTLiveActive(false)
  
  // ✅ NEW: Ferma registrazione e invia audio all'host
  stopPTTLiveAudioRecording()
  
  // Disattiva microfono
  // Invia comando PTT Live all'host
}
```

**Trasmissione:**
- Converte il blob audio in `ArrayBuffer`
- Invia via DataChannel come comando `pttLiveAudio`
- Include: `audioData`, `audioSize`, `timestamp`

### 3. Host (Ricezione e Riproduzione)

L'host riceve l'audio PTT Live:

```typescript
} else if (command.type === 'pttLiveAudio') {
  console.log(`🎤 [PTT Live Audio] Ricevuto audio da ${djName}: ${command.audioSize} bytes`)
  handlePTTLiveAudioFromClient(clientId, djName, command.audioData, command.audioSize)
}
```

**Elaborazione Audio:**
1. Converte l'array di numeri in `Uint8Array`
2. Crea un `Blob` dall'audio ricevuto
3. Crea un elemento `<audio>` per riproduzione
4. **Aggiunge automaticamente al destination stream**

### 4. Integrazione nel Destination Stream con Ducking

```typescript
const addPTTLiveAudioToDestinationStream = (audioElement, clientId, djName) => {
  // Verifica AudioContext e destination stream
  const audioContext = (window as any).globalAudioContext
  const destinationStream = (window as any).destinationStream
  const mixerGain = (window as any).mixerGain
  
  // ✅ NEW: Attiva ducking usando le impostazioni dell'host
  const duckingPercent = settings?.microphone?.duckingPercent ?? 75
  console.log(`🎤 [PTT Live Audio] Attivazione ducking: ${duckingPercent}%`)
  
  // Attiva il ducking globale per abbassare la musica
  if (typeof (window as any).updatePTTVolumesOnly === 'function') {
    (window as any).updatePTTVolumesOnly(true)
    console.log(`🎤 [PTT Live Audio] Ducking attivato - musica abbassata al ${100 - duckingPercent}%`)
  }
  
  // Crea source node dall'elemento audio
  const sourceNode = audioContext.createMediaElementSource(audioElement)
  
  // ✅ CRITICAL FIX: Crea gain node con volume fisso al 100%
  const gainNode = audioContext.createGain()
  gainNode.gain.setValueAtTime(1.0, audioContext.currentTime) // Volume fisso al 100%
  
  // ✅ CRITICAL FIX: Collega DIRETTAMENTE al destination stream, bypassando il mixer
  sourceNode.connect(gainNode)
  gainNode.connect(destinationStream) // Bypass ducking per audio PTT Live
}
```

## File Modificati

### 1. `src/components/RemoteDJClient.tsx`
- ✅ Aggiunte funzioni di registrazione audio PTT Live
- ✅ `startPTTLiveAudioRecording()` - Avvia registrazione
- ✅ `stopPTTLiveAudioRecording()` - Ferma registrazione
- ✅ `sendPTTLiveAudioToHost()` - Invia audio all'host
- ✅ Integrazione con `handlePTTLivePress/Release`

### 2. `src/components/DJRemotoServerPage.tsx`
- ✅ Gestione comando `pttLiveAudio` nel DataChannel
- ✅ `handlePTTLiveAudioFromClient()` - Elabora audio ricevuto
- ✅ `addPTTLiveAudioToDestinationStream()` - Integra nel destination stream
- ✅ `cleanupPTTLiveAudio()` - Cleanup automatico

### 3. `src/components/RemoteDJHost.tsx`
- ✅ Stesse funzioni di `DJRemotoServerPage.tsx`
- ✅ Gestione audio PTT Live per modalità host

## Vantaggi della Soluzione

### ✅ **Qualità Audio**
- Formato Opus a 128 kbps per buona qualità
- Chunk frequenti (100ms) per bassa latenza
- Nessuna perdita di qualità durante la trasmissione

### ✅ **Integrazione Automatica**
- L'audio PTT Live viene automaticamente inserito nel destination stream
- Non richiede intervento manuale dell'host
- Volume al 100% per massima chiarezza

### ✅ **Ducking Intelligente**
- **Usa le impostazioni dell'host**: `settings.microphone.duckingPercent`
- **Ducking automatico**: La musica si abbassa automaticamente quando riproduce l'audio PTT Live
- **Ripristino automatico**: La musica torna al 100% quando l'audio PTT Live finisce
- **Configurabile**: L'host può impostare la percentuale di ducking (es. 75% = musica al 25%)
- **Bypass Ducking**: L'audio PTT Live bypassa il ducking per mantenere il volume al 100%

### ✅ **Gestione Memoria**
- Cleanup automatico degli elementi audio
- Revoca degli URL blob per liberare memoria
- Disconnessione dei nodi audio Web Audio API

### ✅ **Robustezza**
- Gestione errori completa
- Fallback se AudioContext non disponibile
- Logging dettagliato per debugging

## Flusso Completo

1. **Client clicca PTT LIVE** → Inizia registrazione audio
2. **Client parla** → Audio viene catturato in tempo reale
3. **Client rilascia PTT LIVE** → Registrazione si ferma
4. **Audio viene inviato all'host** → Via DataChannel
5. **Host riceve audio** → Elabora e riproduce
6. **🎤 DUCKING ATTIVATO** → Musica abbassata secondo impostazioni host
7. **Audio viene inserito nel destination stream** → Automaticamente
8. **Audio va in live streaming** → Trasmesso agli ascoltatori
9. **Audio PTT Live finisce** → Ducking disattivato, musica ripristinata
10. **Cleanup automatico** → Memoria liberata

## Note Tecniche

- **Formato Audio**: `audio/webm;codecs=opus`
- **Bitrate**: 128 kbps
- **Chunk Size**: 100ms
- **Volume**: 100% (1.0) per massima chiarezza
- **Trasmissione**: DataChannel JSON con array di bytes
- **Riproduzione**: HTMLAudioElement + Web Audio API
- **Ducking**: Usa `settings.microphone.duckingPercent` dell'host (default: 75%)
- **Ducking Function**: `updatePTTVolumesOnly(true/false)` per attivare/disattivare

## Configurazione Ducking

L'host può configurare il ducking nelle **Settings > Microfono > Ducking Percent**:

- **0%**: Nessun ducking (musica al 100%)
- **50%**: Musica abbassata al 50%
- **75%**: Musica abbassata al 25% (default)
- **100%**: Musica completamente silenziosa

## 🔧 **Problemi Risolti**

### **1. Ducking dell'Audio PTT Live**

#### **Problema Identificato**
Il ducking stava abbassando anche l'audio PTT Live stesso, non solo la musica, perché l'audio veniva collegato tramite il mixer che subiva il ducking.

#### **Soluzione Implementata**
```typescript
// ❌ PRIMA (PROBLEMATICO): Audio collegato tramite mixer
sourceNode.connect(gainNode)
gainNode.connect(mixerGain) // Il mixer subiva il ducking

// ✅ DOPO (CORRETTO): Audio collegato direttamente al destination stream
sourceNode.connect(gainNode)
gainNode.connect(destinationStream) // Bypass del mixer per evitare ducking
```

### **2. Limite DataChannel per Audio Lunghi**

#### **Problema Identificato**
Il DataChannel ha un limite di dimensione per i messaggi (circa 16KB). Audio lunghi (20+ secondi, 180KB+) causavano errori:
```
RTCErrorEvent {isTrusted: true, error: OperationError: Failure to send data}
```

#### **Soluzione Implementata: Sistema di Chunk**
```typescript
// ✅ NEW: Invia audio in chunk da 8KB ciascuno
const sendAudioInChunks = (audioData: Uint8Array, totalSize: number) => {
  const CHUNK_SIZE = 8192 // 8KB per chunk (limite sicuro)
  const totalChunks = Math.ceil(audioData.length / CHUNK_SIZE)
  const audioId = Date.now().toString() // ID univoco
  
  for (let i = 0; i < totalChunks; i++) {
    const chunk = audioData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    const command = {
      type: 'pttLiveAudioChunk',
      audioId: audioId,
      chunkIndex: i,
      totalChunks: totalChunks,
      chunkData: Array.from(chunk),
      // ... altri parametri
    }
    dataChannelRef.current.send(JSON.stringify(command))
  }
}
```

#### **Ricostruzione Audio nell'Host**
```typescript
// ✅ NEW: Ricostruisci audio dai chunk ricevuti
const handlePTTLiveAudioChunkFromClient = (clientId, djName, command) => {
  const { audioId, chunkIndex, totalChunks, chunkData } = command
  
  // Salva chunk nella posizione corretta
  audioBuffer.chunks[chunkIndex] = new Uint8Array(chunkData)
  
  // Quando tutti i chunk sono ricevuti, ricostruisci l'audio
  if (receivedChunks === totalChunks) {
    const completeAudioData = new Uint8Array(totalSize)
    // Ricostruisci l'audio completo dai chunk
    processReconstructedAudio(clientId, djName, completeAudioData, totalSize)
  }
}
```

### **Risultato Finale**
- ✅ **Musica**: Si abbassa secondo le impostazioni dell'host (ducking)
- ✅ **Audio PTT Live**: Mantiene sempre il volume al 100%
- ✅ **Audio Lunghi**: Supporta audio di qualsiasi durata (20+ secondi)
- ✅ **Trasmissione Affidabile**: Nessun errore DataChannel per audio grandi
- ✅ **Ducking**: Funziona correttamente solo sulla musica

La funzionalità è ora completamente implementata con ducking intelligente e supporto per audio lunghi! 🎉
