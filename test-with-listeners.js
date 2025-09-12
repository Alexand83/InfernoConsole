const { spawn } = require('child_process');
const http = require('http');

console.log('🎯 TEST CON LISTENERS - Verifica se il mountpoint appare quando attivo');

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

// Funzione per controllare lo status del server
async function checkServerStatus() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: '/status-json.xsl',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const status = JSON.parse(data);
          resolve(status);
        } catch (error) {
          reject(new Error(`JSON parse error: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Funzione per mostrare lo status
function showStatus(status) {
  console.log('\n📊 STATO SERVER:');
  if (status.icestats?.source) {
    const sources = Array.isArray(status.icestats.source) 
      ? status.icestats.source 
      : [status.icestats.source];
    
    console.log(`📻 Mountpoint attivi: ${sources.length}`);
    sources.forEach((source, index) => {
      console.log(`   🔸 ${source.listenurl || 'N/A'} - ${source.listeners || 0} listeners`);
    });
  } else {
    console.log('❌ Nessun mountpoint attivo');
  }
}

// Funzione per avviare streaming
function startStreaming() {
  if (isStreaming) return;
  
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
      console.log('✅ STREAMING ATTIVO!');
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
}

// Funzione per fermare streaming
function stopStreaming() {
  if (!isStreaming || !ffmpegProcess) return;
  
  console.log('\n🛑 FERMATURA STREAMING...');
  ffmpegProcess.kill('SIGTERM');
  isStreaming = false;
}

// Test principale
async function main() {
  console.log('🧪 TEST: Verifica se il mountpoint appare quando attivo');
  
  // Step 1: Status iniziale
  console.log('\n📡 Step 1: Status iniziale (nessuno streaming)');
  try {
    const initialStatus = await checkServerStatus();
    showStatus(initialStatus);
  } catch (error) {
    console.log(`❌ Errore status iniziale: ${error.message}`);
  }
  
  // Step 2: Avvia streaming
  console.log('\n📡 Step 2: Avvio streaming...');
  startStreaming();
  
  // Step 3: Aspetta e controlla
  setTimeout(async () => {
    console.log('\n📡 Step 3: Controllo status durante streaming...');
    try {
      const streamingStatus = await checkServerStatus();
      showStatus(streamingStatus);
    } catch (error) {
      console.log(`❌ Errore status streaming: ${error.message}`);
    }
  }, 5000);
  
  // Step 4: Ferma e controlla
  setTimeout(async () => {
    console.log('\n📡 Step 4: Fermatura streaming...');
    stopStreaming();
    
    setTimeout(async () => {
      console.log('\n📡 Step 5: Status finale (dopo fermatura)');
      try {
        const finalStatus = await checkServerStatus();
        showStatus(finalStatus);
        console.log('\n✅ Test completato!');
        process.exit(0);
      } catch (error) {
        console.log(`❌ Errore status finale: ${error.message}`);
        process.exit(1);
      }
    }, 3000);
  }, 15000);
}

main().catch(console.error);
