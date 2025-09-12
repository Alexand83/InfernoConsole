import type { TranslationKeys } from './it'

export const es: TranslationKeys = {
  // Navegación
  nav: {
    console: 'Consola',
    library: 'Biblioteca',
    settings: 'Configuración',
    streaming: 'Transmisión'
  },

  // Consola DJ
  console: {
    deckA: 'Deck A',
    deckB: 'Deck B',
    mixer: 'Mezclador',
    mixerDesc: 'Mueve para mezclar los decks',
    transitionType: 'Tipo de Transición',
    volumeControl: 'Control de Volumen',
    linear: 'Lineal',
    smooth: 'Suave', 
    sharp: 'Rápida',
    play: 'Reproducir',
    pause: 'Pausa',
    stop: 'Parar',
    skipBackward: 'Atrás (-10s)',
    skipForward: 'Adelante (+10s)',
    volume: 'Volumen',
    pitch: 'Tono',
    noTrack: 'Ninguna pista cargada',
    loading: 'Cargando...'
  },

  // Biblioteca
  library: {
    title: 'Biblioteca Musical',
    description: 'Gestiona tu colección musical',
    search: 'Buscar título, artista...',
    selectFolder: 'Seleccionar Carpeta',
    loadFolder: 'Cargar Carpeta',
    importMusic: 'Importar Música',
    totalTracks: 'Total pistas',
    duration: 'Duración',
    artist: 'Artista',
    trackTitle: 'Título',
    album: 'Álbum',
    genre: 'Género',
    year: 'Año',
    bpm: 'BPM',
    key: 'Clave',
    noTracks: 'No se encontraron pistas',
    loadToDeck: 'Cargar al Deck',
    analyzing: 'Analizando...',
    analyzed: 'Analizado',
    error: 'Error'
  },

  // Configuración
  settings: {
    title: 'Configuración',
    description: 'Configura las preferencias de DJ Console',
    reset: 'Restablecer',
    save: 'Guardar',
    
    // Pestañas
    audio: 'Audio',
    microphone: 'Micrófono',
    interface: 'Interfaz',
    recording: 'Grabación',
    streaming: 'Transmisión',
    advanced: 'Avanzado',
    info: 'Info',
    
    // Advanced Settings
    advancedSettings: 'Configuración Avanzada',
    dataManagement: 'Gestión de Datos',
    exportSettings: 'Exportar Configuración',
    importSettings: 'Importar Configuración',
    resetOptions: 'Opciones de Reset',
    resetAudioSettings: 'Reset Configuración Audio',
    resetAudioSettingsDesc: 'Restaurar configuración de audio predeterminada',
    resetInterfaceSettings: 'Reset Configuración Interfaz',
    resetInterfaceSettingsDesc: 'Restaurar preferencias de interfaz predeterminadas',
    resetAllSettings: 'Reset Toda la Configuración',
    resetAllSettingsDesc: 'Restaurar toda la configuración predeterminada',
    about: 'Acerca de',
    version: 'Versión',
    build: 'Build',
    license: 'Licencia',
    author: 'Autor',

    // Audio
    audioSettings: 'Configuración de Audio',
    sampleRate: 'Frecuencia de Muestreo',
    bitDepth: 'Profundidad de Bits',
    bufferSize: 'Tamaño del Buffer',
    latency: 'Latencia',
    crossfadeDuration: 'Duración del Crossfade',
    fadeInOut: 'Fade In/Out de Pistas',
    outputDevice: 'Dispositivo de Salida',
    outputDeviceLocal: 'Dispositivo de Salida (Local)',
    masterVolume: 'Volumen Principal',

    // Micrófono
    microphoneSettings: 'Configuración del Micrófono',
    inputDevice: 'Dispositivo de Entrada',
    inputGain: 'Ganancia de Entrada',
    monitorLevel: 'Nivel de Monitor',
    echoCancellation: 'Cancelación de Eco',
    noiseSuppression: 'Supresión de Ruido',
    autoGainControl: 'Control Automático de Ganancia',
    duckingPercent: 'Porcentaje de Ducking (Baja Música)',
    pushToTalkKey: 'Tecla Push-to-Talk',

    // Interfaz
    interfaceSettings: 'Configuración de Interfaz',
    theme: 'Tema',
    language: 'Idioma',
    showWaveforms: 'Mostrar Formas de Onda',
    showSpectrum: 'Mostrar Analizador de Espectro',
    showBeatGrid: 'Mostrar Rejilla de Beat',
    enableAnimations: 'Habilitar Animaciones'
  },

  // Temas
  themes: {
    dark: '🌙 Oscuro',
    light: '☀️ Claro',
    infernal: '🔥 Infernal',
    auto: '🔄 Automático'
  },

  // Idiomas
  languages: {
    it: '🇮🇹 Italiano',
    en: '🇬🇧 English',
    es: '🇪🇸 Español',
    fr: '🇫🇷 Français',
    de: '🇩🇪 Deutsch'
  },

  // Grabación
  recording: {
    title: 'Configuración de Grabación',
    format: 'Formato',
    quality: 'Calidad',
    autoRecord: 'Grabación Automática',
    saveLocation: 'Ubicación de Guardado',
    maxFileSize: 'Tamaño Máximo de Archivo (MB)'
  },

  // Transmisión
  streaming: {
    title: 'Configuración de Transmisión',
    description: 'Gestiona la transmisión en vivo',
    status: 'Estado',
    connect: 'Conectar',
    disconnect: 'Desconectar',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    connecting: 'Conectando...',
    error: 'Error',
    listeners: 'Oyentes',
    bitrate: 'Bitrate',
    format: 'Formato',
    channels: 'Canales',
    sampleRate: 'Frecuencia de Muestreo',
    uptime: 'Tiempo de Transmisión',
    sendMic: 'Enviar Micrófono',
    micVolume: 'Volumen del Micrófono',
    pushToTalk: 'Push-to-Talk',
    metadata: 'Metadatos',
    currentTrack: 'Pista Actual',
    nextTrack: 'Siguiente Pista',
    defaultBitrate: 'Bitrate Predeterminado',
    defaultFormat: 'Formato Predeterminado',
    autoConnect: 'Conexión Automática',
    reconnectAttempts: 'Intentos de Reconexión',
    serverHost: 'Host del Servidor',
    serverPort: 'Puerto del Servidor',
    mountPoint: 'Punto de Montaje',
    username: 'Nombre de usuario',
    password: 'Contraseña',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    useSSL: 'Usar SSL',
    stationName: 'Nombre de la Estación',
    stationUrl: 'URL de la Estación',
    genre: 'Género'
  },

  // Mensajes comunes
  common: {
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    warning: 'Advertencia',
    info: 'Información',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    ok: 'OK',
    yes: 'Sí',
    no: 'No',
    enabled: 'Habilitado',
    disabled: 'Deshabilitado',
    on: 'Encendido',
    off: 'Apagado',
    high: 'Alto',
    medium: 'Medio',
    low: 'Bajo'
  },

  // Errores
  errors: {
    audioContextFailed: 'No se pudo inicializar el contexto de audio',
    microphoneAccessDenied: 'Acceso al micrófono denegado',
    fileLoadError: 'Error al cargar archivo',
    streamingConnectionFailed: 'Falló la conexión de transmisión',
    settingsSaveFailed: 'Falló el guardado de configuración',
    databaseError: 'Error de base de datos',
    unknownError: 'Error desconocido'
  }
}
