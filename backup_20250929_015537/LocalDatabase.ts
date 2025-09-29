export interface DatabaseTrack {
  id: string
  title: string
  artist: string
  album?: string
  genre?: string
  duration: number
  bpm?: number
  key?: string
  energy?: 'low' | 'medium' | 'high'
  url: string
  blobId?: string
  fileUrl?: string
  waveform?: number[]
  playCount: number
  rating: number
  addedAt: Date
  lastPlayed?: Date
}

export interface DatabasePlaylist {
  id: string
  name: string
  description?: string
  tracks: string[] // track IDs
  isAutoPlaylist: boolean
  autoRules?: {
    genre?: string[]
    bpmRange?: { min: number; max: number }
    energy?: 'low' | 'medium' | 'high'
    maxDuration?: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface IcecastServer {
  id: string
  name: string
  host: string
  port: number
  mount: string
  username: string
  password: string
  useSSL: boolean
  isDefault?: boolean
}

export interface DatabaseSettings {
  audio: {
    sampleRate: number
    bitDepth: number
    bufferSize: number
    latency: number
    crossfadeDuration: number
    fadeInOut: boolean
    outputDevice?: string
  }
  microphone: {
    inputDevice: string
    sampleRate: number
    echoCancellation: boolean
    noiseSuppression: boolean
    autoGainControl: boolean
    duckingPercent?: number
    pushToTalkKey?: string
  }
  interface: {
    theme: 'dark' | 'light' | 'auto'
    language: string
    showWaveform: boolean
    showSpectrum: boolean
    showBeatGrid?: boolean
    animations?: boolean
  }
  streaming: {
    defaultBitrate: number
    defaultFormat: 'mp3' | 'aac' | 'ogg' | 'opus'
    channels: number
    autoConnect: boolean
    reconnectAttempts: number
    bridgeUrl?: string
    icecastServers: IcecastServer[]  // ✅ MULTIPLI SERVER
    defaultIcecastServerId?: string  // ✅ SERVER DI DEFAULT
    metadata?: {
      stationName?: string
      stationUrl?: string
      genre?: string
    }
  }
}

class LocalDatabase {
  private tracks: Map<string, DatabaseTrack> = new Map()
  private playlists: Map<string, DatabasePlaylist> = new Map()
  private settings: DatabaseSettings = this.getDefaultSettings()
  private isInitialized = false
  
  private emitUpdate(kind: 'tracks' | 'playlists' | 'settings') {
    try {
      const evt = new CustomEvent('djconsole:db-updated', { detail: { kind } })
      window.dispatchEvent(evt)
    } catch {}
  }

  constructor() {
    this.initialize()
  }

  private getDefaultSettings(): DatabaseSettings {
    return {
      audio: {
        sampleRate: 48000,  // ✅ FIX: Opus supporta 48000Hz
        bitDepth: 16,
        bufferSize: 4096,   // ✅ BILANCIATO: Buffer moderato per evitare blocchi
        latency: 50,        // ✅ BILANCIATO: Latenza moderata per evitare blocchi
        crossfadeDuration: 3,
        fadeInOut: true,
        outputDevice: 'default'
      },
      microphone: {
        inputDevice: 'default',
        sampleRate: 48000,  // ✅ FIX: Opus supporta 48000Hz
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        duckingPercent: 50,
        pushToTalkKey: 'Space'
      },
      interface: {
        theme: 'dark',
        language: 'it',
        showWaveform: true,
        showSpectrum: true,
        showBeatGrid: true,
        animations: true
      },
      streaming: {
        defaultBitrate: 128,
        defaultFormat: 'opus', // CAMBIATO: era 'mp3', ora usa OPUS come RadioBoss
        channels: 2,
        autoConnect: false,
        reconnectAttempts: 5,
        bridgeUrl: '',
        icecastServers: [  // ✅ SERVER ICECAST INFERNO
          {
            id: 'inferno-server',
            name: 'Inferno Server',
            host: 'dj.onlinewebone.com',
            port: 8004,
            mount: '/live',
            username: 'source',
            password: 'inferno@inferno',
            useSSL: false,
            isDefault: true
          }
        ],
        defaultIcecastServerId: 'inferno-server',  // ✅ SERVER INFERNO DI DEFAULT
        metadata: {
          stationUrl: 'https://dj.onlinewebone.com',
          genre: 'Electronic/Live DJ',
          djName: 'Inferno Console'
        }
      }
    }
  }

  private async initialize() {
    try {
      // Load data from localStorage
      await this.loadFromStorage()
      this.isInitialized = true
      console.log('LocalDatabase initialized successfully')
    } catch (error) {
      console.error('Failed to initialize LocalDatabase:', error)
      // Create default data if loading fails
      this.createDefaultData()
    }
  }

  private async loadFromStorage() {
    try {
      // Prefer Electron JSON DB when available
      const dbStore = (window as any).dbStore
      if (dbStore && typeof dbStore.load === 'function') {
        try {
          const res = await dbStore.load()
          if (res && res.ok && res.data) {
            const data = res.data
            if (Array.isArray(data.tracks)) {
              let changed = false
              for (const raw of data.tracks) {
                const track = { ...raw }
                if (track.addedAt) track.addedAt = new Date(track.addedAt)
                if (track.lastPlayed) track.lastPlayed = new Date(track.lastPlayed)
                if (typeof track.url === 'string' && track.url.startsWith('blob:') && !track.blobId) {
                  changed = true
                  continue
                }
                this.tracks.set(track.id, track)
              }
              if (changed) await this.saveToStorage()
            }
            if (Array.isArray(data.playlists)) {
              data.playlists.forEach((playlist: any) => {
                playlist.createdAt = new Date(playlist.createdAt)
                playlist.updatedAt = new Date(playlist.updatedAt)
                this.playlists.set(playlist.id, playlist)
              })
            }
            if (data.settings) {
              this.settings = { ...this.settings, ...data.settings }
            }
            return
          }
        } catch (e) {
          console.warn('dbStore.load failed, fallback to localStorage', e)
        }
      }

      // Fallback: Load from localStorage
      // Load tracks
      const tracksData = localStorage.getItem('djconsole_tracks')
      if (tracksData) {
        const tracks = JSON.parse(tracksData)
        let changed = false
        for (const raw of tracks) {
          const track = { ...raw }
          track.addedAt = new Date(track.addedAt)
          if (track.lastPlayed) track.lastPlayed = new Date(track.lastPlayed)
          // Drop legacy blob: ObjectURLs persisted without blobId (invalid across reloads)
          if (typeof track.url === 'string' && track.url.startsWith('blob:') && !track.blobId) {
            changed = true
            continue
          }
          this.tracks.set(track.id, track)
        }
        if (changed) {
          await this.saveToStorage()
        }
      }

      // Load playlists
      const playlistsData = localStorage.getItem('djconsole_playlists')
      if (playlistsData) {
        const playlists = JSON.parse(playlistsData)
        playlists.forEach((playlist: any) => {
          playlist.createdAt = new Date(playlist.createdAt)
          playlist.updatedAt = new Date(playlist.updatedAt)
          this.playlists.set(playlist.id, playlist)
        })
      }

      // Load settings
      const settingsData = localStorage.getItem('djconsole_settings')
      if (settingsData) {
        this.settings = { ...this.settings, ...JSON.parse(settingsData) }
      }
    } catch (error) {
      console.error('Error loading from storage:', error)
      throw error
    }
  }

  private async saveToStorage() {
    try {
      // Save tracks (sanitize runtime blob URLs back to idb placeholders when blobId exists)
      const tracksArray = Array.from(this.tracks.values()).map(t => {
        const clone: any = { ...t }
        // Prefer fileUrl when present (Electron persisted path)
        if (clone.fileUrl && typeof clone.fileUrl === 'string' && clone.fileUrl.startsWith('file://')) {
          clone.url = clone.fileUrl
        } else if (clone.blobId) {
          clone.url = `idb:${clone.blobId}`
        }
        return clone
      })
      const playlistsArray = Array.from(this.playlists.values())
      const settingsObj = this.settings

      // Try Electron JSON DB first
      const dbStore = (window as any).dbStore
      if (dbStore && typeof dbStore.save === 'function') {
        try {
          await dbStore.save({ tracks: tracksArray, playlists: playlistsArray, settings: settingsObj })
        } catch (e) {
          console.warn('dbStore.save failed, fallback to localStorage', e)
          localStorage.setItem('djconsole_tracks', JSON.stringify(tracksArray))
          localStorage.setItem('djconsole_playlists', JSON.stringify(playlistsArray))
          localStorage.setItem('djconsole_settings', JSON.stringify(settingsObj))
        }
      } else {
        // Fallback to localStorage
        localStorage.setItem('djconsole_tracks', JSON.stringify(tracksArray))
        localStorage.setItem('djconsole_playlists', JSON.stringify(playlistsArray))
        localStorage.setItem('djconsole_settings', JSON.stringify(settingsObj))
      }
    } catch (error) {
      console.error('Error saving to storage:', error)
      throw error
    }
  }

  private createDefaultData() {
    // Create sample tracks
    const sampleTracks: DatabaseTrack[] = [
      {
        id: 'track_1',
        title: 'Sample Track 1',
        artist: 'Sample Artist',
        album: 'Sample Album',
        genre: 'Electronic',
        duration: 180,
        bpm: 128,
        key: 'C',
        energy: 'high',
        url: '/samples/track1.mp3',
        playCount: 0,
        rating: 0,
        addedAt: new Date()
      },
      {
        id: 'track_2',
        title: 'Sample Track 2',
        artist: 'Sample Artist',
        album: 'Sample Album',
        genre: 'House',
        duration: 200,
        bpm: 125,
        key: 'F',
        energy: 'medium',
        url: '/samples/track2.mp3',
        playCount: 0,
        rating: 0,
        addedAt: new Date()
      }
    ]

    sampleTracks.forEach(track => this.tracks.set(track.id, track))

    // Create sample playlist
    const samplePlaylist: DatabasePlaylist = {
      id: 'playlist_1',
      name: 'Sample Playlist',
      description: 'A sample playlist to get you started',
      tracks: ['track_1', 'track_2'],
      isAutoPlaylist: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.playlists.set(samplePlaylist.id, samplePlaylist)
  }

  // Track Management
  async addTrack(track: Omit<DatabaseTrack, 'id' | 'addedAt' | 'playCount' | 'rating'>): Promise<string> {
    const id = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newTrack: DatabaseTrack = {
      ...track,
      id,
      playCount: 0,
      rating: 0,
      addedAt: new Date()
    }

    try { (window as any).log?.info?.(`LocalDatabase.addTrack: ${id}`) } catch {}
    this.tracks.set(id, newTrack)
    try {
      await this.saveToStorage()
      this.emitUpdate('tracks')
    } catch (e) {
      try { (window as any).log?.error?.(`saveToStorage error: ${e instanceof Error ? e.message : String(e)}`) } catch {}
      throw e
    }
    return id
  }

  async updateTrack(id: string, updates: Partial<DatabaseTrack>): Promise<boolean> {
    const track = this.tracks.get(id)
    if (!track) return false

    const updatedTrack = { ...track, ...updates }
    this.tracks.set(id, updatedTrack)
    await this.saveToStorage()
    this.emitUpdate('tracks')
    return true
  }

  async deleteTrack(id: string): Promise<boolean> {
    const deleted = this.tracks.delete(id)
    if (deleted) {
      // Remove from all playlists
      this.playlists.forEach(playlist => {
        playlist.tracks = playlist.tracks.filter(trackId => trackId !== id)
      })
      await this.saveToStorage()
      this.emitUpdate('tracks')
    }
    return deleted
  }

  async getTrack(id: string): Promise<DatabaseTrack | null> {
    return this.tracks.get(id) || null
  }

  async getTrackResolved(id: string): Promise<DatabaseTrack | null> {
    const t = this.tracks.get(id)
    if (!t) return null
    const track = { ...t }
    try {
      const { getBlobUrl } = await import('./BlobStore')
      if (track.blobId) {
        const url = await getBlobUrl(track.blobId)
        if (url) track.url = url
      } else if (typeof track.url === 'string' && track.url.startsWith('idb:')) {
        const blobId = track.url.slice(4)
        const url = await getBlobUrl(blobId)
        if (url) {
          track.url = url
          track.blobId = blobId
        }
      }
    } catch (e) {
      // IndexedDB not available: fall back to fileUrl if present
      if (track.fileUrl && track.fileUrl.startsWith('file://')) {
        track.url = track.fileUrl
      }
    }
    return track
  }

  async getAllTracks(): Promise<DatabaseTrack[]> {
    // Resolve IndexedDB blob URLs at runtime
    const list = Array.from(this.tracks.values())
    try {
      const { getBlobUrl } = await import('./BlobStore')
      await Promise.all(list.map(async (t) => {
        try {
          if (t.blobId) {
            const url = await getBlobUrl(t.blobId)
            if (url) t.url = url
          } else if (typeof t.url === 'string' && t.url.startsWith('idb:')) {
            const id = t.url.slice(4)
            const url = await getBlobUrl(id)
            if (url) {
              t.url = url
              t.blobId = id
            }
          }
        } catch (_) {
          if (t.fileUrl && t.fileUrl.startsWith('file://')) {
            t.url = t.fileUrl
          }
        }
      }))
    } catch (e) {
      // No IndexedDB module: fall back to file paths
      list.forEach(t => {
        if (t.fileUrl && t.fileUrl.startsWith('file://')) {
          t.url = t.fileUrl
        }
      })
    }
    return list
  }

  async searchTracks(query: string, filters?: {
    genre?: string
    bpmRange?: { min: number; max: number }
    energy?: 'low' | 'medium' | 'high'
    duration?: { min: number; max: number }
  }): Promise<DatabaseTrack[]> {
    let tracks = Array.from(this.tracks.values())

    // Text search
    if (query) {
      const lowerQuery = query.toLowerCase()
      tracks = tracks.filter(track =>
        track.title.toLowerCase().includes(lowerQuery) ||
        track.artist.toLowerCase().includes(lowerQuery) ||
        track.album?.toLowerCase().includes(lowerQuery) ||
        track.genre?.toLowerCase().includes(lowerQuery)
      )
    }

    // Apply filters
    if (filters) {
      if (filters.genre) {
        tracks = tracks.filter(track => track.genre === filters.genre)
      }

      if (filters.bpmRange) {
        tracks = tracks.filter(track => 
          track.bpm && 
          track.bpm >= filters.bpmRange!.min && 
          track.bpm <= filters.bpmRange!.max
        )
      }

      if (filters.energy) {
        tracks = tracks.filter(track => track.energy === filters.energy)
      }

      if (filters.duration) {
        tracks = tracks.filter(track => 
          track.duration >= filters.duration!.min && 
          track.duration <= filters.duration!.max
        )
      }
    }

    return tracks
  }

  async incrementPlayCount(id: string): Promise<void> {
    const track = this.tracks.get(id)
    if (track) {
      track.playCount++
      track.lastPlayed = new Date()
      await this.saveToStorage()
    }
  }

  async setRating(id: string, rating: number): Promise<void> {
    const track = this.tracks.get(id)
    if (track) {
      track.rating = Math.max(0, Math.min(5, rating))
      await this.saveToStorage()
    }
  }

  // Playlist Management
  async createPlaylist(playlist: Omit<DatabasePlaylist, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newPlaylist: DatabasePlaylist = {
      ...playlist,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.playlists.set(id, newPlaylist)
    await this.saveToStorage()
    this.emitUpdate('playlists')
    return id
  }

  async updatePlaylist(id: string, updates: Partial<DatabasePlaylist>): Promise<boolean> {
    const playlist = this.playlists.get(id)
    if (!playlist) return false

    const updatedPlaylist = { 
      ...playlist, 
      ...updates, 
      updatedAt: new Date() 
    }
    this.playlists.set(id, updatedPlaylist)
    await this.saveToStorage()
    this.emitUpdate('playlists')
    return true
  }

  async deletePlaylist(id: string): Promise<boolean> {
    const deleted = this.playlists.delete(id)
    if (deleted) {
      await this.saveToStorage()
      this.emitUpdate('playlists')
    }
    return deleted
  }

  async getPlaylist(id: string): Promise<DatabasePlaylist | null> {
    return this.playlists.get(id) || null
  }

  async getAllPlaylists(): Promise<DatabasePlaylist[]> {
    return Array.from(this.playlists.values())
  }

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    const playlist = this.playlists.get(playlistId)
    if (!playlist) return false

    if (!playlist.tracks.includes(trackId)) {
      playlist.tracks.push(trackId)
      playlist.updatedAt = new Date()
      await this.saveToStorage()
    }
    return true
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    const playlist = this.playlists.get(playlistId)
    if (!playlist) return false

    const index = playlist.tracks.indexOf(trackId)
    if (index > -1) {
      playlist.tracks.splice(index, 1)
      playlist.updatedAt = new Date()
      await this.saveToStorage()
    }
    return true
  }

  async reorderPlaylist(playlistId: string, trackIds: string[]): Promise<boolean> {
    const playlist = this.playlists.get(playlistId)
    if (!playlist) return false

    playlist.tracks = trackIds
    playlist.updatedAt = new Date()
    await this.saveToStorage()
    return true
  }

  // Settings Management
  async getSettings(): Promise<DatabaseSettings> {
    return { ...this.settings }
  }

  async updateSettings(updates: Partial<DatabaseSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates }
    await this.saveToStorage()
    this.emitUpdate('settings')
  }

  // Statistics
  async getStats(): Promise<{
    totalTracks: number
    totalPlaylists: number
    totalPlayTime: number
    mostPlayedTrack: DatabaseTrack | null
    topGenres: { genre: string; count: number }[]
  }> {
    const tracks = Array.from(this.tracks.values())
    const playlists = Array.from(this.playlists.values())

    // Calculate total play time
    const totalPlayTime = tracks.reduce((total, track) => total + (track.duration * track.playCount), 0)

    // Find most played track
    const mostPlayedTrack = tracks.reduce((max, track) => 
      track.playCount > max.playCount ? track : max, tracks[0] || null
    )

    // Calculate top genres
    const genreCounts = new Map<string, number>()
    tracks.forEach(track => {
      if (track.genre) {
        genreCounts.set(track.genre, (genreCounts.get(track.genre) || 0) + 1)
      }
    })

    const topGenres = Array.from(genreCounts.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalTracks: tracks.length,
      totalPlaylists: playlists.length,
      totalPlayTime,
      mostPlayedTrack,
      topGenres
    }
  }

  // Import/Export
  async exportData(): Promise<string> {
    const data = {
      tracks: Array.from(this.tracks.values()),
      playlists: Array.from(this.playlists.values()),
      settings: this.settings,
      exportDate: new Date().toISOString()
    }
    return JSON.stringify(data, null, 2)
  }

  async importData(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData)
      
      if (data.tracks) {
        this.tracks.clear()
        data.tracks.forEach((track: any) => {
          track.addedAt = new Date(track.addedAt)
          if (track.lastPlayed) track.lastPlayed = new Date(track.lastPlayed)
          this.tracks.set(track.id, track)
        })
      }

      if (data.playlists) {
        this.playlists.clear()
        data.playlists.forEach((playlist: any) => {
          playlist.createdAt = new Date(playlist.createdAt)
          playlist.updatedAt = new Date(playlist.updatedAt)
          this.playlists.set(playlist.id, playlist)
        })
      }

      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings }
      }

