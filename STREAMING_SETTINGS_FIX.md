# StreamingManager - Fix Lettura Impostazioni

## Problema Risolto

Il `StreamingManager` non riusciva a leggere le impostazioni dal `SettingsContext`, causando:
- `📡 [STREAMING] Nessuna impostazione trovata`
- `📡 [STREAMING] Impossibile ottenere impostazioni - uso configurazione di default`
- Errore **400 Bad Request** dal server Icecast

## Modifiche Implementate

### 1. Metodo `getSettingsFromContext()` - Riscritto Completamente

**Prima:**
```typescript
private getSettingsFromContext(): any {
  // Cerca in window.settings, localStorage, etc.
  // Metodo sincrono che non funzionava
}
```

**Dopo:**
```typescript
private async getSettingsFromContext(): Promise<any> {
  try {
    // Importa il database locale dinamicamente
    const { localDatabase } = await import('../database/LocalDatabase')
    
    // Attendi che il database sia inizializzato
    await localDatabase.waitForInitialization()
    
    // Ottieni le impostazioni dal database
    const settings = await localDatabase.getSettings()
    
    if (settings) {
      console.log('📡 [STREAMING] Trovate impostazioni dal database:', !!settings)
      console.log('📡 [STREAMING] Streaming settings:', settings.streaming)
      return settings
    } else {
      console.log('📡 [STREAMING] Nessuna impostazione trovata nel database')
      return null
    }
    
  } catch (error) {
    console.error('📡 [STREAMING] Errore lettura impostazioni dal database:', error)
    return null
  }
}
```

### 2. Metodo `configureFromSettings()` - Aggiornato per Usare Struttura Corretta

**Prima:**
```typescript
configureFromSettings(): void {
  const settings = this.getSettingsFromContext() // Sincrono
  // Cercava settings.icecastHost, settings.icecastPort, etc.
}
```

**Dopo:**
```typescript
async configureFromSettings(): Promise<void> {
  const settings = await this.getSettingsFromContext() // Asincrono
  
  if (settings && settings.streaming) {
    // Usa il server di default dalle impostazioni
    const defaultServerId = settings.streaming.defaultIcecastServerId || 'default-server'
    const defaultServer = settings.streaming.icecastServers?.find((server: any) => server.id === defaultServerId)
    
    if (defaultServer) {
      const config: StreamingConfig = {
        server: {
          id: defaultServer.id,
          name: defaultServer.name,
          host: defaultServer.host,
          port: defaultServer.port,
          username: defaultServer.username,
          password: defaultServer.password,
          mountpoint: defaultServer.mount,
          isDefault: defaultServer.isDefault || false
        },
        format: settings.streaming.defaultFormat || 'mp3',
        bitrate: settings.streaming.defaultBitrate || 128,
        sampleRate: settings.audio?.sampleRate || 44100,
        channels: settings.streaming.channels || 2
      }
      
      this.setConfig(config)
      console.log('📡 [STREAMING] Configurazione automatica completata con server:', defaultServer.name)
    }
  }
}
```

### 3. Chiamate Asincrone - Aggiornate

**Prima:**
```typescript
streamingManager.configureFromSettings() // Sincrono
```

**Dopo:**
```typescript
streamingManager.configureFromSettings().catch(error => {
  console.error('📡 [STREAMING] Errore configurazione iniziale:', error)
})
```

## Struttura Impostazioni Corretta

Il `StreamingManager` ora legge correttamente le impostazioni dal `LocalDatabase`:

```typescript
interface DatabaseSettings {
  streaming: {
    defaultBitrate: number
    defaultFormat: 'mp3' | 'opus' | 'aac' | 'ogg'
    channels: number
    autoConnect: boolean
    reconnectAttempts: number
    icecastServers: IcecastServer[]  // ✅ MULTIPLI SERVER
    defaultIcecastServerId?: string  // ✅ SERVER DI DEFAULT
    metadata: {
      stationName: string
      stationUrl: string
      genre: string
      djName: string
    }
  }
}
```

## Risultato Atteso

Ora il `StreamingManager` dovrebbe:
1. ✅ Leggere correttamente le impostazioni dal database
2. ✅ Usare il server Icecast di default configurato
3. ✅ Connettere correttamente al server Icecast via HTTP
4. ✅ Mostrare i log di configurazione corretti

## Log Attesi

```
📡 [STREAMING] Trovate impostazioni dal database: true
📡 [STREAMING] Streaming settings: {defaultBitrate: 128, defaultFormat: 'opus', ...}
📡 [STREAMING] Configurazione automatica completata con server: RadioBoss Server
📡 [STREAMING] Test connessione HTTP a: http://82.145.63.6:5040/stream
📡 [STREAMING] Connesso a Icecast via HTTP
```
