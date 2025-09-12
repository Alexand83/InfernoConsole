import type { TranslationKeys } from './it'

export const en: TranslationKeys = {
  // Navigation
  nav: {
    console: 'Console',
    library: 'Library',
    settings: 'Settings',
    streaming: 'Streaming'
  },

  // DJ Console
  console: {
    deckA: 'Deck A',
    deckB: 'Deck B',
    mixer: 'Mixer',
    mixerDesc: 'Move to mix decks',
    transitionType: 'Transition Type',
    volumeControl: 'Volume Control',
    linear: 'Linear',
    smooth: 'Smooth', 
    sharp: 'Sharp',
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
    skipBackward: 'Skip Backward (-10s)',
    skipForward: 'Skip Forward (+10s)',
    volume: 'Volume',
    pitch: 'Pitch',
    noTrack: 'No track loaded',
    loading: 'Loading...'
  },

  // Library
  library: {
    title: 'Music Library',
    description: 'Manage your music collection',
    search: 'Search title, artist...',
    selectFolder: 'Select Folder',
    loadFolder: 'Load Folder',
    importMusic: 'Import Music',
    totalTracks: 'Total tracks',
    duration: 'Duration',
    artist: 'Artist',
    trackTitle: 'Title',
    album: 'Album',
    genre: 'Genre',
    year: 'Year',
    bpm: 'BPM',
    key: 'Key',
    noTracks: 'No tracks found',
    loadToDeck: 'Load to Deck',
    analyzing: 'Analyzing...',
    analyzed: 'Analyzed',
    error: 'Error'
  },

  // Settings
  settings: {
    title: 'Settings',
    description: 'Configure your DJ Console preferences',
    reset: 'Reset',
    save: 'Save',
    
    // Tabs
    audio: 'Audio',
    microphone: 'Microphone',
    interface: 'Interface',
    recording: 'Recording',
    streaming: 'Streaming',
    advanced: 'Advanced',
    info: 'Info',
    
    // Advanced Settings
    advancedSettings: 'Advanced Settings',
    dataManagement: 'Data Management',
    exportSettings: 'Export Settings',
    importSettings: 'Import Settings',
    resetOptions: 'Reset Options',
    resetAudioSettings: 'Reset Audio Settings',
    resetAudioSettingsDesc: 'Restore default audio configuration',
    resetInterfaceSettings: 'Reset Interface Settings',
    resetInterfaceSettingsDesc: 'Restore default interface preferences',
    resetAllSettings: 'Reset All Settings',
    resetAllSettingsDesc: 'Restore all default settings',
    about: 'About',
    version: 'Version',
    build: 'Build',
    license: 'License',
    author: 'Author',
    
    // Info page
    systemInfo: 'System Information',
    appInfo: 'App Information',
    libraries: 'Used Libraries',
    checkUpdates: 'Check for Updates',
    lastChecked: 'Last checked',
    checkingUpdates: 'Checking for updates...',
    noUpdates: 'No updates available',
    updatesAvailable: 'Updates available',
    checkNow: 'Check Now',
    updateUrl: 'Update URL',
    libraryName: 'Library Name',
    libraryVersion: 'Version',
    libraryLicense: 'License',
    libraryDescription: 'Description',

    // Audio
    audioSettings: 'Audio Settings',
    sampleRate: 'Sample Rate',
    bufferSize: 'Buffer Size',
    outputDevice: 'Output Device',
    outputDeviceLocal: 'Output Device (Local)',
    masterVolume: 'Master Volume',
    crossfaderCurve: 'Crossfader Curve',

    // Microphone
    microphoneSettings: 'Microphone Settings',
    inputDevice: 'Input Device',
    inputGain: 'Input Gain',
    monitorLevel: 'Monitor Level',
    echoCancellation: 'Echo Cancellation',
    noiseSuppression: 'Noise Suppression',
    autoGainControl: 'Auto Gain Control',
    duckingPercent: 'Ducking Percent',
    pushToTalkKey: 'Push-to-Talk Key',

    // Interface
    interfaceSettings: 'Interface Settings',
    theme: 'Theme',
    language: 'Language',
    showWaveforms: 'Show Waveforms',
    showSpectrum: 'Show Spectrum Analyzer',
    showBeatGrid: 'Show Beat Grid',
    enableAnimations: 'Enable Animations',

  },

  // Themes
  themes: {
    dark: '🌙 Dark',
    light: '☀️ Light',
    infernal: '🔥 Infernal',
    auto: '🔄 Auto'
  },

  // Languages
  languages: {
    it: '🇮🇹 Italiano',
    en: '🇬🇧 English',
    es: '🇪🇸 Español',
    fr: '🇫🇷 Français',
    de: '🇩🇪 Deutsch'
  },

  // Recording
  recording: {
    title: 'Recording Settings',
    format: 'Format',
    quality: 'Quality',
    autoRecord: 'Auto Record',
    saveLocation: 'Save Location',
    maxFileSize: 'Max File Size (MB)'
  },

  // Streaming
  streaming: {
    title: 'Streaming Settings',
    description: 'Manage live broadcasting',
    status: 'Status',
    connect: 'Connect',
    disconnect: 'Disconnect',
    connected: 'Connected',
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    error: 'Error',
    listeners: 'Listeners',
    bitrate: 'Bitrate',
    format: 'Format',
    channels: 'Channels',
    sampleRate: 'Sample Rate',
    uptime: 'Uptime',
    sendMic: 'Send Microphone',
    micVolume: 'Microphone Volume',
    pushToTalk: 'Push-to-Talk',
    metadata: 'Metadata',
    currentTrack: 'Current Track',
    nextTrack: 'Next Track',
    defaultBitrate: 'Default Bitrate',
    defaultFormat: 'Default Format',
    autoConnect: 'Auto Connect',
    reconnectAttempts: 'Reconnect Attempts',
    serverHost: 'Server Host',
    serverPort: 'Server Port',
    mountPoint: 'Mount Point',
    username: 'Username',
    password: 'Password',
    showPassword: 'Show Password',
    hidePassword: 'Hide Password',
    useSSL: 'Use SSL',
    stationName: 'Station Name',
    stationUrl: 'Station URL',
    genre: 'Genre',

    // Info
    systemInfo: 'System Information',
    microphonePermissions: 'Microphone Permissions',
    microphoneAccess: 'Microphone Access',
    microphoneAccessDesc: 'Browser has access to microphone for DJ functionality.',
    testMicrophoneAccess: 'Test Microphone Access',
    microphonePermissionGranted: 'Microphone permission granted!',
    microphonePermissionDenied: 'Microphone permission denied. Check browser settings.',
    browserInfo: 'Browser Information',
    browser: 'Browser',
    platform: 'Platform',
    language: 'Language',
    audioDevices: 'Audio Devices',
    inputDevices: 'Input Devices',
    outputDevices: 'Output Devices',
    devicesFound: 'devices found',
    noDevicesFound: 'No devices found',
    refreshDevices: 'Refresh Devices',
    appInfo: 'App Information',
    version: 'Version',
    build: 'Build',
    license: 'License',
    author: 'Author'
  },

  // Common messages
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Information',
    confirm: 'Confirm',
    cancel: 'Cancel',
    ok: 'OK',
    yes: 'Yes',
    no: 'No',
    enabled: 'Enabled',
    disabled: 'Disabled',
    on: 'On',
    off: 'Off',
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  },

  // Errors
  errors: {
    audioContextFailed: 'Failed to initialize audio context',
    microphoneAccessDenied: 'Microphone access denied',
    fileLoadError: 'File loading error',
    streamingConnectionFailed: 'Streaming connection failed',
    settingsSaveFailed: 'Settings save failed',
    databaseError: 'Database error',
    unknownError: 'Unknown error'
  }
}
