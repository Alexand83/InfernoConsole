# Sistema di Aggiornamenti DJ Console

## Panoramica

Il sistema di aggiornamenti di DJ Console permette di verificare automaticamente la disponibilità di nuove versioni dell'applicazione. Supporta diversi tipi di sorgenti per gli aggiornamenti.

## Configurazione

### 1. File di Configurazione

Modifica il file `src/config/updateConfig.ts` per configurare il sistema:

```typescript
export const updateConfig = {
  // URL per verificare gli aggiornamenti
  updateUrl: 'https://api.github.com/repos/your-username/djconsole/releases/latest',
  
  // Versione attuale dell'applicazione
  currentVersion: '1.0.0',
  
  // Nome dell'applicazione
  appName: 'DJ Console',
  
  // Altri parametri...
}
```

### 2. Sorgenti Supportate

#### GitHub API (Raccomandato)
```typescript
updateUrl: 'https://api.github.com/repos/username/repo/releases/latest'
```

**Vantaggi:**
- Gratuito
- Affidabile
- Supporta rate limiting
- Formato JSON standardizzato

**Configurazione:**
1. Crea un repository GitHub per il tuo progetto
2. Crea una release con tag (es. `v1.0.1`)
3. Aggiorna l'URL nel file di configurazione

#### File JSON Personalizzato
```typescript
updateUrl: 'https://your-server.com/updates.json'
```

**Formato JSON richiesto:**
```json
{
  "version": "1.0.1",
  "releaseDate": "2024-12-20T10:00:00Z",
  "downloadUrl": "https://your-server.com/downloads/djconsole-1.0.1.zip",
  "changelog": [
    "Corretto bug nella sincronizzazione playlist",
    "Migliorata interfaccia utente",
    "Aggiunto supporto per nuovi formati audio"
  ],
  "minSystemVersion": "1.0.0",
  "critical": false
}
```

#### API Personalizzata
```typescript
updateUrl: 'https://your-api.com/check-updates'
```

**Endpoint richiesto:**
- **Method:** GET
- **Headers:** `Accept: application/json`
- **Response:** JSON con formato simile al file JSON personalizzato

## Implementazione

### 1. Creazione di una Release GitHub

1. Vai al tuo repository GitHub
2. Clicca su "Releases" → "Create a new release"
3. Crea un tag (es. `v1.0.1`)
4. Compila titolo e descrizione
5. Aggiungi file binari se necessario
6. Pubblica la release

### 2. Configurazione del Server

Se usi un server personalizzato, crea un endpoint che restituisca informazioni sugli aggiornamenti:

```javascript
// Esempio Express.js
app.get('/api/updates', (req, res) => {
  const currentVersion = req.headers['user-agent'].match(/DJ Console ([\d.]+)/)?.[1] || '1.0.0'
  
  res.json({
    version: '1.0.1',
    releaseDate: '2024-12-20T10:00:00Z',
    downloadUrl: 'https://your-server.com/downloads/djconsole-1.0.1.zip',
    changelog: [
      'Nuove funzionalità',
      'Correzioni bug'
    ],
    isNewer: compareVersions('1.0.1', currentVersion) > 0
  })
})
```

### 3. Configurazione dell'URL

L'utente può configurare l'URL degli aggiornamenti direttamente dall'interfaccia:

1. Vai a Settings → Info
2. Clicca su "Configura" nel pannello aggiornamenti
3. Inserisci l'URL desiderato
4. Clicca su "Verifica Aggiornamenti"

## Funzionalità

### Verifica Manuale
- Pulsante "Verifica Aggiornamenti" per controllo immediato
- Mostra data e ora dell'ultima verifica
- Gestione errori con messaggi informativi

### Verifica Automatica (Opzionale)
```typescript
// Abilita verifica automatica ogni ora
checkInterval: 3600000
```

### Notifiche
- Notifica quando sono disponibili aggiornamenti
- Distingue tra aggiornamenti normali e critici
- Mostra changelog completo

### Gestione Errori
- Timeout per richieste lente
- Retry automatico per errori temporanei
- Fallback a configurazione di default

## Sicurezza

### Rate Limiting
- Rispetta i limiti di GitHub API (60 richieste/ora senza token)
- Usa token GitHub per aumentare il limite (5000 richieste/ora)

### Validazione
- Verifica formato delle versioni
- Controlla validità degli URL
- Sanitizza input utente

### Privacy
- Non invia dati personali
- Solo User-Agent con versione app
- Nessun tracking o analytics

## Troubleshooting

### Errori Comuni

**"URL aggiornamenti non configurato"**
- Verifica che l'URL sia impostato in `updateConfig.ts`
- Controlla che l'URL sia valido

**"HTTP 404: Not Found"**
- Verifica che il repository GitHub esista
- Controlla che ci sia almeno una release pubblicata

**"HTTP 403: Forbidden"**
- Aggiungi un token GitHub per aumentare il rate limit
- Verifica i permessi del repository

**"Errore di rete"**
- Controlla la connessione internet
- Verifica che l'URL sia raggiungibile

### Debug

Abilita i log della console per vedere dettagli:
```javascript
console.log('🔄 Checking for updates from:', url)
console.log('✅ Update check completed:', updateData)
```

## Esempi Pratici

### Esempio 1: GitHub Repository
```typescript
// Configurazione per repository GitHub
updateUrl: 'https://api.github.com/repos/mario-rossi/djconsole/releases/latest'
```

### Esempio 2: Server Personale
```typescript
// Configurazione per server personale
updateUrl: 'https://mario-rossi.com/api/djconsole/updates'
```

### Esempio 3: File Statico
```typescript
// Configurazione per file JSON statico
updateUrl: 'https://mario-rossi.com/djconsole/updates.json'
```

## Supporto

Per problemi o domande:
1. Controlla i log della console
2. Verifica la configurazione dell'URL
3. Testa l'URL manualmente nel browser
4. Controlla la documentazione della sorgente scelta
