// Configurazione FFmpeg per streaming OPUS su Icecast
export const ffmpegOpusConfig = {
  // Input settings
  input: {
    format: 'webm',
    codec: 'opus',
    sampleRate: 48000,  // ✅ FIX: Opus supporta 48000Hz, non 44100Hz
    channels: 2
  },
  
  // Output settings per OPUS
  output: {
    format: 'ogg', // OPUS va in container OGG
    codec: 'libopus',
    bitrate: '128k',
    sampleRate: 48000,  // ✅ FIX: Opus supporta 48000Hz, non 44100Hz
    channels: 2,
    application: 'audio',  // ✅ FIX: 'audio' per stabilità streaming musicale
    frameDuration: 60,     // ✅ FIX: 60ms per stabilità
    compressionLevel: 5    // ✅ FIX: Compressione bilanciata
  },
  
  // Icecast metadata
  icecast: {
    name: 'DJ Console Pro - Live',
    description: 'Live DJ Set from DJ Console Pro',
    genre: 'Electronic/Live DJ',
    url: 'https://dj.onlinewebone.com',
    public: '1',
    bitrate: '128'
  },
  
  // FFmpeg arguments per OPUS
  getArgs: (host, port, mount, username, password) => [
    '-hide_banner',
    '-loglevel', 'info',
    '-f', 'webm',
    '-i', 'pipe:0',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-ar', '48000',  // ✅ FIX: Opus supporta 48000Hz, non 44100Hz
    '-ac', '2',
    '-application', 'audio',  // ✅ FIX: 'audio' per stabilità streaming musicale
    '-frame_duration', '60',  // ✅ FIX: 60ms per stabilità
    '-packet_loss', '0',      // ✅ FIX: Disabilita gestione perdita pacchetti
    '-compression_level', '5', // ✅ FIX: Compressione bilanciata
    '-content_type', 'audio/ogg',
    '-ice_name', 'DJ Console Pro - Live',
    '-ice_description', 'Live DJ Set from DJ Console Pro',
    '-ice_genre', 'Electronic/Live DJ',
    '-ice_url', 'https://dj.onlinewebone.com',
    '-ice_public', '1',
    '-f', 'ogg',
    `icecast://${username}:${password}@${host}:${port}${mount}`
  ]
};

export default ffmpegOpusConfig;
