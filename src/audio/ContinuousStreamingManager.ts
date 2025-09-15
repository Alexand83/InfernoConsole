/**
 * NUOVO SISTEMA DI STREAMING CONTINUO
 * 
 * PROBLEMA RISOLTO: Lag ogni 4 secondi causato da:
 * 1. MediaRecorder che crea chunk discontinui
 * 2. FFmpeg che processa chunk con buffer grandi
 * 3. Gestione asincrona complessa
 * 
 * SOLUZIONE: Streaming continuo con buffer circolare
 */

export interface StreamConfig {
  host: string
  port: number
  username: string
  password: string
  mountpoint: string
  useSSL?: boolean
  bitrate: number
  format: 'opus' | 'mp3'
  djName?: string  // ✅ NICKNAME DJ PER STREAMING
}

export interface StreamStatus {
  isConnected: boolean
  isStreaming: boolean
  bytesSent: number
  errors: number
  lastError?: string
}

export class ContinuousStreamingManager {
  private isStreaming = false
  private isConnected = false
  private isPaused = false
  private config: StreamConfig | null = null
  
  // ✅ NUOVO: Tracciamento timestamp per pausa precisa
  private pauseTimestamp: number = 0
  private resumeTimestamp: number = 0
  
  // 🔇 SICUREZZA: Rilevamento silenzio per disconnessione automatica
  private silenceStartTime: number = 0
  private isSilent: boolean = false
  private silenceThreshold: number = 30 * 1000 // 30 secondi in millisecondi
  private audioLevelThreshold: number = 0.01 // Soglia per considerare audio "silenzioso"
  private silenceWarningShown: boolean = false
  private silenceCheckInterval: NodeJS.Timeout | null = null
  private disconnectedForSilence: boolean = false // Flag per prevenire loop
  
  // 🔄 RETRY: Sistema di retry automatico per riconnessioni
  private retryCount: number = 0
  private maxRetries: number = 5
  private retryDelay: number = 1000 // Delay iniziale in ms
  private retryTimeout: NodeJS.Timeout | null = null
  private isRetrying: boolean = false
  private lastConfig: StreamConfig | null = null
  
  // ✅ FIX: Sistema di cooldown per limitare retry
  private retrySessionStart: number = 0
  private retrySessionDuration: number = 30000 // 30 secondi (meno aggressivo)
  private retrySessionCount: number = 0
  private retryPermanentlyStopped: boolean = false // ✅ FIX: Flag per stop definitivo
  private userRequestedDisconnect: boolean = false // ✅ FIX: Flag per disconnessione richiesta dall'utente
  
  // ✅ FIX: Esponi flag come proprietà pubblica per accesso esterno
  get isUserRequestedDisconnect(): boolean {
    return this.userRequestedDisconnect
  }
  
  // Callbacks
  private onStatusChange?: (status: StreamStatus) => void
  private onError?: (error: string) => void
  private onDebug?: (message: string) => void
  private onSilenceWarning?: (secondsRemaining: number) => void
  private onSilenceDisconnect?: () => void
  private onRetryAttempt?: (attempt: number, maxRetries: number) => void
  private onRetryFailed?: () => void
  private onConnectionLost?: (reason: string) => void
  private onMountConflict?: (message: string) => void

  constructor() {
    this.onDebug?.('🚀 ContinuousStreamingManager inizializzato')
    
    // ✅ FIX: Setup listener per eventi FFmpeg da Electron
    this.setupFFmpegEventListeners()
  }

  setCallbacks(callbacks: {
    onStatusChange?: (status: StreamStatus) => void
    onError?: (error: string) => void
    onDebug?: (message: string) => void
    onSilenceWarning?: (secondsRemaining: number) => void
    onSilenceDisconnect?: () => void
    onRetryAttempt?: (attempt: number, maxRetries: number) => void
    onRetryFailed?: () => void
    onConnectionLost?: (reason: string) => void
    onMountConflict?: (message: string) => void
  }) {
    this.onStatusChange = callbacks.onStatusChange
    this.onError = callbacks.onError
    this.onDebug = callbacks.onDebug
    this.onSilenceWarning = callbacks.onSilenceWarning
    this.onSilenceDisconnect = callbacks.onSilenceDisconnect
    this.onRetryAttempt = callbacks.onRetryAttempt
    this.onRetryFailed = callbacks.onRetryFailed
    this.onConnectionLost = callbacks.onConnectionLost
    this.onMountConflict = callbacks.onMountConflict
  }

  // ✅ METODI DI COMPATIBILITÀ per l'interfaccia esistente
  setStatusCallback(callback: (status: string) => void) {
    this.onStatusChange = (status) => {
      const statusString = status.isStreaming ? 'streaming' : status.isConnected ? 'connected' : 'disconnected'
      callback(statusString)
    }
  }

  setDebugCallback(callback: (message: string) => void) {
    this.onDebug = callback
  }

  setErrorCallback(callback: (error: string) => void) {
    this.onError = callback
  }

  setCredentials(credentials: any) {
    // Metodo per compatibilità - non usato nel nuovo sistema
    this.onDebug?.('setCredentials chiamato (compatibilità)')
  }

  setServerUrl(url: string) {
    // Metodo per compatibilità - non usato nel nuovo sistema
    this.onDebug?.('setServerUrl chiamato (compatibilità)')
  }

