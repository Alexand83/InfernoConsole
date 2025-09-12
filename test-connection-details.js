const { spawn } = require('child_process');
const http = require('http');

console.log('🎯 TEST CONNESSIONE DETTAGLIATA - Dove va esattamente ffmpeg?');

const config = {
  host: 'dj.onlinewebone.com',
  port: 8004,
  username: 'source',
  password: 'inferno@inferno',
  mountpoint: '/live'
};

const ffmpegPath = `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe`;

console.log('📡 CONFIGURAZIONE CONNESSIONE:');
console.log(`   Host: ${config.host}`);
console.log(`   Port: ${config.port}`);
console.log(`   Username: ${config.username}`);
console.log(`   Mountpoint: ${config.mountpoint}`);
console.log(`   URL completo: icecast://${config.username}:***@${config.host}:${config.port}${config.mountpoint}`);

// Test 1: Verifica se il server risponde
async function testServerResponse() {
  console.log('\n🧪 TEST 1: Il server risponde?');
  
  try {
    const response = await fetch(`http://${config.host}:${config.port}/status-json.xsl`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server risponde correttamente');
      console.log(`   Server ID: ${data.icestats?.server_id || 'N/A'}`);
      console.log(`   Admin: ${data.icestats?.admin || 'N/A'}`);
      console.log(`   Location: ${data.icestats?.location || 'N/A'}`);
    } else {
      console.log(`❌ Server risponde con errore: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Server non raggiungibile: ${error.message}`);
  }
}

// Test 2: Verifica DNS resolution
async function testDNSResolution() {
  console.log('\n🧪 TEST 2: Risoluzione DNS');
  
  try {
    const dns = require('dns');
    const { promisify } = require('util');
    const resolve4 = promisify(dns.resolve4);
    
    const addresses = await resolve4(config.host);
    console.log('✅ DNS risolto correttamente:');
    addresses.forEach((addr, index) => {
      console.log(`   IP ${index + 1}: ${addr}`);
    });
  } catch (error) {
    console.log(`❌ Errore DNS: ${error.message}`);
  }
}

// Test 3: Connessione ffmpeg con log dettagliato
function testFfmpegConnection() {
  console.log('\n🧪 TEST 3: Connessione ffmpeg dettagliata');
  
  const ffmpegArgs = [
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=15',
    '-acodec', 'libmp3lame',
    '-ab', '128k',
    '-ac', '2',
    '-ar', '44100',
    '-f', 'mp3',
    '-v', 'debug',  // Log dettagliato
    `icecast://${config.username}:${config.password}@${config.host}:${config.port}${config.mountpoint}`
  ];

  console.log('🚀 Avvio ffmpeg con log dettagliato...');
  
  const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let connectionDetails = '';
  let hasConnected = false;

  ffmpeg.stderr.on('data', (data) => {
    const text = data.toString();
    connectionDetails += text;
    
    // Log dettagliato della connessione
    if (text.includes('Opening')) {
      console.log('📡 ffmpeg sta aprendo la connessione...');
    } else if (text.includes('Connecting')) {
      console.log('🔗 ffmpeg si sta connettendo...');
    } else if (text.includes('Connected')) {
      console.log('✅ ffmpeg si è connesso!');
      hasConnected = true;
    } else if (text.includes('Stream mapping')) {
      console.log('🎵 Stream mapping attivo!');
    } else if (text.includes('time=')) {
      const timeMatch = text.match(/time=([\d:.]+)/);
      if (timeMatch) {
        process.stdout.write(`📡 Streaming: ${timeMatch[1]}\r`);
      }
    }
  });

  ffmpeg.on('close', (code) => {
    console.log('\n');
    console.log('📊 RISULTATO CONNESSIONE:');
    
    if (hasConnected) {
      console.log('✅ SUCCESS! ffmpeg si è connesso correttamente');
      console.log(`   Exit code: ${code}`);
    } else {
      console.log('❌ FAIL! ffmpeg non si è connesso');
      console.log(`   Exit code: ${code}`);
    }
    
    console.log('\n📋 LOG DETTAGLIATO CONNESSIONE:');
    console.log(connectionDetails);
  });

  ffmpeg.on('error', (error) => {
    console.log(`❌ Errore ffmpeg: ${error.message}`);
  });

  setTimeout(() => {
    if (!ffmpeg.killed) {
      ffmpeg.kill('SIGTERM');
    }
  }, 20000);
}

// Test 4: Verifica status durante connessione
async function checkStatusDuringConnection() {
  console.log('\n🧪 TEST 4: Status server durante connessione');
  
  // Aspetta un po' per permettere la connessione
  setTimeout(async () => {
    try {
      const response = await fetch(`http://${config.host}:${config.port}/status-json.xsl`);
      if (response.ok) {
        const data = await response.json();
        
        if (data.icestats?.source) {
          const sources = Array.isArray(data.icestats.source) 
            ? data.icestats.source 
            : [data.icestats.source];
          
          console.log(`📻 Mountpoint attivi: ${sources.length}`);
          sources.forEach((source, index) => {
            console.log(`   🔸 Stream ${index + 1}:`);
            console.log(`      URL: ${source.listenurl || 'N/A'}`);
            console.log(`      Server: ${source.server_name || 'N/A'}`);
            console.log(`      Listeners: ${source.listeners || 0}`);
            console.log(`      Title: ${source.title || 'N/A'}`);
          });
        }
      }
    } catch (error) {
      console.log(`❌ Errore status: ${error.message}`);
    }
  }, 8000);
}

// Test principale
async function main() {
  console.log('🎯 INIZIO TEST CONNESSIONE DETTAGLIATA');
  
  // Test 1: Server response
  await testServerResponse();
  
  // Test 2: DNS resolution
  await testDNSResolution();
  
  // Test 3: Connessione ffmpeg
  testFfmpegConnection();
  
  // Test 4: Status durante connessione
  checkStatusDuringConnection();
  
  // Termina dopo un po'
  setTimeout(() => {
    console.log('\n✅ Test completato!');
    process.exit(0);
  }, 25000);
}

main().catch(console.error);
