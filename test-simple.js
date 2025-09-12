const { spawn } = require('child_process');

console.log('🎯 TEST ULTRA-SEMPLICE - Solo connessione e tono');

const config = {
  host: 'dj.onlinewebone.com',
  port: 8004,
  username: 'source',
  password: 'inferno@inferno',
  mountpoint: '/live'
};

const ffmpegPath = `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe`;

let ffmpegProcess = null;
let isStreaming = false;

function startStreaming() {
  if (isStreaming) {
    console.log('⚠️ Già in streaming!');
    return;
  }

  console.log('🚀 AVVIO STREAMING...');
  
  const ffmpegArgs = [
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=999',  // Tono infinito
    '-acodec', 'libmp3lame',
    '-ab', '128k',
    '-ac', '2',
    '-ar', '44100',
    '-f', 'mp3',
    `icecast://${config.username}:${config.password}@${config.host}:${config.port}${config.mountpoint}`
  ];

  ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  ffmpegProcess.stderr.on('data', (data) => {
    const text = data.toString();
    
    if (text.includes('Opening')) {
      console.log('📡 Connessione in corso...');
    } else if (text.includes('Stream mapping')) {
      console.log('✅ STREAMING ATTIVO! Tono 440Hz in diretta!');
      isStreaming = true;
    } else if (text.includes('time=')) {
      const timeMatch = text.match(/time=([\d:.]+)/);
      if (timeMatch) {
        process.stdout.write(`📡 LIVE: ${timeMatch[1]}\r`);
      }
    }
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`\n🛑 Streaming terminato (code: ${code})`);
    isStreaming = false;
    ffmpegProcess = null;
  });

  ffmpegProcess.on('error', (error) => {
    console.log(`❌ Errore: ${error.message}`);
    isStreaming = false;
  });
}

function stopStreaming() {
  if (!isStreaming || !ffmpegProcess) {
    console.log('⚠️ Nessuno streaming attivo!');
    return;
  }

  console.log('🛑 FERMATURA STREAMING...');
  ffmpegProcess.kill('SIGTERM');
  isStreaming = false;
  ffmpegProcess = null;
}

function showStatus() {
  console.log(`\n📊 STATO ATTUALE:`);
  console.log(`   Streaming: ${isStreaming ? '✅ ATTIVO' : '❌ FERMO'}`);
  console.log(`   Processo: ${ffmpegProcess ? '🔄 ATTIVO' : '⏹️ INATTIVO'}`);
}

// Simuliamo i controlli
console.log('🎮 CONTROLLI DISPONIBILI:');
console.log('   startStreaming()  - Avvia streaming');
console.log('   stopStreaming()   - Ferma streaming');
console.log('   showStatus()      - Mostra stato');

// Test automatico
setTimeout(() => {
  console.log('\n🧪 TEST AUTOMATICO:');
  startStreaming();
  
  setTimeout(() => {
    console.log('\n⏰ Test completato, fermando...');
    stopStreaming();
    
    setTimeout(() => {
      showStatus();
      process.exit(0);
    }, 2000);
  }, 10000); // 10 secondi di streaming
}, 1000);