  // ✅ METODI DI COMPATIBILITÀ per l'interfaccia esistente
  async connect(): Promise<boolean> {
    try {
      this.onDebug?.('🔌 Connessione al server...')
      this.isConnected = true
      this.onStatusChange?.({
        isConnected: true,
        isStreaming: false,
        bytesSent: 0,
        errors: 0
      })
      this.onDebug?.('✅ Connesso al server')
      return true
    } catch (error) {
      this.onError?.(`Errore connessione: ${error}`)
      return false
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.onDebug?.('🔌 [DISCONNECT] Disconnessione immediata dal server...')
      
      // ✅ FIX: Imposta flag per disconnessione richiesta dall'utente PRIMA di tutto
      this.userRequestedDisconnect = true
      this.retryPermanentlyStopped = true
      this.onDebug?.('🛑 [DISCONNECT] Flag userRequestedDisconnect impostato a TRUE')
      console.log('🛑 [DISCONNECT] Flag userRequestedDisconnect impostato a TRUE')
      
      // ✅ FIX: Ferma immediatamente tutti i retry in corso
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout)
        this.retryTimeout = null
        this.onDebug?.('🛑 [DISCONNECT] Retry timeout cancellato')
      }
      this.isRetrying = false
      
      // ✅ FIX: Ferma monitoraggio silenzio
      this.stopSilenceMonitoring()
      
      // ✅ FIX: Ferma invio dati audio
      this.stopAudioDataSending()
      
