import { localDatabase, DatabaseTrack } from '../database/LocalDatabase'
import { putBlob } from '../database/BlobStore'
// Rimuovo l'import di get-video-duration che non funziona nel browser
// import { getVideoDurationInSeconds } from 'get-video-duration'

// Wrapper per operazioni database con retry e gestione errori
const safeDatabaseOperation = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Database operation ${operationName} failed (attempt ${attempt}/${maxRetries}):`, lastError)
      
      if (attempt < maxRetries) {
        // Pausa esponenziale prima del retry
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw new Error(`Database operation ${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`)
}

export interface UploadProgress {
  file: File
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
}

export interface AudioMetadata {
  title: string
  artist: string
  album?: string
  genre?: string
  duration: number
  bpm?: number
  key?: string
  energy?: 'low' | 'medium' | 'high'
}

export class FileUploadManager {
  private supportedFormats = [
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/flac',
    'audio/aac',
    'audio/aacp',
    'audio/x-m4a',
    'audio/mp4',
    'audio/ogg',
    'audio/webm',
    'audio/opus'
  ]
  private supportedExtensions = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.webm', '.opus']
  private maxFileSize = 100 * 1024 * 1024 // 100MB
  private onProgress?: (progress: UploadProgress) => void

  constructor(onProgress?: (progress: UploadProgress) => void) {
    this.onProgress = onProgress
  }

  async uploadFiles(files: FileList | File[]): Promise<DatabaseTrack[]> {
    const fileArray = Array.from(files)
    const validFiles = fileArray.filter(file => this.isValidFile(file))
    
    if (validFiles.length === 0) {
      throw new Error('No valid audio files found')
    }

    const uploadedTracks: DatabaseTrack[] = []
    let processedCount = 0
    for (const file of validFiles) {
      try {
        const track = await this.processFile(file)
        if (track) {
          uploadedTracks.push(track)
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
        this.updateProgress(file, 0, 'error', error instanceof Error ? error.message : 'Unknown error')
      }
      processedCount++
      if (processedCount % 50 === 0) {
        try { await this.forceMemoryCleanup() } catch {}
        try { await new Promise(resolve => setTimeout(resolve, 150)) } catch {}
      }
    }

    return uploadedTracks
  }

  private isValidFile(file: File): boolean {
    // MIME type check
    if (file.type && this.supportedFormats.includes(file.type)) {
      // continue
    } else {
      // Fallback: extension-based validation
      const lowerName = file.name.toLowerCase()
      const hasValidExt = this.supportedExtensions.some(ext => lowerName.endsWith(ext))
      if (!hasValidExt) {
        console.warn(`Unsupported file type: ${file.type || 'unknown'} for file: ${file.name}`)
        return false
      }
    }

    // Size check
    if (file.size > this.maxFileSize) {
      console.warn(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
      return false
    }

    return true
  }

  private async processFile(file: File): Promise<DatabaseTrack | null> {
    try {
      try { (window as any).log?.info?.(`processFile start: ${file.name} (${file.type || 'unknown'}, ${file.size} bytes)`) } catch {}
      // Update progress to processing
      try { this.updateProgress(file, 0, 'processing') } catch (e) { try { (window as any).log?.warn?.(`updateProgress processing threw: ${String(e)}`) } catch {} }

      // Extract metadata from filename if possible
      const metadata = this.extractMetadataFromFilename(file.name)
      try { (window as any).log?.info?.(`metadata extracted: title='${metadata.title}' artist='${metadata.artist}'`) } catch {}
      
      // Electron: skip analysis to avoid codec/decoder crashes; compute later lazily
      // Use a robust detection (preload exposes fileStore; userAgent contains 'Electron')
      const isElectron = !!((window as any).fileStore) || ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
      let duration = 0
      let waveform: number[] = []
      if (!isElectron) {
        const analysis = await this.safeAnalyzeAudio(file)
        try { (window as any).log?.info?.(`analyzed: ${file.name} duration=${analysis.duration}s peaks=${analysis.peaks.length}`) } catch {}
        duration = analysis.duration
        waveform = analysis.peaks
      } else {
        // In Electron calcolo almeno la durata in modo leggero
        try {
          duration = await this.getAudioDuration(file)
          try { (window as any).log?.info?.(`electron duration computed: ${file.name} => ${duration}s`) } catch {}
        } catch (_) {
          try { (window as any).log?.warn?.(`electron duration failed for ${file.name}`) } catch {}
          duration = 0
        }
      }
      
      // Create track object
      const track: Omit<DatabaseTrack, 'id' | 'addedAt' | 'playCount' | 'rating'> = {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        genre: metadata.genre,
        duration,
        bpm: metadata.bpm,
        key: metadata.key,
        energy: metadata.energy,
        url: 'idb:pending',
        waveform
      }

      // Add to database first (to get trackId), then persist blob with that id and update track
      try { (window as any).log?.info?.(`about to addTrack for ${file.name}`) } catch {}
      const trackId = await localDatabase.addTrack(track)
      try { (window as any).log?.info?.(`track added id=${trackId} for ${file.name}`) } catch {}
      // On Electron, persist via filesystem to avoid IndexedDB large blob issues
      const isElectronEnv = !!((window as any).fileStore) || ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
      if (isElectronEnv && (window as any).fileStore?.saveAudio) {
        try {
          const buf = await file.arrayBuffer()
          const saved = await (window as any).fileStore.saveAudio(trackId, file.name, buf)
          if (saved?.ok && saved.path) {
            try { (window as any).log?.info?.(`file saved at ${saved.path}`) } catch {}
            await safeDatabaseOperation(
              () => localDatabase.updateTrack(trackId, { blobId: trackId, url: `file://${saved.path}`, fileUrl: `file://${saved.path}` }),
              `updateTrack file path for ${file.name}`
            )
            // ✅ NO DUPLICATE BLOB: evita salvataggio anche in IndexedDB per ridurre RAM/space
          } else {
            throw new Error(saved?.error || 'saveAudio failed')
          }
                  } catch (e) {
            try { (window as any).log?.warn?.(`saveAudio failed, fallback to idb: ${e instanceof Error ? e.message : String(e)}`) } catch {}
            await safeDatabaseOperation(
              () => putBlob(trackId, file),
              `putBlob fallback for ${file.name}`
            )
            await safeDatabaseOperation(
              () => localDatabase.updateTrack(trackId, { blobId: trackId, url: `idb:${trackId}` }),
              `updateTrack idb fallback for ${file.name}`
            )
          }
        } else {
          await safeDatabaseOperation(
            () => putBlob(trackId, file),
            `putBlob for ${file.name}`
          )
          await safeDatabaseOperation(
            () => localDatabase.updateTrack(trackId, { blobId: trackId, url: `idb:${trackId}` }),
            `updateTrack idb for ${file.name}`
          )
        }
      const savedTrack = await localDatabase.getTrack(trackId)
      
      if (savedTrack) {
        this.updateProgress(file, 100, 'completed')
        return savedTrack
      }

      return null
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error)
      try { (window as any).log?.error?.(`processFile error ${file.name}: ${error instanceof Error ? error.message : String(error)}`) } catch {}
      this.updateProgress(file, 0, 'error', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  }

  // ✅ FIX: Analisi audio ottimizzata con timeout esteso e retry
  private async safeAnalyzeAudio(file: File): Promise<{ duration: number; peaks: number[] }> {
    try {
      // ✅ FIX: Timeout esteso per file grandi (30 secondi)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Audio analysis timeout dopo 30s')), 30000)
      })

      const analysisPromise = this.performAudioAnalysis(file)
      
      const result = await Promise.race([analysisPromise, timeoutPromise])
      return result
    } catch (err) {
      // ✅ FIX: Fallback intelligente con durata stimata invece di 0
      console.warn(`⚠️ [AUDIO] Analisi fallita per ${file.name}, usando stima intelligente:`, err)
      const estimatedDuration = this.estimateDurationFromFilename(file.name)
      return { duration: estimatedDuration, peaks: [] }
    }
  }

  // ✅ FIX: Analisi audio robusta con retry e fallback intelligenti
  private async performAudioAnalysis(file: File): Promise<{ duration: number; peaks: number[] }> {
    const maxRetries = 3
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎵 [AUDIO] Tentativo ${attempt}/${maxRetries} per ${file.name}`)
        
        let arrayBuffer: ArrayBuffer | null = await file.arrayBuffer()
        
        // ✅ FIX: Controlla se il file è valido
        if (arrayBuffer.byteLength === 0) {
          throw new Error('File vuoto')
        }
        
        // ✅ FIX: Usa AudioContext con configurazione robusta
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
        const ac = new AudioCtx({
          sampleRate: 44100, // Frequenza standard
          latencyHint: 'interactive' // Ottimizzazione per analisi
        })
        
        try {
          // ✅ FIX: Decode con timeout e retry
          const audioBuffer: AudioBuffer = await this.robustDecodeAudioData(ac, arrayBuffer as ArrayBuffer, attempt)
          
          if (!audioBuffer || audioBuffer.duration === 0) {
            throw new Error('AudioBuffer invalido o durata zero')
          }
          
          const duration = Number.isFinite(audioBuffer.duration) ? Math.round(audioBuffer.duration) : 0
          
          if (duration <= 0) {
            throw new Error('Durata non valida')
          }
          
          // Waveform COMPLETI per qualità audio (200 campioni)
          const peaks = this.buildPeaksFromChannel(audioBuffer.getChannelData(0), 200)
          
          console.log(`✅ [AUDIO] Analisi completata per ${file.name}: ${duration}s`)
          
          try { 
            if ((ac as any).state !== 'closed') ac.close() 
          } catch (closeError) {
            // Ignora errori di chiusura
          }
          // Rilascia riferimenti pesanti
          try { (arrayBuffer as any) = null } catch {}
          
          return { duration, peaks }
          
        } catch (decodeError) {
          console.warn(`⚠️ [AUDIO] Decode fallito tentativo ${attempt}:`, decodeError)
          lastError = decodeError as Error
          
          try { 
            if ((ac as any).state !== 'closed') ac.close() 
          } catch (closeError) {
            // Ignora errori di chiusura
          }
          // Rilascia riferimenti pesanti
          try { (arrayBuffer as any) = null } catch {}
          
          // Se non è l'ultimo tentativo, riprova
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100 * attempt)) // Delay crescente
            continue
          }
          
          throw decodeError
        }
      } catch (err) {
        lastError = err as Error
        console.warn(`⚠️ [AUDIO] Errore tentativo ${attempt}:`, err)
        
        // Se non è l'ultimo tentativo, riprova
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200 * attempt)) // Delay crescente
          continue
        }
      }
    }
    
    // ✅ FIX: Solo se tutti i tentativi falliscono, usa stima intelligente
    console.warn(`❌ [AUDIO] Tutti i tentativi falliti per ${file.name}, usando stima intelligente:`, lastError)
    const estimatedDuration = this.estimateDurationFromFilename(file.name)
    return { duration: estimatedDuration, peaks: [] }
  }

  // ✅ NEW: Analisi audio LEGGERA per PC vecchi (durata reale + waveform a bassa risoluzione)
  private async safeAnalyzeAudioLight(file: File, numSamples = 64): Promise<{ duration: number; peaks: number[] }> {
    try {
      // Timeout più breve ma sufficiente per PC lenti
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Light audio analysis timeout dopo 15s')), 15000)
      })

      const analysisPromise = this.performAudioAnalysisLight(file, numSamples)
      const result = await Promise.race([analysisPromise, timeoutPromise])
      return result
    } catch (err) {
      // Ultimo fallback: stima intelligente (non 0)
      console.warn(`⚠️ [AUDIO-LIGHT] Analisi leggera fallita per ${file.name}, uso stima:`, err)
      const estimatedDuration = this.estimateDurationFromFilename(file.name)
      return { duration: estimatedDuration, peaks: [] }
    }
  }

  // ✅ NEW: Implementazione leggera con AudioContext a sampleRate ridotto e pochi campioni
  private async performAudioAnalysisLight(file: File, numSamples = 64): Promise<{ duration: number; peaks: number[] }> {
    const maxRetries = 2
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        if (arrayBuffer.byteLength === 0) throw new Error('File vuoto')

        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
        // Sample rate ridotto per consumare meno risorse su PC vecchi
        const ac = new AudioCtx({ sampleRate: 22050, latencyHint: 'interactive' })
        try {
          const audioBuffer: AudioBuffer = await this.robustDecodeAudioData(ac, arrayBuffer, attempt)
          const duration = Number.isFinite(audioBuffer.duration) ? Math.round(audioBuffer.duration) : 0
          if (duration <= 0) throw new Error('Durata non valida')

          const peaks = this.buildPeaksFromChannel(audioBuffer.getChannelData(0), Math.max(16, Math.min(256, numSamples)))

          try { if ((ac as any).state !== 'closed') ac.close() } catch {}
          return { duration, peaks }
        } catch (e) {
          lastError = e as Error
          try { if ((ac as any).state !== 'closed') ac.close() } catch {}
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 150 * attempt))
            continue
          }
        }
      } catch (err) {
        lastError = err as Error
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 200 * attempt))
          continue
        }
      }
    }

    console.warn('❌ [AUDIO-LIGHT] Tutti i tentativi falliti:', lastError)
    const estimatedDuration = this.estimateDurationFromFilename(file.name)
    return { duration: estimatedDuration, peaks: [] }
  }

  // ✅ FIX: Decode audio robusto con timeout e retry
  private async robustDecodeAudioData(audioContext: AudioContext, arrayBuffer: ArrayBuffer, attempt: number): Promise<AudioBuffer> {
    const timeoutMs = 5000 + (attempt * 2000) // Timeout crescente: 5s, 7s, 9s
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Audio decode timeout dopo ${timeoutMs}ms`))
      }, timeoutMs)
      
      // ✅ FIX: Decode con gestione errori migliorata (evita copie superflue di ArrayBuffer)
      audioContext.decodeAudioData(arrayBuffer)
        .then((audioBuffer) => {
          clearTimeout(timeoutId)
          
          // ✅ FIX: Validazione robusta dell'AudioBuffer
          if (!audioBuffer || audioBuffer.duration <= 0) {
            reject(new Error('AudioBuffer invalido o durata zero'))
            return
          }
          
          if (!audioBuffer.getChannelData || audioBuffer.getChannelData(0).length === 0) {
            reject(new Error('AudioBuffer senza dati audio'))
            return
          }
          
          resolve(audioBuffer)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  private buildPeaksFromChannel(channelData: Float32Array | null, numSamples = 200): number[] {
    if (!channelData || channelData.length === 0) return []
    const blockSize = Math.max(1, Math.floor(channelData.length / numSamples))
    const peaks: number[] = []
    for (let i = 0; i < numSamples; i++) {
      const start = i * blockSize
      const end = Math.min(start + blockSize, channelData.length)
      let max = 0
      for (let j = start; j < end; j++) {
        const v = Math.abs(channelData[j])
        if (v > max) max = v
      }
      peaks.push(Math.min(1, max))
    }
    return peaks
  }

  // ✅ FIX: Stima durata intelligente basata su pattern nei filename
  private estimateDurationFromFilename(filename: string): number {
    const name = filename.toLowerCase()
    
    // Pattern specifici per durata
    if (name.includes('intro') || name.includes('outro')) {
      return 30 // 30 secondi
    } else if (name.includes('short') || name.includes('clip')) {
      return 60 // 1 minuto
    } else if (name.includes('extended') || name.includes('long')) {
      return 300 // 5 minuti
    } else if (name.includes('mix') || name.includes('set')) {
      return 600 // 10 minuti
    } else if (name.includes('full') || name.includes('complete')) {
      return 240 // 4 minuti
    } else if (name.includes('demo') || name.includes('preview')) {
      return 90 // 1.5 minuti
    } else if (name.includes('remix') || name.includes('edit')) {
      return 200 // 3.5 minuti
    } else {
      return 180 // 3 minuti di default
    }
  }

  // Waveform ottimizzato per performance
  private async generateWaveformPeaks(file: File, numSamples = 200): Promise<number[]> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      const ac = new AudioCtx()
      
      try {
        const audioBuffer = await ac.decodeAudioData(arrayBuffer)
        const channelData = audioBuffer.getChannelData(0)
        const blockSize = Math.floor(channelData.length / numSamples)
        const peaks: number[] = []
        
        // Campionamento completo per qualità audio
        for (let i = 0; i < numSamples; i++) {
          const start = i * blockSize
          const end = Math.min(start + blockSize, channelData.length)
          let max = 0
          
          // Campionamento completo per waveform di qualità
          for (let j = start; j < end; j++) {
            const v = Math.abs(channelData[j])
            if (v > max) max = v
          }
          peaks.push(Math.min(1, max))
        }
        
        try { 
          if ((ac as any).state !== 'closed') ac.close() 
        } catch (closeError) {
          // Ignora errori di chiusura
        }
        
        return peaks
      } catch (decodeError) {
        try { 
          if ((ac as any).state !== 'closed') ac.close() 
        } catch (closeError) {
          // Ignora errori di chiusura
        }
        return []
      }
    } catch (err) {
      return []
    }
  }

  // Calcolo durata veloce per file grandi
  private async getAudioDurationFast(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio()
      const objectUrl = URL.createObjectURL(file)
      
      const cleanup = () => {
        try {
          URL.revokeObjectURL(objectUrl)
        } catch (cleanupError) {
          // Ignora errori di cleanup
        }
      }
      
      // Timeout ultra-aggressivo per file grandi
      const timeout = setTimeout(() => {
        cleanup()
        resolve(0)
      }, 3000) // Solo 3 secondi per file grandi
      
      audio.onloadedmetadata = () => {
        clearTimeout(timeout)
        try {
          const duration = Math.round(audio.duration)
          cleanup()
          resolve(Number.isFinite(duration) ? duration : 0)
        } catch (metadataError) {
          cleanup()
          resolve(0)
        }
      }
      
      audio.onerror = () => {
        clearTimeout(timeout)
        cleanup()
        resolve(0)
      }
      
      try {
        audio.src = objectUrl
      } catch (srcError) {
        clearTimeout(timeout)
        cleanup()
        resolve(0)
      }
    })
  }

  // Waveform sintetico per file troppo grandi
  private generateSyntheticWaveform(duration: number): number[] {
    const numSamples = 100
    const peaks: number[] = []
    
    for (let i = 0; i < numSamples; i++) {
      // Genera pattern sintetico basato sulla durata
      const time = (i / numSamples) * duration
      const pattern = Math.sin(time * 0.1) * 0.5 + 0.5
      peaks.push(Math.min(1, Math.max(0, pattern)))
    }
    
    return peaks
  }

  private extractMetadataFromFilename(filename: string): AudioMetadata {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    
    // Try to parse common filename patterns
    // Pattern: "Artist - Title" or "Artist - Title (Album)"
    const artistTitleMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+?)(?:\s*\((.+?)\))?$/)
    
    if (artistTitleMatch) {
      return {
        title: artistTitleMatch[2].trim(),
        artist: artistTitleMatch[1].trim(),
        album: artistTitleMatch[3]?.trim(),
        genre: this.detectGenreFromFilename(nameWithoutExt),
        duration: 0, // Will be set later
        energy: this.detectEnergyFromFilename(nameWithoutExt)
      }
    }

    // Pattern: "Title - Artist"
    const titleArtistMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+?)$/)
    if (titleArtistMatch) {
      return {
        title: titleArtistMatch[1].trim(),
        artist: titleArtistMatch[2].trim(),
        genre: this.detectGenreFromFilename(nameWithoutExt),
        duration: 0,
        energy: this.detectEnergyFromFilename(nameWithoutExt)
      }
    }

    // Fallback: use filename as title
    return {
      title: nameWithoutExt,
      artist: 'Unknown Artist',
      genre: this.detectGenreFromFilename(nameWithoutExt),
      duration: 0,
      energy: this.detectEnergyFromFilename(nameWithoutExt)
    }
  }

  private detectGenreFromFilename(filename: string): string {
    const lowerFilename = filename.toLowerCase()
    
    // Common genre keywords
    const genreKeywords: { [key: string]: string[] } = {
      'Electronic': ['electronic', 'edm', 'techno', 'house', 'trance', 'dubstep', 'drum', 'bass'],
      'Rock': ['rock', 'metal', 'punk', 'grunge', 'alternative'],
      'Pop': ['pop', 'pop-rock', 'indie-pop'],
      'Hip Hop': ['hip-hop', 'rap', 'trap', 'r&b'],
      'Jazz': ['jazz', 'blues', 'soul', 'funk'],
      'Classical': ['classical', 'orchestra', 'symphony'],
      'Country': ['country', 'folk', 'bluegrass'],
      'Reggae': ['reggae', 'dub', 'ska']
    }

    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some(keyword => lowerFilename.includes(keyword))) {
        return genre
      }
    }

    return 'Other'
  }

  private detectEnergyFromFilename(filename: string): 'low' | 'medium' | 'high' {
    const lowerFilename = filename.toLowerCase()
    
    // High energy keywords
    if (lowerFilename.includes('fast') || lowerFilename.includes('upbeat') || 
        lowerFilename.includes('energetic') || lowerFilename.includes('intense')) {
      return 'high'
    }
    
    // Low energy keywords
    if (lowerFilename.includes('slow') || lowerFilename.includes('chill') || 
        lowerFilename.includes('ambient') || lowerFilename.includes('relaxing')) {
      return 'low'
    }
    
    return 'medium'
  }

  private async getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio()
      const objectUrl = URL.createObjectURL(file)
      
      const cleanup = () => {
        try {
          URL.revokeObjectURL(objectUrl)
        } catch (cleanupError) {
          console.warn(`Failed to revoke object URL for ${file.name}:`, cleanupError)
        }
      }
      
      audio.onloadedmetadata = () => {
        try {
          const duration = Math.round(audio.duration)
          cleanup()
          resolve(Number.isFinite(duration) ? duration : 0)
        } catch (metadataError) {
          console.warn(`Failed to get metadata for ${file.name}:`, metadataError)
          cleanup()
          resolve(0)
        }
      }
      
      audio.onerror = (error) => {
        console.warn(`Audio error for ${file.name}:`, error)
        cleanup()
        resolve(0) // Default duration if we can't get it
      }
      
      // Timeout di sicurezza per evitare che l'operazione si blocchi
      const timeout = setTimeout(() => {
        cleanup()
        resolve(0)
      }, 5000) // Ridotto a 5 secondi per performance
      
      audio.onloadedmetadata = () => {
        clearTimeout(timeout)
        try {
          const duration = Math.round(audio.duration)
          cleanup()
          resolve(Number.isFinite(duration) ? duration : 0)
        } catch (metadataError) {
          console.warn(`Failed to get metadata for ${file.name}:`, metadataError)
          cleanup()
          resolve(0)
        }
      }
      
      audio.onerror = (error) => {
        clearTimeout(timeout)
        console.warn(`Audio error for ${file.name}:`, error)
        cleanup()
        resolve(0)
      }
      
      try {
        audio.src = objectUrl
      } catch (srcError) {
        console.warn(`Failed to set audio src for ${file.name}:`, srcError)
        clearTimeout(timeout)
        cleanup()
        resolve(0)
      }
    })
  }

  // Metodo IBRIDO per calcolare durata (Browser + Electron)
  private async getAudioDurationHybrid(file: File): Promise<number> {
    try {
      console.log(`🔍 [DURATION] Calcolo durata ibrido per: ${file.name}`)
      
      // Controlla se siamo in Electron
      const isElectron = !!((window as any).fileStore) || 
                         ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
      
      if (isElectron) {
        // In Electron, usa FFmpeg se disponibile
        try {
          console.log(`🎯 [DURATION] Tentativo FFmpeg in Electron per: ${file.name}`)
          
          // Per ora, fallback alla stima basata su dimensione
          // TODO: Implementare FFmpeg nativo in Electron
          const estimatedBitrate = 128000 // 128 kbps medio
          const estimatedDuration = (file.size * 8) / estimatedBitrate
          
          console.log(`📊 [DURATION] Durata stimata Electron per ${file.name}: ${Math.round(estimatedDuration)}s`)
          return Math.round(estimatedDuration)
          
        } catch (electronError) {
          console.warn(`⚠️ [DURATION] FFmpeg Electron fallito per ${file.name}:`, electronError)
        }
      }
      
      // Nel browser, usa HTML5 Audio (ma con gestione memoria intelligente)
      let fileUrl: string | undefined
      try {
        console.log(`🌐 [DURATION] Tentativo HTML5 Audio nel browser per: ${file.name}`)
        
        // Crea URL temporaneo
        fileUrl = URL.createObjectURL(file)
        
        // Crea oggetto Audio con timeout
        const audio = new Audio()
        audio.preload = 'metadata' // Carica solo metadata, non tutto l'audio
        
        // Promise con timeout per evitare blocchi
        const durationPromise = new Promise<number>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout caricamento metadata'))
          }, 10000) // 10 secondi di timeout
          
          audio.addEventListener('loadedmetadata', () => {
            clearTimeout(timeout)
            const duration = audio.duration
            if (isFinite(duration) && duration > 0) {
              resolve(duration)
            } else {
              reject(new Error('Durata non valida'))
            }
          })
          
          audio.addEventListener('error', (e) => {
            clearTimeout(timeout)
            reject(new Error(`Errore caricamento audio: ${e}`))
          })
          
          // Imposta la sorgente
          audio.src = fileUrl!
        })
        
        // Attendi la durata
        const duration = await durationPromise
        
        // Pulisci immediatamente
        URL.revokeObjectURL(fileUrl)
        audio.src = ''
        audio.load() // Forza pulizia
        
        console.log(`✅ [DURATION] Durata HTML5 Audio per ${file.name}: ${Math.round(duration)}s`)
        return Math.round(duration)
        
      } catch (audioError) {
        console.warn(`⚠️ [DURATION] HTML5 Audio fallito per ${file.name}:`, audioError)
        
        // Pulisci comunque
        try {
          if (fileUrl) {
            URL.revokeObjectURL(fileUrl)
          }
        } catch {}
      }
      
      // Fallback finale: durata stimata basata sulla dimensione
      const estimatedBitrate = 128000 // 128 kbps medio
      const estimatedDuration = (file.size * 8) / estimatedBitrate
      
      console.log(`📊 [DURATION] Durata fallback per ${file.name}: ${Math.round(estimatedDuration)}s`)
      return Math.round(estimatedDuration)
      
    } catch (error) {
      console.warn(`❌ [DURATION] Errore calcolo durata ibrido per ${file.name}:`, error)
      
      // Fallback finale: durata stimata
      const estimatedBitrate = 128000
      const estimatedDuration = (file.size * 8) / estimatedBitrate
      return Math.round(estimatedDuration)
    }
  }

  private updateProgress(file: File, progress: number, status: UploadProgress['status'], error?: string) {
    if (this.onProgress) {
      this.onProgress({
        file,
        progress,
        status,
        error
      })
    }
  }

  // Batch upload with progress tracking
  async uploadWithProgress(files: FileList | File[]): Promise<{
    tracks: DatabaseTrack[]
    errors: string[]
  }> {
    const fileArray = Array.from(files)
    const validFiles = fileArray.filter(file => this.isValidFile(file))
    
    const tracks: DatabaseTrack[] = []
    const errors: string[] = []
    
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      const progress = Math.round(((i + 1) / validFiles.length) * 100)
      
      try {
        this.updateProgress(file, progress, 'uploading')
        const track = await this.processFile(file)
        
        if (track) {
          try { (window as any).log?.info?.(`Uploaded track ${track.id} (${file.name}) ok`) } catch {}
          tracks.push(track)
        }
      } catch (error) {
        const errorMsg = `Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        try { (window as any).log?.error?.(errorMsg) } catch {}
        errors.push(errorMsg)
        this.updateProgress(file, 0, 'error', errorMsg)
      }

      if ((i + 1) % 50 === 0) {
        try { await this.forceMemoryCleanup() } catch {}
        try { await new Promise(resolve => setTimeout(resolve, 150)) } catch {}
      }
    }
    
    return { tracks, errors }
  }

  // Validate files before upload
  validateFiles(files: FileList | File[]): {
    valid: File[]
    invalid: { file: File; reason: string }[]
  } {
    const fileArray = Array.from(files)
    const valid: File[] = []
    const invalid: { file: File; reason: string }[] = []
    
    fileArray.forEach(file => {
      const lowerName = file.name.toLowerCase()
      const hasValidExt = this.supportedExtensions.some(ext => lowerName.endsWith(ext))
      if (!file.type && !hasValidExt) {
        invalid.push({ file, reason: 'Unsupported file format' })
      } else if (file.type && !this.supportedFormats.includes(file.type) && !hasValidExt) {
        invalid.push({ file, reason: 'Unsupported file format' })
      } else if (file.size > this.maxFileSize) {
        invalid.push({ file, reason: 'File too large' })
      } else {
        valid.push(file)
      }
    })
    
    return { valid, invalid }
  }

  // Get supported formats
  getSupportedFormats(): string[] {
    return [...this.supportedFormats]
  }

  // Get max file size in MB
  getMaxFileSizeMB(): number {
    return this.maxFileSize / 1024 / 1024
  }

  // Clean up object URLs
  cleanupObjectUrls(tracks: DatabaseTrack[]) {
    tracks.forEach(track => {
      if (track.url.startsWith('blob:')) {
        URL.revokeObjectURL(track.url)
      }
    })
  }

  // Forza garbage collection e pulizia memoria
  private forceMemoryCleanup() {
    try {
      // Forza garbage collection se disponibile
      if ('gc' in window) {
        (window as any).gc()
      }
      
      // Pulisci eventuali riferimenti deboli
      if ('WeakRef' in window) {
        // Forza ciclo di garbage collection
        for (let i = 0; i < 1000; i++) {
          new (window as any).WeakRef({})
        }
      }
      
      // Pausa breve per permettere al sistema di "respirare"
      return new Promise(resolve => setTimeout(resolve, 50))
    } catch (error) {
      // Ignora errori di cleanup
      return Promise.resolve()
    }
  }

  // ✅ ULTRA-LEGGERO: Import senza alcuna analisi audio per PC antichi
  async processFileUltraLight(file: File, skipWaveformGeneration: boolean = true): Promise<DatabaseTrack | null> {
    try {
      console.log(`🚀 [ULTRA-LIGHT] Import: ${file.name} (${file.size} bytes)`)
      
      // Update progress to processing
      try { 
        this.updateProgress(file, 0, 'processing') 
      } catch (e) { 
        console.warn(`⚠️ [ULTRA-LIGHT] Errore progresso: ${file.name}`, e)
      }

      // ✅ CRITICAL: Estrazione metadata SOLO dal filename - ZERO analisi audio
      const metadata = this.extractMetadataFromFilename(file.name)
      
      // ✅ ULTRA-LEGGERO (Electron): evita completamente il decode per ridurre RAM
      const isElectronEnvUL = !!((window as any).fileStore) || ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
      let duration = 0
      let waveform: number[] = []
      if (isElectronEnvUL) {
        try {
          duration = await this.getAudioDuration(file)
        } catch (_) {
          duration = 0
        }
        // waveform omesso per massimo risparmio memoria
      } else {
        // Browser: analisi leggera (durata reale + waveform low-res)
        const light = await this.safeAnalyzeAudioLight(file, 64)
        duration = light.duration
        waveform = Array.isArray(light.peaks) ? light.peaks : []
      }
      
      console.log(`⚡ [ULTRA-LIGHT] Metadata: "${metadata.title}" - "${metadata.artist}" - ${duration}s`)

      // Create track object
      const track: Omit<DatabaseTrack, 'id' | 'addedAt' | 'playCount' | 'rating'> = {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        genre: metadata.genre,
        duration: duration, // Calcolato con metodo ibrido
        bpm: metadata.bpm,
        key: metadata.key,
        energy: metadata.energy,
        url: '',
        blobId: undefined,
        fileUrl: undefined,
        waveform: waveform // Sempre vuoto - generato dopo se necessario
      }
      
      console.log(`✅ [FILE] Oggetto track creato per: ${file.name}`)

      // Add to database first (to get trackId), then persist blob with that id and update track
      try { (window as any).log?.info?.(`about to addTrack for ${file.name}`) } catch {}
      
      let trackId: string
      try {
        trackId = await safeDatabaseOperation(
          () => localDatabase.addTrack(track),
          `addTrack for ${file.name}`
        )
        try { (window as any).log?.info?.(`track added id=${trackId} for ${file.name}`) } catch {}
      } catch (dbError) {
        console.error(`Failed to add track to database for ${file.name}:`, dbError)
        throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`)
      }
      
      // On Electron, persist via filesystem to avoid IndexedDB large blob issues
      const isElectronEnvUL2 = !!((window as any).fileStore) || ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
      
      try {
        if (isElectronEnvUL2 && (window as any).fileStore?.saveAudio) {
          try {
            const buf = await file.arrayBuffer()
            const saved = await (window as any).fileStore.saveAudio(trackId, file.name, buf)
            if (saved?.ok && saved.path) {
              try { (window as any).log?.info?.(`file saved at ${saved.path}`) } catch {}
              await localDatabase.updateTrack(trackId, { blobId: trackId, url: `file://${saved.path}`, fileUrl: `file://${saved.path}` })
              // Also save into IndexedDB to ensure persistence after reload when URL is sanitized to idb:
              try {
                await putBlob(trackId, file)
                try { (window as any).log?.info?.(`also stored in IndexedDB as blobId=${trackId}`) } catch {}
              } catch (ie) {
                try { (window as any).log?.warn?.(`failed to store in IndexedDB: ${ie instanceof Error ? ie.message : String(ie)}`) } catch {}
              }
            } else {
              throw new Error(saved?.error || 'saveAudio failed')
            }
          } catch (e) {
            try { (window as any).log?.warn?.(`saveAudio failed, fallback to idb: ${e instanceof Error ? e.message : String(e)}`) } catch {}
            await putBlob(trackId, file)
            await localDatabase.updateTrack(trackId, { blobId: trackId, url: `idb:${trackId}` })
          }
        } else {
          await putBlob(trackId, file)
          await localDatabase.updateTrack(trackId, { blobId: trackId, url: `idb:${trackId}` })
        }
      } catch (storageError) {
        console.error(`Failed to store audio data for ${file.name}:`, storageError)
        // Rimuovi il track dal database se non riusciamo a salvare l'audio
        try {
          await safeDatabaseOperation(
            () => localDatabase.deleteTrack(trackId),
            `deleteTrack cleanup for ${file.name}`
          )
        } catch (deleteError) {
          console.error(`Failed to cleanup track ${trackId} after storage error:`, deleteError)
        }
        throw new Error(`Storage error: ${storageError instanceof Error ? storageError.message : 'Unknown storage error'}`)
      }
      
      let savedTrack: DatabaseTrack | null = null
      try {
        savedTrack = await safeDatabaseOperation(
          () => localDatabase.getTrack(trackId),
          `getTrack for ${file.name}`
        )
      } catch (getError) {
        console.error(`Failed to get saved track ${trackId} for ${file.name}:`, getError)
        throw new Error(`Failed to retrieve saved track: ${getError instanceof Error ? getError.message : 'Unknown error'}`)
      }
      
      if (savedTrack) {
        try {
          this.updateProgress(file, 100, 'completed')
        } catch (progressError) {
          console.warn(`Failed to update progress for ${file.name}:`, progressError)
        }
        return savedTrack
      }

      return null
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error)
      try { (window as any).log?.error?.(`processFileOptimized error ${file.name}: ${error instanceof Error ? error.message : String(error)}`) } catch {}
      this.updateProgress(file, 0, 'error', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  }

  // ✅ HEAVY: Import con analisi audio completa e waveform
  async processFileWithWaveform(file: File): Promise<DatabaseTrack | null> {
    try {
      console.log(`🎚️ [HEAVY] Import con waveform: ${file.name} (${file.size} bytes)`) 
      try { this.updateProgress(file, 0, 'processing') } catch {}

      const metadata = this.extractMetadataFromFilename(file.name)

      // Analisi completa: durata + waveform
      const { duration, peaks } = await this.safeAnalyzeAudio(file)
      const waveform = Array.isArray(peaks) ? peaks : []

      const track: Omit<DatabaseTrack, 'id' | 'addedAt' | 'playCount' | 'rating'> = {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        genre: metadata.genre,
        duration: duration,
        bpm: metadata.bpm,
        key: metadata.key,
        energy: metadata.energy,
        url: '',
        blobId: undefined,
        fileUrl: undefined,
        waveform
      }

      const trackId = await safeDatabaseOperation(
        () => localDatabase.addTrack(track),
        `addTrack(heavy) for ${file.name}`
      )

      // Persist blob (Electron path se disponibile)
      const isElectronEnv = !!((window as any).fileStore) || ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
      if (isElectronEnv && (window as any).fileStore?.saveAudio) {
        try {
          const buf = await file.arrayBuffer()
          const saved = await (window as any).fileStore.saveAudio(trackId, file.name, buf)
          if (saved?.ok && saved.path) {
            await safeDatabaseOperation(
              () => localDatabase.updateTrack(trackId, { blobId: trackId, url: `file://${saved.path}`, fileUrl: `file://${saved.path}` }),
              `updateTrack file path (heavy) for ${file.name}`
            )
            try { await safeDatabaseOperation(() => putBlob(trackId, file), `putBlob(heavy) for ${file.name}`) } catch {}
          } else {
            throw new Error(saved?.error || 'saveAudio failed')
          }
        } catch (_) {
          await safeDatabaseOperation(() => putBlob(trackId, file), `putBlob fallback (heavy) for ${file.name}`)
          await safeDatabaseOperation(() => localDatabase.updateTrack(trackId, { blobId: trackId, url: `idb:${trackId}` }), `updateTrack idb fallback (heavy) for ${file.name}`)
        }
      } else {
        await safeDatabaseOperation(() => putBlob(trackId, file), `putBlob(heavy) for ${file.name}`)
        await safeDatabaseOperation(() => localDatabase.updateTrack(trackId, { blobId: trackId, url: `idb:${trackId}` }), `updateTrack idb (heavy) for ${file.name}`)
      }

      const savedTrack = await safeDatabaseOperation(
        () => localDatabase.getTrack(trackId),
        `getTrack(heavy) for ${file.name}`
      )
      if (savedTrack) {
        try { this.updateProgress(file, 100, 'completed') } catch {}
        return savedTrack
      }
      return null
    } catch (error) {
      console.error(`Error processing file (heavy) ${file.name}:`, error)
      this.updateProgress(file, 0, 'error', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  }
}

export default FileUploadManager
