export const it = {
  // Navigazione
  nav: {
    console: 'Console',
    library: 'Libreria',
    settings: 'Impostazioni',
    streaming: 'Streaming'
  },

  // Console DJ
  console: {
    deckA: 'Deck A',
    deckB: 'Deck B',
    mixer: 'Mixer',
    mixerDesc: 'Sposta per mixare i deck',
    transitionType: 'Tipo di Transizione',
    volumeControl: 'Controllo Volume',
    linear: 'Lineare',
    smooth: 'Fluida', 
    sharp: 'Rapida',
    play: 'Play',
    pause: 'Pausa',
    stop: 'Stop',
    skipBackward: 'Indietro (-10s)',
    skipForward: 'Avanti (+10s)',
    volume: 'Volume',
    pitch: 'Pitch',
    noTrack: 'Nessuna traccia caricata',
    loading: 'Caricamento...'
  },

  // Libreria
  library: {
    title: 'Libreria Musicale',
    description: 'Gestisci la tua collezione musicale',
    search: 'Cerca titolo, artista...',
    selectFolder: 'Seleziona Cartella',
    loadFolder: 'Carica Cartella',
    importMusic: 'Importa Musica',
    totalTracks: 'Totale tracce',
    duration: 'Durata',
    artist: 'Artista',
    trackTitle: 'Titolo',
    album: 'Album',
    genre: 'Genere',
    year: 'Anno',
    bpm: 'BPM',
    key: 'Tonalità',
    noTracks: 'Nessuna traccia trovata',
    loadToDeck: 'Carica nel Deck',
    analyzing: 'Analizzando...',
    analyzed: 'Analizzato',
    error: 'Errore'
  },

  // Impostazioni
  settings: {
    title: 'Impostazioni',
    description: 'Configura le preferenze di Inferno Console',
    reset: 'Reset',
    save: 'Salva',
    
    // Tabs
    audio: 'Audio',
    microphone: 'Microfono',
    interface: 'Interfaccia',
    recording: 'Registrazione',
    streaming: 'Streaming',
    advanced: 'Avanzate',
    info: 'Info',
    
    // Advanced Settings
    advancedSettings: 'Impostazioni Avanzate',
    dataManagement: 'Gestione Dati',
    exportSettings: 'Esporta Impostazioni',
    importSettings: 'Importa Impostazioni',
    resetOptions: 'Opzioni Reset',
    resetAudioSettings: 'Reset Impostazioni Audio',
    resetAudioSettingsDesc: 'Ripristina configurazione audio predefinita',
    resetInterfaceSettings: 'Reset Impostazioni Interfaccia',
    resetInterfaceSettingsDesc: 'Ripristina preferenze interfaccia predefinite',
    resetAllSettings: 'Reset Tutte le Impostazioni',
    resetAllSettingsDesc: 'Ripristina tutte le impostazioni predefinite',
    about: 'Informazioni',
    version: 'Versione',
    build: 'Build',
    license: 'Licenza',
    author: 'Autore',
    
    // Info page
    systemInfo: 'Informazioni Sistema',
    appInfo: 'Informazioni App',
    libraries: 'Librerie Utilizzate',
    checkUpdates: 'Verifica Aggiornamenti',
    lastChecked: 'Ultima verifica',
    checkingUpdates: 'Verificando aggiornamenti...',
    noUpdates: 'Nessun aggiornamento disponibile',
    updatesAvailable: 'Aggiornamenti disponibili',
    checkNow: 'Verifica Ora',
    updateUrl: 'URL Aggiornamenti',
    libraryName: 'Nome Libreria',
    libraryVersion: 'Versione',
    libraryLicense: 'Licenza',
    libraryDescription: 'Descrizione',

    // Audio
    audioSettings: 'Impostazioni Audio',
    sampleRate: 'Frequenza di Campionamento',
    bitDepth: 'Profondità Bit',
    bufferSize: 'Dimensione Buffer',
    latency: 'Latenza',
    crossfadeDuration: 'Durata Crossfade',
    fadeInOut: 'Fade In/Out Tracce',
    outputDevice: 'Dispositivo di Uscita',
    outputDeviceLocal: 'Dispositivo di Uscita (Locale)',
    masterVolume: 'Volume Master',

    // Microfono
    microphoneSettings: 'Impostazioni Microfono',
    inputDevice: 'Dispositivo di Ingresso',
    inputGain: 'Guadagno Ingresso',
    monitorLevel: 'Livello Monitor',
    echoCancellation: 'Cancellazione Eco',
    noiseSuppression: 'Soppressione Rumore',
    autoGainControl: 'Controllo Guadagno Automatico',
    duckingPercent: 'Percentuale Ducking (Abbassa Musica)',
    pushToTalkKey: 'Tasto Push-to-Talk',

    // Interfaccia
    interfaceSettings: 'Impostazioni Interfaccia',
    theme: 'Tema',
    language: 'Lingua',
    showWaveforms: 'Mostra Forme d\'Onda',
    showSpectrum: 'Mostra Analizzatore di Spettro',
    showBeatGrid: 'Mostra Griglia Beat',
    enableAnimations: 'Abilita Animazioni',
    // Aggiungo traduzioni mancanti
    autoRecord: 'Registrazione Automatica',
    saveLocation: 'Posizione Salvataggio',
    maxFileSize: 'Dimensione Massima File (MB)',
    defaultBitrate: 'Bitrate Predefinito',
    defaultFormat: 'Formato Predefinito',
    autoConnect: 'Connessione Automatica',
    reconnectAttempts: 'Tentativi Riconnessione',
    serverHost: 'Host Server',
    serverPort: 'Porta Server',
    mountPoint: 'Punto di Mount',
    username: 'Nome Utente',
    password: 'Password',
    useSSL: 'Usa SSL',
    stationName: 'Nome Stazione',
    stationUrl: 'URL Stazione',
    genre: 'Genere',

    // Info
    microphonePermissions: 'Permessi Microfono',
    microphoneAccess: 'Accesso Microfono',
    microphoneAccessDesc: 'Il browser ha accesso al microfono per la funzionalità DJ.',
    testMicrophoneAccess: 'Testa Accesso Microfono',
    microphonePermissionGranted: 'Permesso microfono concesso!',
    microphonePermissionDenied: 'Permesso microfono negato. Controlla le impostazioni del browser.',
    browserInfo: 'Informazioni Browser',
    browser: 'Browser',
    platform: 'Piattaforma',
    audioDevices: 'Dispositivi Audio',
    inputDevices: 'Dispositivi di Input',
    outputDevices: 'Dispositivi di Output',
    devicesFound: 'dispositivi trovati',
    noDevicesFound: 'Nessun dispositivo trovato',
    refreshDevices: 'Aggiorna Dispositivi'
  },

  // Temi
  themes: {
    dark: '🌙 Scuro',
    light: '☀️ Chiaro',
    infernal: '🔥 Infernale',
    auto: '🔄 Automatico'
  },

  // Lingue
  languages: {
    it: '🇮🇹 Italiano',
    en: '🇬🇧 English',
    es: '🇪🇸 Español',
    fr: '🇫🇷 Français',
    de: '🇩🇪 Deutsch'
  },

  // Registrazione
  recording: {
    title: 'Impostazioni Registrazione',
    format: 'Formato',
    quality: 'Qualità',
    autoRecord: 'Registrazione Automatica',
    saveLocation: 'Posizione Salvataggio',
    maxFileSize: 'Dimensione Massima File (MB)'
  },

  // Streaming
  streaming: {
    title: 'Impostazioni Streaming',
    description: 'Gestisci la trasmissione live',
    status: 'Stato',
    connect: 'Connetti',
    disconnect: 'Disconnetti',
    connected: 'Connesso',
    disconnected: 'Disconnesso',
    connecting: 'Connettendo...',
    error: 'Errore',
    listeners: 'Ascoltatori',
    bitrate: 'Bitrate',
    format: 'Formato',
    channels: 'Canali',
    sampleRate: 'Frequenza Campionamento',
    uptime: 'Tempo di Trasmissione',
    sendMic: 'Invia Microfono',
    micVolume: 'Volume Microfono',
    pushToTalk: 'Push-to-Talk',
    metadata: 'Metadati',
    currentTrack: 'Traccia Corrente',
    nextTrack: 'Prossima Traccia',
    defaultBitrate: 'Bitrate Predefinito',
    defaultFormat: 'Formato Predefinito',
    autoConnect: 'Connessione Automatica',
    reconnectAttempts: 'Tentativi Riconnessione',
    serverHost: 'Host Server',
    serverPort: 'Porta Server',
    mountPoint: 'Punto di Mount',
    username: 'Nome Utente',
    password: 'Password',
    showPassword: 'Mostra Password',
    hidePassword: 'Nascondi Password',
    useSSL: 'Usa SSL',
    stationName: 'Nome Stazione',
    stationUrl: 'URL Stazione',
    genre: 'Genere'
  },

  // Messaggi comuni
  common: {
    loading: 'Caricamento...',
    error: 'Errore',
    success: 'Successo',
    warning: 'Attenzione',
    info: 'Informazione',
    confirm: 'Conferma',
    cancel: 'Annulla',
    ok: 'OK',
    yes: 'Sì',
    no: 'No',
    enabled: 'Abilitato',
    disabled: 'Disabilitato',
    on: 'Acceso',
    off: 'Spento',
    high: 'Alto',
    medium: 'Medio',
    low: 'Basso'
  },

  // Errori
  errors: {
    audioContextFailed: 'Impossibile inizializzare il contesto audio',
    microphoneAccessDenied: 'Accesso al microfono negato',
    fileLoadError: 'Errore nel caricamento del file',
    streamingConnectionFailed: 'Connessione streaming fallita',
    settingsSaveFailed: 'Salvataggio impostazioni fallito',
    databaseError: 'Errore del database',
    unknownError: 'Errore sconosciuto'
  }
}

export type TranslationKeys = typeof it