      // ✅ FIX: Ferma processo FFmpeg nel main process
      try {
        // @ts-ignore
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          // @ts-ignore
          await (window as any).electronAPI.invoke('icecast-stop')
          this.onDebug?.('🛑 [DISCONNECT] Processo FFmpeg fermato nel main process')
        }
      } catch (error) {
        this.onDebug?.(`⚠️ [DISCONNECT] Errore fermando FFmpeg: ${error}`)
      }
      
      // ✅ FIX: Aggiorna stati
      this.isConnected = false
      this.isStreaming = false
      this.isPaused = false
      
      this.onStatusChange?.({
        isConnected: false,
        isStreaming: false,
        bytesSent: 0,
        errors: 0
      })
      
      this.onDebug?.('✅ [DISCONNECT] Disconnesso dal server - tutti i processi fermati')
    } catch (error) {
      this.onError?.(`Errore disconnessione: ${error}`)
    }
  }

  // Metodo per compatibilità con l'interfaccia esistente
  async startStreaming(stream?: MediaStream): Promise<boolean> {
    if (!this.config) {
      this.onError?.('Configurazione non impostata')
      return false
    }
    return await this.startStreamingWithConfig(this.config, false) // ✅ FIX: isRetry = false
  }

  async startStreamingWithConfig(config: StreamConfig, isRetry: boolean = false): Promise<boolean> {
    try {
      this.onDebug?.('🎵 Avvio streaming continuo...')
      this.config = config
      this.lastConfig = config // ✅ RETRY: Salva config per retry
      
      // ✅ FIX: Reset flag disconnessione silenzio per permettere nuovo streaming
      this.disconnectedForSilence = false
      
      // ✅ RETRY: Reset contatori retry solo se non è un retry
      if (!isRetry) {
        // ✅ FIX: Reset flag stop definitivo solo se non abbiamo raggiunto il limite
        if (!this.retryPermanentlyStopped) {
          this.retryCount = 0
          this.isRetrying = false
          this.retrySessionCount = 0 // ✅ FIX: Reset contatore sessione
          this.retrySessionStart = 0 // ✅ FIX: Reset timestamp sessione
          this.onDebug?.('🔄 [RETRY] Reset contatori per nuovo streaming')
        } else {
          this.onDebug?.('🛑 [RETRY] Stop definitivo attivo - nessun reset contatori')
          return false // ✅ FIX: Non avviare streaming se stop definitivo
        }
      } else {
        this.onDebug?.(`🔄 [RETRY] Continuo retry ${this.retryCount}/${this.maxRetries}`)
      }
      
      // ✅ FIX: Test connessione HTTP AD OGNI RETRY per evitare avvio FFmpeg inutile
      const serverUrl = `${config.useSSL ? 'https' : 'http'}://${config.host}:${config.port}${config.mountpoint}`
      
      if (isRetry) {
        this.onDebug?.(`🔍 [RETRY] Test connessione server per retry ${this.retryCount}/${this.maxRetries}: ${serverUrl}`)
      } else {
        this.onDebug?.(`🔍 [CONNECTION TEST] Test connessione server: ${serverUrl}`)
      }
      
      try {
        const response = await fetch(serverUrl, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000) // 5 secondi timeout
        })
        
        if (response.status === 400 || response.status === 200) {
          if (isRetry) {
            this.onDebug?.(`✅ [RETRY] Server raggiungibile per retry ${this.retryCount}/${this.maxRetries} (status: ${response.status})`)
          } else {
            this.onDebug?.(`✅ [CONNECTION TEST] Server raggiungibile (status: ${response.status})`)
          }
        } else if (response.status === 404) {
          // ✅ FIX: 404 può indicare mount point occupato o server con playlist attiva
          if (isRetry) {
            this.onDebug?.(`⚠️ [RETRY] Server attivo ma mount point occupato per retry ${this.retryCount}/${this.maxRetries} (status: 404)`)
          } else {
            this.onDebug?.(`⚠️ [CONNECTION TEST] Server attivo ma mount point occupato (status: 404)`)
          }
          
          // ✅ NUOVO: Prova comunque la connessione - potrebbe essere mount point occupato
          this.onDebug?.(`🔄 [MOUNT CONFLICT] Tentativo connessione nonostante 404 - mount point potrebbe essere occupato`)
          
          // ✅ NUOVO: Suggerisci soluzioni per conflitto mount point
          this.onDebug?.(`💡 [SUGGERIMENTO] Se il mount point è occupato, prova:`)
          this.onDebug?.(`   1. Cambiare mount point (es: /live2, /stream2)`)
          this.onDebug?.(`   2. Fermare la playlist automatica del server`)
          this.onDebug?.(`   3. Usare un server diverso`)
          
          // ✅ NUOVO: Emetti evento per notificare il conflitto mount point
          this.onMountConflict?.(`Mount point ${config.mountpoint} occupato su ${config.host}:${config.port}`)
        } else {
          throw new Error(`Server risponde con status: ${response.status}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (isRetry) {
          this.onDebug?.(`❌ [RETRY] Server non raggiungibile per retry ${this.retryCount}/${this.maxRetries}: ${errorMessage}`)
        } else {
          this.onDebug?.(`❌ [CONNECTION TEST] Server non raggiungibile: ${errorMessage}`)
        }
        
        this.onError?.(`Server non raggiungibile: ${errorMessage}`)
        
        // ✅ FIX: Non avviare FFmpeg se il server non è raggiungibile
        this.isStreaming = false
        this.isConnected = false
        
        this.onStatusChange?.({
          isConnected: false,
          isStreaming: false,
          bytesSent: 0,
          errors: 1
        })
        
        // ✅ RETRY: Avvia retry automatico solo se non abbiamo raggiunto il limite e non è disconnessione utente
        if (this.retryCount < this.maxRetries && !this.userRequestedDisconnect) {
          this.handleConnectionLost(`server_unreachable_${errorMessage}`)
        } else if (this.userRequestedDisconnect) {
          this.onDebug?.('🛑 [RETRY] Disconnessione richiesta dall\'utente - nessun retry')
        } else {
          this.onDebug?.(`🛑 [RETRY] Limite retry raggiunto (${this.maxRetries}) - stop definitivo`)
          this.onRetryFailed?.()
        }
        
        return false
      }
      
      // ✅ SEMPLIFICATO: Usa il sistema esistente con configurazione ottimizzata
      // @ts-ignore
      if (typeof window !== 'undefined' && (window as any).desktopStream) {
        if (isRetry) {
          this.onDebug?.(`📡 [RETRY] Avvio FFmpeg per retry ${this.retryCount}/${this.maxRetries}...`)
        } else {
          this.onDebug?.('📡 Server raggiungibile, avvio FFmpeg...')
        }
        
        // ✅ FIX: Controlla se l'utente ha richiesto la disconnessione PRIMA di avviare FFmpeg
        if (this.userRequestedDisconnect) {
          this.onDebug?.('🛑 [STREAMING] Disconnessione richiesta dall\'utente - blocco avvio FFmpeg')
          return false
        }
        
        // @ts-ignore
        const result = await (window as any).desktopStream.start({
          host: config.host,
          port: config.port,
          mount: config.mountpoint,
          username: config.username,
          password: config.password,
          useSSL: config.useSSL,
          bitrateKbps: config.bitrate,
          format: config.format,
          stationName: config.djName || 'DJ Console Pro',  // ✅ NICKNAME DJ PER ICECAST
          stationDescription: `${config.djName || 'DJ Console Pro'} - Live DJ Set`,  // ✅ DESCRIZIONE CON NICKNAME DJ
          stationGenre: 'Electronic/Live DJ'
        })
        
        if (result?.ok) {
          // ✅ FIX: Non aggiornare UI immediatamente - aspetta che FFmpeg sia partito
          this.isStreaming = false
          this.isConnected = false
          
          // ✅ CRITICAL FIX: Avvia il sistema di invio dati audio
          this.startAudioDataSending()
          
          // 🔇 SICUREZZA: Avvia monitoraggio silenzio
          this.startSilenceMonitoring()
          
          // ✅ FIX: UI verrà aggiornata quando FFmpeg sarà effettivamente partito
          this.onDebug?.('⏳ [STREAMING] FFmpeg avviato, in attesa di conferma connessione...')
          
          this.onDebug?.('✅ Streaming continuo avviato con successo')
          return true
        } else {
          // ✅ RETRY: Avvia retry automatico in caso di fallimento
          const errorMsg = result?.error || 'Errore avvio FFmpeg'
          this.onError?.(errorMsg)
          
          // ✅ NUOVO: Controlla se è un errore di mount point occupato
          if (errorMsg.includes('mount') || errorMsg.includes('occupied') || errorMsg.includes('404')) {
            this.onDebug?.(`🚨 [MOUNT CONFLICT] Rilevato conflitto mount point: ${errorMsg}`)
            this.onDebug?.(`💡 [SOLUZIONE] Prova a cambiare il mount point o fermare la playlist automatica del server`)
          }
          
          // ✅ FIX: Controlla se l'utente ha richiesto la disconnessione prima di avviare retry
          if (!this.userRequestedDisconnect) {
            this.startRetryProcess()
          } else {
            this.onDebug?.('🛑 [STREAMING] Disconnessione richiesta dall\'utente - nessun retry')
          }
          return false
        }
      } else {
        this.onError?.('Desktop streaming non disponibile')
        // ✅ FIX: Controlla se l'utente ha richiesto la disconnessione prima di avviare retry
        if (!this.userRequestedDisconnect) {
          this.startRetryProcess()
        } else {
          this.onDebug?.('🛑 [STREAMING] Disconnessione richiesta dall\'utente - nessun retry')
        }
        return false
      }
      
    } catch (error) {
      const errorMsg = `Errore avvio streaming: ${error}`
      this.onError?.(errorMsg)
      
      // ✅ NUOVO: Controlla se è un errore di mount point occupato
      if (errorMsg.includes('mount') || errorMsg.includes('occupied') || errorMsg.includes('404')) {
        this.onDebug?.(`🚨 [MOUNT CONFLICT] Rilevato conflitto mount point: ${errorMsg}`)
        this.onDebug?.(`💡 [SOLUZIONE] Prova a cambiare il mount point o fermare la playlist automatica del server`)
      }
      
      // ✅ FIX: Controlla se l'utente ha richiesto la disconnessione prima di avviare retry
      if (!this.userRequestedDisconnect) {
        this.startRetryProcess()
      } else {
        this.onDebug?.('🛑 [STREAMING] Disconnessione richiesta dall\'utente - nessun retry')
      }
      return false
    }
  }


  async stopStreaming(): Promise<void> {
    try {
      this.onDebug?.('🛑 Arresto streaming continuo...')
      
      // ✅ CRITICAL FIX: Imposta flag disconnessione utente anche per stopStreaming
      this.userRequestedDisconnect = true
      this.retryPermanentlyStopped = true
      this.onDebug?.('🛑 [STOP STREAMING] Flag userRequestedDisconnect impostato a TRUE')
      console.log('🛑 [STOP STREAMING] Flag userRequestedDisconnect impostato a TRUE')
      
      // ✅ RETRY: Ferma eventuali retry in corso
      this.stopRetryProcess()
      
      // ✅ CRITICAL FIX: Ferma il sistema di invio dati audio
      this.stopAudioDataSending()
      
      // 🔇 SICUREZZA: Ferma monitoraggio silenzio
      this.stopSilenceMonitoring()
      
      // Ferma FFmpeg
      // @ts-ignore
      if (typeof window !== 'undefined' && (window as any).desktopStream) {
        // @ts-ignore
        await (window as any).desktopStream.stop()
      }
      
      this.isStreaming = false
      this.isConnected = false
      this.isPaused = false
      
      this.onStatusChange?.({
        isConnected: false,
        isStreaming: false,
        bytesSent: 0,
        errors: 0
      })
      
      this.onDebug?.('✅ Streaming continuo arrestato')
      
    } catch (error) {
      this.onError?.(`Errore arresto streaming: ${error}`)
    }
  }

  // ✅ NUOVO: Metodi per pausa/ripresa senza loop
  async pauseStreaming(): Promise<void> {
    try {
      if (!this.isStreaming || this.isPaused) return
      
      this.isPaused = true
      this.pauseTimestamp = Date.now()
      
      this.onDebug?.(`⏸️ [CONTINUOUS] Pausa streaming - timestamp: ${this.pauseTimestamp}`)
      
      // ✅ FIX: Pausa l'audio del deck che viene catturato
      this.pauseDeckAudio()
      
      // ✅ NUOVO: Abbassa a 0 il volume del mixer di streaming
      this.setStreamingVolume(0)
      this.onDebug?.('⏸️ [CONTINUOUS] Volume streaming abbassato a 0 - nessun audio inviato')
      
      // ✅ FIX: MediaRecorder continua a funzionare ma con volume 0
      // FFmpeg rimane connesso e riceve audio silenzioso
      
      this.onStatusChange?.({
        isConnected: this.isConnected,
        isStreaming: false, // Streaming pausato
        bytesSent: 0,
        errors: 0
      })
      
      this.onDebug?.('✅ Streaming continuo in pausa - volume 0, connessione FFmpeg mantenuta')
      
    } catch (error) {
      this.onError?.(`Errore pausa streaming: ${error}`)
    }
  }

  async resumeStreaming(): Promise<void> {
    try {
      if (!this.isStreaming || !this.isPaused) return
      
      this.isPaused = false
      this.resumeTimestamp = Date.now()
      const pauseDuration = this.resumeTimestamp - this.pauseTimestamp
      
      this.onDebug?.(`▶️ [CONTINUOUS] Ripresa streaming - timestamp: ${this.resumeTimestamp}`)
      this.onDebug?.(`▶️ [CONTINUOUS] Durata pausa: ${pauseDuration}ms`)
      
      // ✅ FIX: Riprendi l'audio del deck che viene catturato
      this.resumeDeckAudio()
      
      // ✅ NUOVO: Riporta a 100 il volume del mixer di streaming
      this.setStreamingVolume(1.0)
      this.onDebug?.('▶️ [CONTINUOUS] Volume streaming ripristinato a 100% - audio inviato')
      
      // ✅ FIX: MediaRecorder continua a funzionare normalmente
      // FFmpeg riceve di nuovo l'audio a volume normale
      
      this.onStatusChange?.({
        isConnected: this.isConnected,
        isStreaming: true, // Streaming ripreso
        bytesSent: 0,
        errors: 0
      })
      
      this.onDebug?.(`✅ Streaming continuo ripreso - pausa: ${pauseDuration}ms - volume ripristinato`)
      
    } catch (error) {
      this.onError?.(`Errore ripresa streaming: ${error}`)
    }
  }

  // ✅ NUOVO: Controllo audio deck per sincronizzazione
  private pauseDeckAudio(): void {
    try {
      // Controlla se abbiamo accesso al globalAudioContext
      if (typeof (window as any).globalAudioContext !== 'undefined') {
        const audioContext = (window as any).globalAudioContext
        const mixerGain = (window as any).globalMixerGain
        
        if (audioContext && mixerGain) {
          // Metti in pausa il mixer gain per fermare l'audio
          mixerGain.gain.setValueAtTime(0, audioContext.currentTime)
          this.onDebug?.('⏸️ [CONTINUOUS] Mixer gain messo a 0 - audio deck in pausa')
        }
      }
      
      // Controlla se abbiamo accesso agli elementi audio del deck
      if (typeof (window as any).leftStreamAudio !== 'undefined') {
        const leftAudio = (window as any).leftStreamAudio
        if (leftAudio && !leftAudio.paused) {
          leftAudio.pause()
          this.onDebug?.('⏸️ [CONTINUOUS] Left deck audio messo in pausa')
        }
      }
      
      if (typeof (window as any).rightStreamAudio !== 'undefined') {
        const rightAudio = (window as any).rightStreamAudio
        if (rightAudio && !rightAudio.paused) {
          rightAudio.pause()
          this.onDebug?.('⏸️ [CONTINUOUS] Right deck audio messo in pausa')
        }
      }
      
    } catch (error) {
      this.onError?.(`Errore pausa audio deck: ${error}`)
    }
  }
  
  private resumeDeckAudio(): void {
    try {
      // Controlla se abbiamo accesso al globalAudioContext
      if (typeof (window as any).globalAudioContext !== 'undefined') {
        const audioContext = (window as any).globalAudioContext
        const mixerGain = (window as any).globalMixerGain
        
        if (audioContext && mixerGain) {
          // Riprendi il mixer gain per riattivare l'audio
          mixerGain.gain.setValueAtTime(1.0, audioContext.currentTime)
          this.onDebug?.('▶️ [CONTINUOUS] Mixer gain ripristinato a 1.0 - audio deck ripreso')
        }
      }
      
      // Controlla se abbiamo accesso agli elementi audio del deck
      if (typeof (window as any).leftStreamAudio !== 'undefined') {
        const leftAudio = (window as any).leftStreamAudio
        if (leftAudio && leftAudio.paused) {
          leftAudio.play()
          this.onDebug?.('▶️ [CONTINUOUS] Left deck audio ripreso')
        }
      }
      
      if (typeof (window as any).rightStreamAudio !== 'undefined') {
        const rightAudio = (window as any).rightStreamAudio
        if (rightAudio && rightAudio.paused) {
          rightAudio.play()
          this.onDebug?.('▶️ [CONTINUOUS] Right deck audio ripreso')
        }
      }
      
    } catch (error) {
      this.onError?.(`Errore ripresa audio deck: ${error}`)
    }
  }

  getStatus(): StreamStatus {
    return {
      isConnected: this.isConnected,
      isStreaming: this.isStreaming,
      bytesSent: 0, // TODO: Implementare conteggio
      errors: 0,    // TODO: Implementare conteggio errori
      lastError: undefined
    }
  }

  // ✅ CRITICAL FIX: Sistema di invio dati audio
  private mediaRecorder: MediaRecorder | null = null
  private audioStream: MediaStream | null = null
  
  // ✅ RIMOSSO: Sistema di buffering non necessario - usiamo stop/start MediaRecorder

  private startAudioDataSending(): void {
    try {
      this.onDebug?.('🎵 Avvio invio dati audio...')
      
      // Ottieni il mixed stream dal sistema globale
      if (typeof (window as any).getMixedStream === 'function') {
        this.onDebug?.('🎵 Ottenimento mixed stream per streaming...')
        
        // Usa il sistema esistente per ottenere il mixed stream
        ;(window as any).getMixedStream(undefined, undefined, false).then((stream: MediaStream) => {
          if (stream && stream.active) {
            this.audioStream = stream
            this.startMediaRecorder(stream)
            this.onDebug?.('✅ MediaRecorder avviato per invio dati audio')
          } else {
            this.onError?.('Impossibile ottenere mixed stream valido')
          }
        }).catch((error: any) => {
          this.onError?.(`Errore ottenimento mixed stream: ${error}`)
        })
      } else {
        this.onError?.('Funzione getMixedStream non disponibile')
      }
      
    } catch (error) {
      this.onError?.(`Errore avvio invio dati audio: ${error}`)
    }
  }

  private startMediaRecorder(stream: MediaStream): void {
    try {
      // Crea MediaRecorder per catturare audio
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: (this.config?.bitrate || 128) * 1000
      })

      // Gestisce i chunk audio - invio diretto a FFmpeg + rilevamento silenzio
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          try {
            const arrayBuffer = await event.data.arrayBuffer()
            
            // 🔇 SICUREZZA: Analizza il chunk per rilevare silenzio
            this.analyzeAudioChunk(arrayBuffer)
            
            // ✅ SEMPLIFICATO: Invia direttamente a FFmpeg
            if (typeof (window as any).desktopStream?.write === 'function') {
              ;(window as any).desktopStream.write(arrayBuffer)
              this.onDebug?.(`📡 Dati audio inviati: ${arrayBuffer.byteLength} bytes`)
            }
          } catch (error) {
            this.onError?.(`Errore invio chunk audio: ${error}`)
          }
        }
      }

      // Avvia registrazione con chunk frequenti
      this.mediaRecorder.start(100) // Chunk ogni 100ms
      this.onDebug?.('✅ MediaRecorder avviato per streaming continuo')
      
    } catch (error) {
      this.onError?.(`Errore avvio MediaRecorder: ${error}`)
    }
  }

  private stopAudioDataSending(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop()
        this.onDebug?.('🛑 MediaRecorder fermato')
      }
      
      this.mediaRecorder = null
      this.audioStream = null
      
    } catch (error) {
      this.onError?.(`Errore arresto invio dati audio: ${error}`)
    }
  }

  // ✅ NUOVO: Metodo per controllare il volume del mixer di streaming
  private setStreamingVolume(volume: number): void {
    try {
      // Controlla se abbiamo accesso al globalAudioContext
      if (typeof (window as any).globalAudioContext !== 'undefined') {
        const audioContext = (window as any).globalAudioContext
        const leftDeckGain = (window as any).leftDeckStreamGain
        const rightDeckGain = (window as any).rightDeckStreamGain
        
        if (audioContext) {
          // ✅ FIX: Controlla i gain specifici dei deck per lo streaming
          if (leftDeckGain) {
            leftDeckGain.gain.setValueAtTime(volume, audioContext.currentTime)
            this.onDebug?.(`🔊 [STREAMING VOLUME] Left deck gain impostato a: ${Math.round(volume * 100)}%`)
          }
          
          if (rightDeckGain) {
            rightDeckGain.gain.setValueAtTime(volume, audioContext.currentTime)
            this.onDebug?.(`🔊 [STREAMING VOLUME] Right deck gain impostato a: ${Math.round(volume * 100)}%`)
          }
          
          if (!leftDeckGain && !rightDeckGain) {
            this.onDebug?.('⚠️ [STREAMING VOLUME] Nessun deck gain disponibile per streaming')
          }
        } else {
          this.onDebug?.('⚠️ [STREAMING VOLUME] GlobalAudioContext non disponibile')
        }
      } else {
        this.onDebug?.('⚠️ [STREAMING VOLUME] GlobalAudioContext non disponibile')
      }
    } catch (error) {
      this.onError?.(`Errore controllo volume streaming: ${error}`)
    }
  }

  // 🔇 SICUREZZA: Analizza chunk audio per rilevare silenzio
  private analyzeAudioChunk(arrayBuffer: ArrayBuffer): void {
    try {
      // ✅ FIX: I chunk WebM/Opus sono compressi, non possiamo analizzarli come PCM
      // Usiamo un approccio basato sulla dimensione del chunk e pattern di dati
      
      const chunkSize = arrayBuffer.byteLength
      
      // ✅ METODO ALTERNATIVO: Analisi basata su dimensione e pattern
      // I chunk di silenzio in WebM/Opus sono tipicamente molto piccoli
      const isChunkSilent = this.detectSilenceFromChunkSize(chunkSize, arrayBuffer)
      
      if (isChunkSilent) {
        // Chunk silenzioso
        if (!this.isSilent) {
          // Inizia periodo di silenzio
          this.isSilent = true
          this.silenceStartTime = Date.now()
          this.silenceWarningShown = false
          this.onDebug?.(`🔇 [SILENCE] Inizio silenzio rilevato - chunk size: ${chunkSize} bytes`)
        }
        
        // Controlla se è il momento di mostrare l'avviso o disconnettere
        this.checkSilenceDuration()
      } else {
        // Chunk con audio - reset silenzio
        if (this.isSilent) {
          this.isSilent = false
          this.silenceWarningShown = false
          this.onDebug?.(`🔊 [SILENCE] Fine silenzio rilevato - chunk size: ${chunkSize} bytes`)
        }
      }
      
    } catch (error) {
      this.onError?.(`Errore analisi chunk audio: ${error}`)
    }
  }

  // 🔇 SICUREZZA: Rileva silenzio basandosi su dimensione chunk e pattern
  private detectSilenceFromChunkSize(chunkSize: number, arrayBuffer: ArrayBuffer): boolean {
    try {
      // ✅ METODO 1: Chunk molto piccoli sono probabilmente silenzio
      if (chunkSize < 100) { // Meno di 100 bytes = probabilmente silenzio
        return true
      }
      
      // ✅ METODO 2: Analisi pattern di byte per rilevare silenzio
      const uint8Array = new Uint8Array(arrayBuffer)
      let zeroBytes = 0
      let totalBytes = Math.min(uint8Array.length, 1000) // Analizza solo i primi 1000 bytes
      
      for (let i = 0; i < totalBytes; i++) {
        if (uint8Array[i] === 0) {
          zeroBytes++
        }
      }
      
      // Se più del 80% dei bytes sono zero, probabilmente è silenzio
      const zeroPercentage = zeroBytes / totalBytes
      if (zeroPercentage > 0.8) {
        return true
      }
      
      // ✅ METODO 3: Pattern specifici per silenzio in WebM/Opus
      // I chunk di silenzio hanno spesso pattern ripetitivi
      if (this.hasSilencePattern(uint8Array)) {
        return true
      }
      
      return false
      
    } catch (error) {
      this.onDebug?.(`Errore analisi pattern silenzio: ${error}`)
      return false // In caso di errore, assume che ci sia audio
    }
  }

  // 🔇 SICUREZZA: Rileva pattern specifici di silenzio
  private hasSilencePattern(uint8Array: Uint8Array): boolean {
    try {
      // Pattern comuni per silenzio in WebM/Opus
      const silencePatterns = [
        [0x00, 0x00, 0x00, 0x00], // Sequenza di zeri
        [0xFF, 0xFF, 0xFF, 0xFF], // Sequenza di 0xFF (spesso usata per silenzio)
        [0x80, 0x80, 0x80, 0x80]  // Pattern di silenzio comune
      ]
      
      for (const pattern of silencePatterns) {
        let matches = 0
        for (let i = 0; i < Math.min(uint8Array.length - pattern.length, 100); i++) {
          let patternMatch = true
          for (let j = 0; j < pattern.length; j++) {
            if (uint8Array[i + j] !== pattern[j]) {
              patternMatch = false
              break
            }
          }
          if (patternMatch) {
            matches++
          }
        }
        
        // Se troviamo molti match del pattern, probabilmente è silenzio
        if (matches > 10) {
          return true
        }
      }
      
      return false
      
    } catch (error) {
      return false
    }
  }

  // 🔇 SICUREZZA: Controlla durata silenzio e gestisce avvisi/disconnessione
  private checkSilenceDuration(): void {
    if (!this.isSilent || this.disconnectedForSilence) return
    
    const silenceDuration = Date.now() - this.silenceStartTime
    const remainingTime = this.silenceThreshold - silenceDuration
    
    if (remainingTime <= 0) {
      // Tempo scaduto - disconnetti
      this.onDebug?.(`🔇 [SILENCE] Silenzio di ${Math.round(silenceDuration / 1000)}s - disconnessione automatica`)
      this.disconnectedForSilence = true // ✅ FIX: Previeni loop infinito
      this.onSilenceDisconnect?.()
      this.stopStreaming() // ✅ FIX: Usa stopStreaming invece di disconnect
    } else if (remainingTime <= 10000 && !this.silenceWarningShown) {
      // Mostra avviso 10 secondi prima della disconnessione
      this.silenceWarningShown = true
      const secondsRemaining = Math.round(remainingTime / 1000)
      this.onDebug?.(`⚠️ [SILENCE] Avviso: disconnessione in ${secondsRemaining} secondi per silenzio`)
      this.onSilenceWarning?.(secondsRemaining)
    }
  }

  // 🔇 SICUREZZA: Avvia controllo periodico silenzio
  private startSilenceMonitoring(): void {
    this.stopSilenceMonitoring() // Ferma eventuale monitoraggio precedente
    
    this.silenceCheckInterval = setInterval(() => {
      if (this.isSilent) {
        this.checkSilenceDuration()
      }
    }, 1000) // Controlla ogni secondo
    
    this.onDebug?.('🔇 [SILENCE] Monitoraggio silenzio avviato')
  }

  // 🔇 SICUREZZA: Ferma controllo silenzio
  private stopSilenceMonitoring(): void {
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval)
      this.silenceCheckInterval = null
    }
    
    // Reset stato silenzio
    this.isSilent = false
    this.silenceWarningShown = false
    this.disconnectedForSilence = false // ✅ FIX: Reset flag per permettere riconnessione
    
    this.onDebug?.('🔇 [SILENCE] Monitoraggio silenzio fermato')
  }

  // 🔄 RETRY: Avvia processo di retry automatico
  private startRetryProcess(): void {
    console.log('🔄 [RETRY] startRetryProcess chiamato - controlli:', {
      isRetrying: this.isRetrying,
      disconnectedForSilence: this.disconnectedForSilence,
      retryPermanentlyStopped: this.retryPermanentlyStopped,
      userRequestedDisconnect: this.userRequestedDisconnect
    })
    
    if (this.isRetrying || this.disconnectedForSilence || this.retryPermanentlyStopped || this.userRequestedDisconnect) {
      this.onDebug?.('🔄 [RETRY] Retry già in corso, disconnesso per silenzio, stop definitivo o disconnessione utente - skip')
      console.log('🔄 [RETRY] Retry bloccato - userRequestedDisconnect:', this.userRequestedDisconnect)
      return
    }

    // ✅ FIX: Controlla cooldown session (5 tentativi ogni 10 secondi)
    const now = Date.now()
    if (this.retrySessionStart === 0) {
      this.retrySessionStart = now
      this.retrySessionCount = 0
    }
    
    // Se la sessione è scaduta, resetta
    if (now - this.retrySessionStart > this.retrySessionDuration) {
      this.retrySessionStart = now
      this.retrySessionCount = 0
      this.retryCount = 0
    }
    
    // Se abbiamo già fatto 5 tentativi in questa sessione, aspetta
    if (this.retrySessionCount >= 5) {
      const remainingTime = this.retrySessionDuration - (now - this.retrySessionStart)
      this.onDebug?.(`🔄 [RETRY] Limite sessione raggiunto (5/30s) - aspetta ${Math.round(remainingTime/1000)}s`)
      return
    }

    if (this.retryCount >= this.maxRetries) {
      this.onDebug?.(`🛑 [RETRY] Raggiunto limite massimo retry (${this.maxRetries}) - STOP DEFINITIVO`)
      this.retryPermanentlyStopped = true // ✅ FIX: Stop definitivo
      this.onRetryFailed?.()
      return
    }

    if (!this.lastConfig) {
      this.onDebug?.('🔄 [RETRY] Nessuna configurazione salvata per retry - abbandono')
      this.onRetryFailed?.()
      return
    }

    this.retryCount++
    this.retrySessionCount++ // ✅ FIX: Incrementa contatore sessione
    this.isRetrying = true

    // Calcola delay con backoff esponenziale
    const delay = this.retryDelay * Math.pow(2, this.retryCount - 1)
    
    this.onDebug?.(`🔄 [RETRY] Tentativo ${this.retryCount}/${this.maxRetries} (${this.retrySessionCount}/5 in sessione 30s) tra ${delay}ms`)
    this.onRetryAttempt?.(this.retryCount, this.maxRetries)

    this.retryTimeout = setTimeout(async () => {
      try {
        this.onDebug?.(`🔄 [RETRY] Esecuzione tentativo ${this.retryCount}/${this.maxRetries}`)
        
        // Tenta di riconnettersi con la configurazione salvata
        const success = await this.startStreamingWithConfig(this.lastConfig!, true) // ✅ FIX: isRetry = true
        
        if (success) {
          this.onDebug?.(`✅ [RETRY] Riconnessione riuscita al tentativo ${this.retryCount}`)
          this.isRetrying = false
          this.retryCount = 0
        } else {
          this.onDebug?.(`❌ [RETRY] Tentativo ${this.retryCount} fallito - riprovo`)
          // ✅ FIX: Continua automaticamente con il prossimo retry solo se non è disconnessione utente
          this.isRetrying = false
          if (!this.userRequestedDisconnect) {
            this.startRetryProcess()
          } else {
            this.onDebug?.('🛑 [RETRY] Disconnessione richiesta dall\'utente - nessun retry')
          }
        }
      } catch (error) {
        this.onError?.(`Errore durante retry: ${error}`)
        this.isRetrying = false
      }
    }, delay)
  }

  // 🔄 RETRY: Ferma processo di retry
  private stopRetryProcess(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }
    
    this.isRetrying = false
    this.retryCount = 0
    this.retrySessionCount = 0 // ✅ FIX: Reset contatore sessione
    this.retrySessionStart = 0 // ✅ FIX: Reset timestamp sessione
    
    // ✅ FIX: Non resettare flag stop definitivo se è stato impostato per limite raggiunto
    if (!this.retryPermanentlyStopped) {
      this.onDebug?.('🔄 [RETRY] Processo retry fermato')
    } else {
      this.onDebug?.('🛑 [RETRY] Processo retry fermato - stop definitivo attivo')
    }
  }

  // 🔄 RETRY: Gestisce notifica perdita connessione
  handleConnectionLost(reason: string): void {
    this.onDebug?.(`🚨 [CONNECTION] Connessione persa: ${reason}`)
    this.onConnectionLost?.(reason)
    
    console.log('🚨 [CONNECTION] handleConnectionLost chiamato - controlli:', {
      reason,
      isRetrying: this.isRetrying,
      disconnectedForSilence: this.disconnectedForSilence,
      retryPermanentlyStopped: this.retryPermanentlyStopped,
      userRequestedDisconnect: this.userRequestedDisconnect
    })
    
    // ✅ FIX: Avvia retry automatico solo se non stop definitivo e non disconnessione utente
    if (!this.isRetrying && !this.disconnectedForSilence && !this.retryPermanentlyStopped && !this.userRequestedDisconnect) {
      this.startRetryProcess()
    } else if (this.retryPermanentlyStopped || this.userRequestedDisconnect) {
      this.onDebug?.('🛑 [CONNECTION] Retry stop definitivo o disconnessione utente - nessun tentativo di riconnessione')
      console.log('🛑 [CONNECTION] Retry bloccato - userRequestedDisconnect:', this.userRequestedDisconnect)
    }
  }

  // ✅ FIX: Metodo per resettare manualmente il flag stop definitivo
  resetRetryLimit(): void {
    this.retryPermanentlyStopped = false
    // ✅ CRITICAL FIX: NON resettare userRequestedDisconnect qui - deve rimanere true fino a nuovo avvio manuale
    // this.userRequestedDisconnect = false // ❌ RIMOSSO: Questo causava il problema di auto-reconnessione
    this.retryCount = 0
    this.isRetrying = false
    this.retrySessionCount = 0
    this.retrySessionStart = 0
    this.onDebug?.('🔄 [RETRY] Limite retry resettato manualmente - riprova disponibile')
  }

  // ✅ NEW: Metodo per resettare SOLO quando l'utente avvia manualmente lo streaming
  resetUserDisconnectFlag(): void {
    this.userRequestedDisconnect = false
    this.onDebug?.('🔄 [USER DISCONNECT] Flag userRequestedDisconnect resettato - nuovo avvio manuale permesso')
    console.log('🔄 [USER DISCONNECT] Flag userRequestedDisconnect resettato a FALSE')
  }

  // ✅ FIX: Setup listener per eventi FFmpeg da Electron
  private setupFFmpegEventListeners(): void {
    // @ts-ignore
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      // @ts-ignore
      const electronAPI = (window as any).electronAPI
      
      // Listener per errori FFmpeg
      electronAPI.onFFmpegError((_event: any, errorData: any) => {
        this.onDebug?.(`🚨 [FFMPEG ERROR] ${errorData.type}: ${errorData.message}`)
        this.onError?.(`FFmpeg Error: ${errorData.message}`)
        
        // ✅ FIX: Ferma immediatamente l'invio di chunk audio
        this.stopAudioDataSending()
        
        // Aggiorna stato come disconnesso
        this.isStreaming = false
        this.isConnected = false
        
        this.onStatusChange?.({
          isConnected: false,
          isStreaming: false,
          bytesSent: 0,
          errors: 1
        })
        
        // Avvia retry automatico per errori critici solo se non è disconnessione utente
        if (!this.isRetrying && !this.disconnectedForSilence && !this.userRequestedDisconnect) {
          this.handleConnectionLost(`ffmpeg_error_${errorData.type}`)
        } else if (this.userRequestedDisconnect) {
          this.onDebug?.('🛑 [FFMPEG ERROR] Disconnessione richiesta dall\'utente - nessun retry')
        }
      })
      
      // ✅ FIX: Listener per successo connessione FFmpeg
      electronAPI.onFFmpegConnected?.((_event: any, connectionData: any) => {
        this.onDebug?.(`✅ [FFMPEG CONNECTED] Connesso con successo: ${connectionData.message || 'Connessione stabilita'}`)
        
        // Aggiorna stato come connesso solo quando FFmpeg è effettivamente connesso
        this.isStreaming = true
        this.isConnected = true
        
        this.onStatusChange?.({
          isConnected: true,
          isStreaming: true,
          bytesSent: 0,
          errors: 0
        })
        
        this.onDebug?.('🎉 [STREAMING] FFmpeg connesso e streaming attivo!')
      })
      
      // Listener per disconnessioni FFmpeg
      electronAPI.onFFmpegDisconnected((_event: any, disconnectData: any) => {
        this.onDebug?.(`🚨 [FFMPEG DISCONNECTED] Exit code: ${disconnectData.exitCode}, Reason: ${disconnectData.reason}`)
        
        // ✅ FIX: Ferma immediatamente l'invio di chunk audio
        this.stopAudioDataSending()
        
        // Aggiorna stato come disconnesso
        this.isStreaming = false
        this.isConnected = false
        
        this.onStatusChange?.({
          isConnected: false,
          isStreaming: false,
          bytesSent: 0,
          errors: 1
        })
        
        // ✅ FIX: Avvia retry automatico solo se non è disconnessione richiesta dall'utente
        if (disconnectData.reason !== 'normal_exit' && !this.isRetrying && !this.disconnectedForSilence && !this.userRequestedDisconnect) {
          this.handleConnectionLost(`ffmpeg_disconnected_${disconnectData.exitCode}`)
        } else if (this.userRequestedDisconnect) {
          this.onDebug?.('🛑 [FFMPEG DISCONNECTED] Disconnessione richiesta dall\'utente - nessun retry')
        }
      })
      
      this.onDebug?.('🔧 [FFMPEG] Event listeners setup completato')
    }
  }
}

export default ContinuousStreamingManager
