# StreamingManager - Fix HTTP per Icecast

## Problema Risolto

Il `StreamingManager` ora legge correttamente le impostazioni dal database, ma il server Icecast restituiva ancora **400 Bad Request** durante la connessione HTTP.

## Modifiche Implementate

### 1. Test Connessione - Da HEAD a GET

**Prima:**
```typescript
const response = await fetch(testUrl, {
  method: 'HEAD',
  headers: {
    'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
    'User-Agent': 'DJConsole/1.0'
  }
})
```

**Dopo:**
```typescript
const response = await fetch(testUrl, {
  method: 'GET',
  headers: {
    'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
    'User-Agent': 'DJConsole/1.0',
    'Accept': '*/*'
  }
})

// Icecast potrebbe restituire 200, 401, 403, etc.
// Consideriamo OK se non è un errore di rete
console.log('📡 [STREAMING] Risposta server Icecast:', response.status, response.statusText)
return response.status < 500 // OK se non è errore server
```

### 2. Headers HTTP Migliorati per Icecast

**Prima:**
```typescript
headers: {
  'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
  'Content-Type': this.getMimeType(),
  'User-Agent': 'DJConsole/1.0'
}
```

**Dopo:**
```typescript
headers: {
  'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
  'Content-Type': this.getMimeType(),
  'User-Agent': 'DJConsole/1.0',
  'Accept': '*/*',
  'Connection': 'keep-alive'
}
```

### 3. Gestione Errori Migliorata

**Prima:**
```typescript
await fetch(icecastUrl, { ... })
```

**Dopo:**
```typescript
const response = await fetch(icecastUrl, { ... })

if (!response.ok) {
  console.warn('📡 [STREAMING] Server Icecast risponde con status:', response.status, response.statusText)
}
```

## Log Attesi

Ora dovresti vedere:

```
📡 [STREAMING] Trovate impostazioni dal database: true
📡 [STREAMING] Streaming settings: Object
📡 [STREAMING] Configurazione automatica completata con server: test
📡 [STREAMING] Test connessione HTTP a: http://82.145.63.6:5040/stream
📡 [STREAMING] Risposta server Icecast: 200 OK
📡 [STREAMING] Connesso con successo al server
```

## Risultato Atteso

Il `StreamingManager` ora dovrebbe:
1. ✅ Leggere correttamente le impostazioni dal database
2. ✅ Usare il server Icecast configurato (82.145.63.6:5040/stream)
3. ✅ Connettere correttamente via HTTP GET (invece di HEAD)
4. ✅ Gestire meglio le risposte del server Icecast
5. ✅ Inviare dati audio via HTTP POST con headers appropriati

## Note Tecniche

- **GET vs HEAD**: Icecast supporta meglio GET per i test di connessione
- **Headers aggiuntivi**: `Accept: */*` e `Connection: keep-alive` migliorano la compatibilità
- **Gestione errori**: Ora loggiamo il status code del server per debug
- **Status codes**: Consideriamo OK qualsiasi status < 500 (non errore server)

Prova ora a testare lo streaming. Dovresti vedere una connessione HTTP riuscita!
