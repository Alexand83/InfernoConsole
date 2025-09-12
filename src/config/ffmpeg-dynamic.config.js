// Configurazione FFmpeg dinamica basata sui settings
export const getFFmpegConfig = (format, bitrate, channels, sampleRate) => {
  const baseArgs = [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'webm',
    '-i', 'pipe:0',
    '-fflags', '+flush_packets',
    '-avoid_negative_ts', 'make_zero',
    '-max_muxing_queue_size', '64',
    '-max_delay', '0',
    '-probesize', '32',
    '-analyzeduration', '0',
    '-vn',
    '-map', 'a'
  ]

  // Configurazione specifica per formato
  let formatArgs = []
  let outputFormat = ''
  let contentType = ''

  switch (format) {
    case 'mp3':
      formatArgs = [
        '-c:a', 'libmp3lame',
        '-b:a', `${bitrate}k`,
        '-ar', sampleRate.toString(),
        '-ac', channels.toString(),
        '-q:a', '2' // Qualità VBR
      ]
      outputFormat = 'mp3'
      contentType = 'audio/mpeg'
      break

    case 'aac':
      formatArgs = [
        '-c:a', 'aac',
        '-b:a', `${bitrate}k`,
        '-ar', sampleRate.toString(),
        '-ac', channels.toString(),
        '-profile:a', 'aac_low'
      ]
      outputFormat = 'adts'
      contentType = 'audio/aac'
      break

    case 'opus':
      formatArgs = [
        '-c:a', 'libopus',
        '-b:a', `${bitrate}k`,
        '-ar', '48000', // OPUS richiede 48kHz
        '-ac', channels.toString(),
        '-application', 'lowdelay',
        '-frame_duration', '2.5',
        '-compression_level', '0',
        '-vbr', 'off',
        '-packet_loss', '0',
        '-dtx', 'off'
      ]
      outputFormat = 'ogg'
      contentType = 'audio/ogg'
      break

    case 'ogg':
      formatArgs = [
        '-c:a', 'libvorbis', // Vorbis per OGG puro
        '-b:a', `${bitrate}k`,
        '-ar', sampleRate.toString(),
        '-ac', channels.toString(),
        '-q:a', '3' // Qualità Vorbis
      ]
      outputFormat = 'ogg'
      contentType = 'audio/ogg'
      break

    default:
      // Fallback a OPUS
      formatArgs = [
        '-c:a', 'libopus',
        '-b:a', `${bitrate}k`,
        '-ar', '48000',
        '-ac', channels.toString(),
        '-application', 'lowdelay',
        '-frame_duration', '2.5',
        '-compression_level', '0',
        '-vbr', 'off',
        '-packet_loss', '0',
        '-dtx', 'off'
      ]
      outputFormat = 'ogg'
      contentType = 'audio/ogg'
  }

  // Metadata Icecast
  const metadataArgs = [
    '-content_type', contentType,
    '-ice_name', 'DJ Console',
    '-ice_description', 'Live',
    '-ice_genre', 'Various',
    '-ice_public', '1',
    '-legacy_icecast', '1',
    '-f', outputFormat
  ]

  return [...baseArgs, ...formatArgs, ...metadataArgs]
}

export default getFFmpegConfig
