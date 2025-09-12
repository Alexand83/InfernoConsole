const { spawn } = require('child_process');

console.log('🎯 TEST MOUNTPOINT - Verifica se /live esiste e funziona');

const config = {
  host: 'dj.onlinewebone.com',
  port: 8004,
  username: 'source',
  password: 'inferno@inferno',
  mountpoint: '/live'
};

const ffmpegPath = `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe`;

console.log('🧪 TEST 1: Tentativo connessione a /live...');
console.log(`📡 URL: icecast://${config.username}:***@${config.host}:${config.port}${config.mountpoint}`);

const ffmpegArgs = [
  '-f', 'lavfi',
  '-i', 'sine=frequency=440:duration=10',  // Solo 10 secondi
  '-acodec', 'libmp3lame',
  '-ab', '128k',
  '-ac', '2',
  '-ar', '44100',
  '-f', 'mp3',
  `icecast://${config.username}:${config.password}@${config.host}:${config.port}${config.mountpoint}`
];

const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
  stdio: ['pipe', 'pipe', 'pipe']
});

let connectionStatus = 'connecting';
let errorDetails = '';

ffmpeg.stderr.on('data', (data) => {
  const text = data.toString();
  errorDetails += text;
  
  if (text.includes('Opening')) {
    console.log('📡 Apertura connessione...');
  } else if (text.includes('Stream mapping')) {
    console.log('✅ Connessione riuscita!');
    connectionStatus = 'connected';
  } else if (text.includes('401') || text.includes('403')) {
    console.log('❌ Credenziali rifiutate');
    connectionStatus = 'auth_failed';
  } else if (text.includes('404') || text.includes('Not Found')) {
    console.log('❌ Mountpoint non trovato');
    connectionStatus = 'not_found';
  } else if (text.includes('Connection refused')) {
    console.log('❌ Connessione rifiutata');
    connectionStatus = 'refused';
  } else if (text.includes('time=')) {
    const timeMatch = text.match(/time=([\d:.]+)/);
    if (timeMatch) {
      process.stdout.write(`📡 Streaming: ${timeMatch[1]}\r`);
    }
  }
});

ffmpeg.on('close', (code) => {
  console.log('\n');
  console.log('📊 RISULTATO TEST:');
  
  switch (connectionStatus) {
    case 'connected':
      console.log('✅ SUCCESS! Il mountpoint /live FUNZIONA!');
      console.log('🔑 Le credenziali source sono valide');
      break;
    case 'auth_failed':
      console.log('❌ FAIL! Credenziali source non valide');
      break;
    case 'not_found':
      console.log('❌ FAIL! Il mountpoint /live non esiste');
      console.log('💡 Potrebbe servire credenziali admin per crearlo');
      break;
    case 'refused':
      console.log('❌ FAIL! Connessione rifiutata dal server');
      break;
    default:
      console.log(`⚠️ Stato sconosciuto: ${connectionStatus}`);
  }
  
  if (code !== 0) {
    console.log(`📋 Exit code: ${code}`);
    console.log('📋 Ultimi errori:');
    console.log(errorDetails.split('\n').slice(-3).join('\n'));
  }
});

ffmpeg.on('error', (error) => {
  console.log(`❌ Errore ffmpeg: ${error.message}`);
});

setTimeout(() => {
  if (!ffmpeg.killed) {
    ffmpeg.kill('SIGTERM');
  }
}, 15000);
