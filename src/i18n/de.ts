import type { TranslationKeys } from './it'

export const de: TranslationKeys = {
  // Navigation
  nav: {
    console: 'Konsole',
    library: 'Bibliothek',
    settings: 'Einstellungen',
    streaming: 'Streaming'
  },

  // DJ Console
  console: {
    deckA: 'Deck A',
    deckB: 'Deck B',
    mixer: 'Mixer',
    mixerDesc: 'Bewegen zum Mischen der Decks',
    transitionType: 'Übergangstyp',
    volumeControl: 'Lautstärkeregelung',
    linear: 'Linear',
    smooth: 'Sanft', 
    sharp: 'Scharf',
    play: 'Abspielen',
    pause: 'Pause',
    stop: 'Stopp',
    skipBackward: 'Zurück (-10s)',
    skipForward: 'Vorwärts (+10s)',
    volume: 'Lautstärke',
    pitch: 'Tonhöhe',
    noTrack: 'Kein Track geladen',
    loading: 'Laden...'
  },

  // Bibliothek
  library: {
    title: 'Musikbibliothek',
    description: 'Verwalte deine Musiksammlung',
    search: 'Titel, Künstler suchen...',
    selectFolder: 'Ordner Auswählen',
    loadFolder: 'Ordner Laden',
    importMusic: 'Musik Importieren',
    totalTracks: 'Gesamte Tracks',
    duration: 'Dauer',
    artist: 'Künstler',
    trackTitle: 'Titel',
    album: 'Album',
    genre: 'Genre',
    year: 'Jahr',
    bpm: 'BPM',
    key: 'Tonart',
    noTracks: 'Keine Tracks gefunden',
    loadToDeck: 'Zu Deck Laden',
    analyzing: 'Analysiere...',
    analyzed: 'Analysiert',
    error: 'Fehler'
  },

  // Einstellungen
  settings: {
    title: 'Einstellungen',
    description: 'Konfiguriere deine DJ Console Einstellungen',
    reset: 'Zurücksetzen',
    save: 'Speichern',
    
    // Tabs
    audio: 'Audio',
    microphone: 'Mikrofon',
    interface: 'Oberfläche',
    recording: 'Aufnahme',
    streaming: 'Streaming',
    advanced: 'Erweitert',
    info: 'Info',
    
    // Advanced Settings
    advancedSettings: 'Erweiterte Einstellungen',
    dataManagement: 'Datenverwaltung',
    exportSettings: 'Einstellungen Exportieren',
    importSettings: 'Einstellungen Importieren',
    resetOptions: 'Reset-Optionen',
    resetAudioSettings: 'Audio-Einstellungen Zurücksetzen',
    resetAudioSettingsDesc: 'Standard-Audiokonfiguration wiederherstellen',
    resetInterfaceSettings: 'Interface-Einstellungen Zurücksetzen',
    resetInterfaceSettingsDesc: 'Standard-Interface-Präferenzen wiederherstellen',
    resetAllSettings: 'Alle Einstellungen Zurücksetzen',
    resetAllSettingsDesc: 'Alle Standardeinstellungen wiederherstellen',
    about: 'Über',
    version: 'Version',
    build: 'Build',
    license: 'Lizenz',
    author: 'Autor',

    // Audio
    audioSettings: 'Audio-Einstellungen',
    sampleRate: 'Abtastrate',
    bitDepth: 'Bit-Tiefe',
    bufferSize: 'Puffergröße',
    latency: 'Latenz',
    crossfadeDuration: 'Crossfade-Dauer',
    fadeInOut: 'Fade In/Out Tracks',
    outputDevice: 'Ausgabegerät',
    outputDeviceLocal: 'Ausgabegerät (Lokal)',
    masterVolume: 'Master-Lautstärke',

    // Mikrofon
    microphoneSettings: 'Mikrofon-Einstellungen',
    inputDevice: 'Eingabegerät',
    inputGain: 'Eingangsverstärkung',
    monitorLevel: 'Monitor-Pegel',
    echoCancellation: 'Echo-Unterdrückung',
    noiseSuppression: 'Rauschunterdrückung',
    autoGainControl: 'Automatische Verstärkungsregelung',
    duckingPercent: 'Ducking-Prozent (Musik Senken)',
    pushToTalkKey: 'Push-to-Talk Taste',

    // Oberfläche
    interfaceSettings: 'Oberflächen-Einstellungen',
    theme: 'Theme',
    language: 'Sprache',
    showWaveforms: 'Wellenformen Anzeigen',
    showSpectrum: 'Spektrum-Analyzer Anzeigen',
    showBeatGrid: 'Beat-Raster Anzeigen',
    enableAnimations: 'Animationen Aktivieren'
  },

  // Themes
  themes: {
    dark: '🌙 Dunkel',
    light: '☀️ Hell',
    infernal: '🔥 Infernal',
    auto: '🔄 Automatisch'
  },

  // Sprachen
  languages: {
    it: '🇮🇹 Italiano',
    en: '🇬🇧 English',
    es: '🇪🇸 Español',
    fr: '🇫🇷 Français',
    de: '🇩🇪 Deutsch'
  },

  // Aufnahme
  recording: {
    title: 'Aufnahme-Einstellungen',
    format: 'Format',
    quality: 'Qualität',
    autoRecord: 'Automatische Aufnahme',
    saveLocation: 'Speicherort',
    maxFileSize: 'Maximale Dateigröße (MB)'
  },

  // Streaming
  streaming: {
    title: 'Streaming-Einstellungen',
    description: 'Live-Übertragung verwalten',
    status: 'Status',
    connect: 'Verbinden',
    disconnect: 'Trennen',
    connected: 'Verbunden',
    disconnected: 'Getrennt',
    connecting: 'Verbinde...',
    error: 'Fehler',
    listeners: 'Zuhörer',
    bitrate: 'Bitrate',
    format: 'Format',
    channels: 'Kanäle',
    sampleRate: 'Abtastrate',
    uptime: 'Sendezeit',
    sendMic: 'Mikrofon Senden',
    micVolume: 'Mikrofon-Lautstärke',
    pushToTalk: 'Push-to-Talk',
    activatePTT: 'PTT Aktivieren',
    pttActive: 'PTT Aktiv',
    pttInstruction: 'PTT: Halten Sie {key} gedrückt, um das Mikrofon zu aktivieren',
    metadata: 'Metadaten',
    currentTrack: 'Aktueller Track',
    nextTrack: 'Nächster Track',
    defaultBitrate: 'Standard-Bitrate',
    defaultFormat: 'Standard-Format',
    autoConnect: 'Automatisch Verbinden',
    reconnectAttempts: 'Wiederverbindungsversuche',
    serverHost: 'Server-Host',
    serverPort: 'Server-Port',
    mountPoint: 'Mount-Point',
    username: 'Benutzername',
    password: 'Passwort',
    showPassword: 'Passwort anzeigen',
    hidePassword: 'Passwort ausblenden',
    useSSL: 'SSL verwenden',
    stationName: 'Sender-Name',
    stationUrl: 'Sender-URL',
    genre: 'Genre'
  },

  // Gemeinsame Nachrichten
  common: {
    loading: 'Laden...',
    error: 'Fehler',
    success: 'Erfolg',
    warning: 'Warnung',
    info: 'Information',
    confirm: 'Bestätigen',
    cancel: 'Abbrechen',
    ok: 'OK',
    yes: 'Ja',
    no: 'Nein',
    enabled: 'Aktiviert',
    disabled: 'Deaktiviert',
    on: 'Ein',
    off: 'Aus',
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig'
  },

  // Fehler
  errors: {
    audioContextFailed: 'Audio-Kontext konnte nicht initialisiert werden',
    microphoneAccessDenied: 'Mikrofon-Zugriff verweigert',
    fileLoadError: 'Datei-Ladefehler',
    streamingConnectionFailed: 'Streaming-Verbindung fehlgeschlagen',
    settingsSaveFailed: 'Speichern der Einstellungen fehlgeschlagen',
    databaseError: 'Datenbankfehler',
    unknownError: 'Unbekannter Fehler'
  }
}
