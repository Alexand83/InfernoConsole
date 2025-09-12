import type { TranslationKeys } from './it'

export const fr: TranslationKeys = {
  // Navigation
  nav: {
    console: 'Console',
    library: 'Bibliothèque',
    settings: 'Paramètres',
    streaming: 'Streaming'
  },

  // Console DJ
  console: {
    deckA: 'Deck A',
    deckB: 'Deck B',
    mixer: 'Mixeur',
    mixerDesc: 'Déplacer pour mixer les decks',
    transitionType: 'Type de Transition',
    volumeControl: 'Contrôle du Volume',
    linear: 'Linéaire',
    smooth: 'Fluide', 
    sharp: 'Rapide',
    play: 'Lecture',
    pause: 'Pause',
    stop: 'Arrêt',
    skipBackward: 'Retour (-10s)',
    skipForward: 'Avance (+10s)',
    volume: 'Volume',
    pitch: 'Hauteur',
    noTrack: 'Aucune piste chargée',
    loading: 'Chargement...'
  },

  // Bibliothèque
  library: {
    title: 'Bibliothèque Musicale',
    description: 'Gérez votre collection musicale',
    search: 'Rechercher titre, artiste...',
    selectFolder: 'Sélectionner Dossier',
    loadFolder: 'Charger Dossier',
    importMusic: 'Importer Musique',
    totalTracks: 'Total pistes',
    duration: 'Durée',
    artist: 'Artiste',
    trackTitle: 'Titre',
    album: 'Album',
    genre: 'Genre',
    year: 'Année',
    bpm: 'BPM',
    key: 'Tonalité',
    noTracks: 'Aucune piste trouvée',
    loadToDeck: 'Charger sur Deck',
    analyzing: 'Analyse...',
    analyzed: 'Analysé',
    error: 'Erreur'
  },

  // Paramètres
  settings: {
    title: 'Paramètres',
    description: 'Configurez vos préférences DJ Console',
    reset: 'Réinitialiser',
    save: 'Sauvegarder',
    
    // Onglets
    audio: 'Audio',
    microphone: 'Microphone',
    interface: 'Interface',
    recording: 'Enregistrement',
    streaming: 'Streaming',
    advanced: 'Avancé',
    info: 'Info',
    
    // Advanced Settings
    advancedSettings: 'Paramètres Avancés',
    dataManagement: 'Gestion des Données',
    exportSettings: 'Exporter les Paramètres',
    importSettings: 'Importer les Paramètres',
    resetOptions: 'Options de Reset',
    resetAudioSettings: 'Reset Paramètres Audio',
    resetAudioSettingsDesc: 'Restaurer la configuration audio par défaut',
    resetInterfaceSettings: 'Reset Paramètres Interface',
    resetInterfaceSettingsDesc: 'Restaurer les préférences d\'interface par défaut',
    resetAllSettings: 'Reset Tous les Paramètres',
    resetAllSettingsDesc: 'Restaurer tous les paramètres par défaut',
    about: 'À Propos',
    version: 'Version',
    build: 'Build',
    license: 'Licence',
    author: 'Auteur',

    // Audio
    audioSettings: 'Paramètres Audio',
    sampleRate: 'Fréquence d\'Échantillonnage',
    bitDepth: 'Profondeur de Bits',
    bufferSize: 'Taille du Buffer',
    latency: 'Latence',
    crossfadeDuration: 'Durée du Crossfade',
    fadeInOut: 'Fade In/Out des Pistes',
    outputDevice: 'Périphérique de Sortie',
    outputDeviceLocal: 'Périphérique de Sortie (Local)',
    masterVolume: 'Volume Principal',

    // Microphone
    microphoneSettings: 'Paramètres du Microphone',
    inputDevice: 'Périphérique d\'Entrée',
    inputGain: 'Gain d\'Entrée',
    monitorLevel: 'Niveau de Monitoring',
    echoCancellation: 'Suppression d\'Écho',
    noiseSuppression: 'Suppression de Bruit',
    autoGainControl: 'Contrôle Automatique du Gain',
    duckingPercent: 'Pourcentage de Ducking (Baisse Musique)',
    pushToTalkKey: 'Touche Push-to-Talk',

    // Interface
    interfaceSettings: 'Paramètres d\'Interface',
    theme: 'Thème',
    language: 'Langue',
    showWaveforms: 'Afficher les Formes d\'Onde',
    showSpectrum: 'Afficher l\'Analyseur de Spectre',
    showBeatGrid: 'Afficher la Grille de Beat',
    enableAnimations: 'Activer les Animations'
  },

  // Thèmes
  themes: {
    dark: '🌙 Sombre',
    light: '☀️ Clair',
    infernal: '🔥 Infernal',
    auto: '🔄 Automatique'
  },

  // Langues
  languages: {
    it: '🇮🇹 Italiano',
    en: '🇬🇧 English',
    es: '🇪🇸 Español',
    fr: '🇫🇷 Français',
    de: '🇩🇪 Deutsch'
  },

  // Enregistrement
  recording: {
    title: 'Paramètres d\'Enregistrement',
    format: 'Format',
    quality: 'Qualité',
    autoRecord: 'Enregistrement Automatique',
    saveLocation: 'Emplacement de Sauvegarde',
    maxFileSize: 'Taille Maximale de Fichier (MB)'
  },

  // Streaming
  streaming: {
    title: 'Paramètres de Streaming',
    description: 'Gérer la diffusion en direct',
    status: 'Statut',
    connect: 'Connecter',
    disconnect: 'Déconnecter',
    connected: 'Connecté',
    disconnected: 'Déconnecté',
    connecting: 'Connexion...',
    error: 'Erreur',
    listeners: 'Auditeurs',
    bitrate: 'Bitrate',
    format: 'Format',
    channels: 'Canaux',
    sampleRate: 'Fréquence d\'Échantillonnage',
    uptime: 'Temps de Diffusion',
    sendMic: 'Envoyer Microphone',
    micVolume: 'Volume du Microphone',
    pushToTalk: 'Push-to-Talk',
    metadata: 'Métadonnées',
    currentTrack: 'Piste Actuelle',
    nextTrack: 'Piste Suivante',
    defaultBitrate: 'Bitrate par Défaut',
    defaultFormat: 'Format par Défaut',
    autoConnect: 'Connexion Automatique',
    reconnectAttempts: 'Tentatives de Reconnexion',
    serverHost: 'Hôte du Serveur',
    serverPort: 'Port du Serveur',
    mountPoint: 'Point de Montage',
    username: 'Nom d\'utilisateur',
    password: 'Mot de passe',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    useSSL: 'Utiliser SSL',
    stationName: 'Nom de la Station',
    stationUrl: 'URL de la Station',
    genre: 'Genre'
  },

  // Messages communs
  common: {
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
    warning: 'Avertissement',
    info: 'Information',
    confirm: 'Confirmer',
    cancel: 'Annuler',
    ok: 'OK',
    yes: 'Oui',
    no: 'Non',
    enabled: 'Activé',
    disabled: 'Désactivé',
    on: 'Allumé',
    off: 'Éteint',
    high: 'Élevé',
    medium: 'Moyen',
    low: 'Bas'
  },

  // Erreurs
  errors: {
    audioContextFailed: 'Impossible d\'initialiser le contexte audio',
    microphoneAccessDenied: 'Accès au microphone refusé',
    fileLoadError: 'Erreur de chargement de fichier',
    streamingConnectionFailed: 'Échec de la connexion streaming',
    settingsSaveFailed: 'Échec de la sauvegarde des paramètres',
    databaseError: 'Erreur de base de données',
    unknownError: 'Erreur inconnue'
  }
}
