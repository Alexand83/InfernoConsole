# StreamingManager - Fix WebSocket → HTTP per Icecast

## 🚨 Problema Identificato

**Errore**: `WebSocket connection to 'ws://source:811126864dj@82.145.63.6:5040/stream' failed: Error during WebSocket handshake: Unexpected response code: 404`

**Causa**: Icecast **NON supporta WebSocket** - funziona solo con **HTTP** per:
- Invio dati audio (HTTP POST)
- Invio metadata (HTTP GET)

## ✅ Soluzione Implementata

### 1. **Connessione HTTP invece di WebSocket**

**Prima (WebSocket - SBAGLIATO)**:
```typescript
const wsUrl = `ws://${username}:${password}@${host}:${port}${mountpoint}`
this.icecastSocket = new WebSocket(wsUrl)
```

**Dopo (HTTP - CORRETTO)**:
```typescript
const httpUrl = `http://${host}:${port}${mountpoint}`
const response = await fetch(httpUrl, {
  method: 'HEAD',
  headers: {
    'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
    'User-Agent': 'DJConsole/1.0'
  }
})
```

### 2. **Invio Dati Audio via HTTP POST**

**Prima (WebSocket - SBAGLIATO)**:
```typescript
this.mediaRecorder.ondataavailable = (event) => {
  if (this.icecastSocket?.readyState === WebSocket.OPEN) {
    this.icecastSocket.send(event.data)
  }
}
```

**Dopo (HTTP - CORRETTO)**:
```typescript
this.mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    this.sendAudioDataToIcecast(event.data)
  }
}

private async sendAudioDataToIcecast(audioData: Blob): Promise<void> {
  await fetch(icecastUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
      'Content-Type': this.getMimeType(),
      'User-Agent': 'DJConsole/1.0'
    },
    body: audioData
  })
}
```

### 3. **Test Connessione HTTP**

**Prima (WebSocket - SBAGLIATO)**:
```typescript
const ws = new WebSocket(testUrl)
ws.onopen = () => resolve(true)
ws.onerror = () => resolve(false)
```

**Dopo (HTTP - CORRETTO)**:
```typescript
const response = await fetch(testUrl, {
  method: 'HEAD',
  headers: {
    'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
    'User-Agent': 'DJConsole/1.0'
  }
})
return response.ok
```

## 🔧 Modifiche Tecniche

### File Modificati
- `src/audio/StreamingManager.ts`

### Metodi Aggiornati
- `connectToIcecast()` - Ora usa HTTP HEAD per testare connessione
- `testConnection()` - Ora usa HTTP HEAD invece di WebSocket
- `sendAudioDataToIcecast()` - **NUOVO** - Invia dati audio via HTTP POST
- `disconnect()` - Rimosso codice WebSocket per Icecast

### Proprietà Rimosse
- `private icecastSocket: WebSocket | null` - Non più necessaria

### Proprietà Mantenute
- `private wsConnection: WebSocket | null` - Per bridge (se necessario)
- Tutte le altre proprietà audio (AudioContext, MediaRecorder, etc.)

## 🎯 Protocollo Icecast Corretto

### 1. **Connessione**
```
HTTP HEAD /stream
Authorization: Basic base64(username:password)
User-Agent: DJConsole/1.0
```

### 2. **Invio Audio**
```
HTTP POST /stream
Authorization: Basic base64(username:password)
Content-Type: audio/mpeg
User-Agent: DJConsole/1.0

[Binary Audio Data]
```

### 3. **Invio Metadata**
```
HTTP GET /admin/metadata?mount=/stream&mode=updinfo&song=Title - Artist
Authorization: Basic base64(username:password)
```

## 🚀 Risultato Atteso

Ora il `StreamingManager` dovrebbe:

✅ **Connettersi correttamente** a Icecast via HTTP
✅ **Inviare dati audio** via HTTP POST
✅ **Inviare metadata** via HTTP GET
✅ **Mantenere il volume al 100%** come richiesto
✅ **Sincronizzarsi automaticamente** con i controlli audio

## 🔍 Test da Eseguire

1. **Test Connessione**: Verificare che non ci sia più errore 404
2. **Test Streaming**: Verificare che l'audio venga trasmesso
3. **Test Metadata**: Verificare che i metadata vengano aggiornati
4. **Test Volume**: Verificare che lo streaming sia sempre al 100%

## 📝 Note Importanti

- **Icecast usa solo HTTP**, mai WebSocket
- **WebSocket è per bridge/relay**, non per Icecast diretto
- **HTTP POST** per dati audio in tempo reale
- **HTTP GET** per metadata e controllo
- **Autenticazione Basic** sempre richiesta

**Ora il streaming dovrebbe funzionare correttamente! 🎵📡**
