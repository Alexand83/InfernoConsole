const { spawn } = require('child_process');

console.log('🎯 TEST RAPIDO - Tentativo connessione di 30 secondi (come il primo test)');

const ffmpegPath = `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe`;
const ffmpegUrl = 'icecast://source:inferno@inferno@dj.onlinewebone.com:8004/live';

const ffmpegArgs = [
  '-f', 'lavfi',
  '-i', 'sine=frequency=440:duration=30',
  '-acodec', 'libmp3lame',
  '-ab', '128k',
  '-ac', '2',
  '-ar', '44100',
  '-metadata', 'title=TEST RAPIDO',
  '-metadata', 'artist=DJ Test',
  '-f', 'mp3',
  '-content_type', 'audio/mpeg',
  ffmpegUrl
];

console.log('⏳ Tentativo connessione...');

const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
  stdio: ['pipe', 'pipe', 'pipe']
});

let hasStarted = false;

ffmpeg.stderr.on('data', (data) => {
  const text = data.toString();
  
  if (text.includes('Opening')) {
    console.log('📡 Apertura connessione...');
  } else if (text.includes('Stream mapping')) {
    console.log('✅ Connessione riuscita - streaming iniziato!');
    hasStarted = true;
  } else if (text.includes('Connection refused') || text.includes('403') || text.includes('401')) {
    console.log('❌ CONNESSIONE RIFIUTATA - Server occupato o credenziali errate');
  } else if (text.includes('time=')) {
    process.stdout.write('📡 Streaming: ' + text.match(/time=[\d:.]+/)?.[0] + '\r');
  }
});

ffmpeg.on('close', (code) => {
  console.log('\n');
  if (code === 0 && hasStarted) {
    console.log('✅ Test completato - streaming funzionante');
  } else if (code === 0 && !hasStarted) {
    console.log('⚠️ Completato senza streaming - probabilmente server occupato');
  } else {
    console.log(`❌ Test fallito (exit code: ${code})`);
  }
});

ffmpeg.on('error', (error) => {
  console.log(`❌ Errore ffmpeg: ${error.message}`);
});

setTimeout(() => {
  if (!ffmpeg.killed) {
    ffmpeg.kill('SIGTERM');
  }
}, 35000);
