const { spawn } = require('child_process');

console.log('🎯 TEST CON CREDENZIALI ADMIN - Come RadioBoss');

const config = {
  host: 'dj.onlinewebone.com',
  port: 8004,
  username: 'admin',  // ← CAMBIATO DA 'source' A 'admin'
  password: 'inferno@inferno',
  mountpoint: '/live',
  djName: 'DJ Test Console ADMIN'
};

const ffmpegPath = `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe`;

const ffmpegArgs = [
  '-f', 'lavfi',
  '-i', 'sine=frequency=440:duration=30',
  '-acodec', 'libmp3lame',
  '-ab', '128k',
  '-ac', '2',
  '-ar', '44100',
  
  // PARAMETRI ICECAST CON CREDENZIALI ADMIN
  '-ice_genre', 'Electronic/Live DJ',
  '-ice_name', `${config.djName} Live Stream`,
  '-ice_description', `Live DJ Set by ${config.djName}`,
  '-ice_url', 'https://onlinewebone.eu',
  '-ice_public', '1',
  
  '-metadata', `title=${config.djName} - LIVE ON AIR`,
  '-metadata', `artist=${config.djName}`,
  '-metadata', `album=${config.djName} Live`,
  '-metadata', 'genre=Electronic/Live DJ',
  
  '-f', 'mp3',
  '-content_type', 'audio/mpeg',
  '-user_agent', 'RadioBoss/DJ Console',
  
  `icecast://${config.username}:${config.password}@${config.host}:${config.port}${config.mountpoint}`
];

console.log('🎵 Tentativo connessione ADMIN...');
console.log('📡 Username: admin (invece di source)');

const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
  stdio: ['pipe', 'pipe', 'pipe']
});

let hasStarted = false;
let errorDetails = '';

ffmpeg.stderr.on('data', (data) => {
  const text = data.toString();
  errorDetails += text;
  
  if (text.includes('Opening')) {
    console.log('📡 Apertura connessione con credenziali ADMIN...');
  } else if (text.includes('Stream mapping')) {
    console.log('✅ SUCCESS! Connessione ADMIN riuscita!');
    hasStarted = true;
  } else if (text.includes('401') || text.includes('403')) {
    console.log('❌ ADMIN credentials rejected');
  } else if (text.includes('time=')) {
    const timeMatch = text.match(/time=([\d:.]+)/);
    if (timeMatch) {
      process.stdout.write(`📡 ADMIN Streaming: ${timeMatch[1]}\r`);
    }
  }
});

ffmpeg.on('close', (code) => {
  console.log('\n');
  if (code === 0 && hasStarted) {
    console.log('🎉 SUCCESS! ADMIN streaming funziona!');
    console.log('🔑 RadioBoss usa probabilmente credenziali ADMIN');
  } else if (code !== 0) {
    console.log(`❌ ADMIN test fallito (exit code: ${code})`);
    console.log('📋 Ultimi errori:');
    console.log(errorDetails.split('\n').slice(-3).join('\n'));
  } else {
    console.log('⚠️ Test completato ma senza streaming detectato');
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












