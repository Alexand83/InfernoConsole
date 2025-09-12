const { spawn } = require('child_process');
const http = require('http');

console.log('🎯 TEST METADATA - Verifica se i metadata vengono inviati e mostrati');

const config = {
  host: 'dj.onlinewebone.com',
  port: 8004,
  username: 'source',
  password: 'inferno@inferno',
  mountpoint: '/live',
  djName: 'DJ Test Console'
};

const ffmpegPath = `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe`;

let ffmpegProcess = null;
let isStreaming = false;

// Controlla status server
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

// Mostra status con focus sui metadata
function showStatus(status, step) {
  console.log(`\n📊 ${step}:`);
  if (status.icestats?.source) {
    const sources = Array.isArray(status.icestats.source) 
      ? status.icestats.source 
      : [status.icestats.source];
    
    sources.forEach((source, index) => {
      if (source.listenurl && source.listenurl.includes('/live')) {
        console.log(`   🎯 NOSTRO STREAM (/live):`);
        console.log(`      Title: "${source.title || 'N/A'}"`);
        console.log(`      Artist: "${source.artist || 'N/A'}"`);
        console.log(`      Genre: "${source.genre || 'N/A'}"`);
        console.log(`      Listeners: ${source.listeners || 0}`);
        console.log(`      Connected: ${source.connected || 0}s`);
      } else {
        console.log(`   📻 Altro stream: ${source.listenurl || 'N/A'}`);
      }
    });
  }
}

// Avvia streaming con metadata
function startStreaming() {
  if (isStreaming) return;
  
  console.log('🚀 AVVIO STREAMING CON METADATA...');
  
  const ffmpegArgs = [
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=999',
    '-acodec', 'libmp3lame',
    '-ab', '128k',
    '-ac', '2',
    '-ar', '44100',
    
    // METADATA INIZIALI
    '-metadata', `title=${config.djName} - LIVE ON AIR`,
    '-metadata', `artist=${config.djName}`,
    '-metadata', `album=${config.djName} Live Set`,
    '-metadata', 'genre=Electronic/Live DJ',
    
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

// Invia metadata update via HTTP
async function sendMetadataUpdate() {
  return new Promise((resolve) => {
    const postData = `mount=${encodeURIComponent(config.mountpoint)}&mode=updinfo&song=${encodeURIComponent(config.djName + ' - Live DJ Set - UPDATED')}&charset=UTF-8`;
    
    const options = {
      hostname: config.host,
      port: config.port,
      path: '/admin/metadata',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Basic ' + Buffer.from(`source:${config.password}`).toString('base64'),
        'User-Agent': 'DJ Console Test'
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Metadata HTTP update SUCCESS!');
        } else {
          console.log(`⚠️ Metadata HTTP response: ${res.statusCode}`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`⚠️ Metadata HTTP error: ${error.message}`);
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

// Test principale
async function main() {
  console.log('🧪 TEST METADATA: Verifica se vengono inviati e mostrati');
  
  // Step 1: Status iniziale
  console.log('\n📡 Step 1: Status iniziale');
  try {
    const initialStatus = await checkServerStatus();
    showStatus(initialStatus, 'STATO INIZIALE');
  } catch (error) {
    console.log(`❌ Errore status iniziale: ${error.message}`);
  }
  
  // Step 2: Avvia streaming
  console.log('\n📡 Step 2: Avvio streaming con metadata...');
  startStreaming();
  
  // Step 3: Controlla metadata iniziali
  setTimeout(async () => {
    console.log('\n📡 Step 3: Controllo metadata iniziali...');
    try {
      const streamingStatus = await checkServerStatus();
      showStatus(streamingStatus, 'METADATA INIZIALI');
    } catch (error) {
      console.log(`❌ Errore status streaming: ${error.message}`);
    }
  }, 8000);
  
  // Step 4: Invia metadata update
  setTimeout(async () => {
    console.log('\n📡 Step 4: Invio metadata update HTTP...');
    await sendMetadataUpdate();
    
    setTimeout(async () => {
      console.log('\n📡 Step 5: Controllo metadata aggiornati...');
      try {
        const updatedStatus = await checkServerStatus();
        showStatus(updatedStatus, 'METADATA AGGIORNATI');
      } catch (error) {
        console.log(`❌ Errore status aggiornato: ${error.message}`);
      }
    }, 3000);
  }, 15000);
  
  // Step 5: Ferma e controlla
  setTimeout(() => {
    console.log('\n📡 Step 6: Fermatura streaming...');
    if (ffmpegProcess) {
      ffmpegProcess.kill('SIGTERM');
    }
    
    setTimeout(async () => {
      console.log('\n📡 Step 7: Status finale');
      try {
        const finalStatus = await checkServerStatus();
        showStatus(finalStatus, 'STATO FINALE');
        console.log('\n✅ Test metadata completato!');
        process.exit(0);
      } catch (error) {
        console.log(`❌ Errore status finale: ${error.message}`);
        process.exit(1);
      }
    }, 3000);
  }, 25000);
}

main().catch(console.error);