      await this.saveToStorage()
      return true
    } catch (error) {
      console.error('Import failed:', error)
      return false
    }
  }

  // Cleanup
  async clearAllData(): Promise<void> {
    this.tracks.clear()
    this.playlists.clear()
    this.settings = this.getDefaultSettings()
    await this.saveToStorage()
  }

  // Wait for initialization
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return
    
    return new Promise((resolve) => {
      const checkInit = () => {
        if (this.isInitialized) {
          resolve()
        } else {
          setTimeout(checkInit, 100)
        }
      }
      checkInit()
    })
  }

  // ✅ GESTIONE SERVER ICECAST MULTIPLI
  async getIcecastServers(): Promise<IcecastServer[]> {
    return this.settings.streaming.icecastServers || []
  }

  async getDefaultIcecastServer(): Promise<IcecastServer | null> {
    const servers = await this.getIcecastServers()
    const defaultId = this.settings.streaming.defaultIcecastServerId
    if (defaultId) {
      return servers.find(s => s.id === defaultId) || servers.find(s => s.isDefault) || servers[0] || null
    }
    return servers.find(s => s.isDefault) || servers[0] || null
  }

  async addIcecastServer(server: Omit<IcecastServer, 'id'>): Promise<string> {
    const id = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newServer: IcecastServer = { ...server, id }
    
    this.settings.streaming.icecastServers.push(newServer)
    await this.saveToStorage()
    this.emitUpdate('settings')
    return id
  }

  async updateIcecastServer(id: string, updates: Partial<Omit<IcecastServer, 'id'>>): Promise<boolean> {
    const serverIndex = this.settings.streaming.icecastServers.findIndex(s => s.id === id)
    if (serverIndex === -1) return false
    
    this.settings.streaming.icecastServers[serverIndex] = {
      ...this.settings.streaming.icecastServers[serverIndex],
      ...updates
    }
    
    await this.saveToStorage()
    this.emitUpdate('settings')
    return true
  }

  async deleteIcecastServer(id: string): Promise<boolean> {
    const serverIndex = this.settings.streaming.icecastServers.findIndex(s => s.id === id)
    if (serverIndex === -1) return false
    
    this.settings.streaming.icecastServers.splice(serverIndex, 1)
    
    // Se era il server di default, rimuovi il riferimento
    if (this.settings.streaming.defaultIcecastServerId === id) {
      this.settings.streaming.defaultIcecastServerId = undefined
    }
    
    await this.saveToStorage()
    this.emitUpdate('settings')
    return true
  }

  async setDefaultIcecastServer(id: string): Promise<boolean> {
    const server = this.settings.streaming.icecastServers.find(s => s.id === id)
    if (!server) return false
    
    // Rimuovi isDefault da tutti i server
    this.settings.streaming.icecastServers.forEach(s => s.isDefault = false)
    
    // Imposta il nuovo server di default
    server.isDefault = true
    this.settings.streaming.defaultIcecastServerId = id
    
    await this.saveToStorage()
    this.emitUpdate('settings')
    return true
  }
}

// Export singleton instance
export const localDatabase = new LocalDatabase()
export default localDatabase
