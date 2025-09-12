const { spawn } = require('child_process');
const http = require('http');

console.log('🎯 TEST ADMIN KICK - Proviamo con credenziali admin per kickare l\'autopilot');

const config = {
  host: 'dj.onlinewebone.com',
  port: 8004,
  username: 'admin',  // Credenziali admin
  password: 'admin_password',  // Password admin (da sostituire)
  mountpoint: '/live'
};

const ffmpegPath = `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe`;

console.log('📡 CONFIGURAZIONE ADMIN:');
console.log(`   Host: ${config.host}`);
console.log(`   Port: ${config.port}`);
console.log(`   Username: ${config.username}`);
console.log(`   Mountpoint: ${config.mountpoint}`);
console.log('⚠️  NOTA: Sostituisci "admin_password" con la password admin reale!');

// Funzione per controllare lo status del server
async function checkServerStatus() {
  try {
    const response = await fetch(`http://${config.host}:${config.port}/status-json.xsl`);
    if (response.ok) {
      const data = await response.json();
      return data.icestats?.source || [];
    }
  } catch (error) {
    console.log(`❌ Errore status: ${error.message}`);
  }
  return [];
}

// Funzione per mostrare lo status attuale
async function showCurrentStatus() {
  console.log('\n📻 STATUS ATTUALE DEL SERVER:');
  const sources = await checkServerStatus();
  
  if (sources.length === 0) {
    console.log('   Nessun stream attivo');
    return;
  }
  
  const sourcesArray = Array.isArray(sources) ? sources : [sources];
  sourcesArray.forEach((source, index) => {
    console.log(`   🔸 Stream ${index + 1}:`);
    console.log(`      URL: ${source.listenurl || 'N/A'}`);
    console.log(`      Server: ${source.server_name || 'N/A'}`);
    console.log(`      Listeners: ${source.listeners || 0}`);
    console.log(`      Title: ${source.title || 'N/A'}`);
    console.log(`      Connected: ${source.connected || 'N/A'}`);
  });
}

// Funzione per avviare lo streaming con credenziali admin
function startAdminStreaming() {
  console.log('\n🚀 AVVIO STREAMING FFMPEG CON CREDENZIALI ADMIN...');
  
  const ffmpegArgs = [
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=999',  // Tono infinito
    '-acodec', 'libmp3lame',
    '-ab', '128k',
    '-ac', '2',
    '-ar', '44100',
    '-f', 'mp3',
    '-ice_name', 'DJ Console Admin',
    '-ice_description', 'Admin test - kick autopilot',
    '-ice_genre', 'various',
    '-ice_public', '1',
    '-legacy_icecast', '1',
    `icecast://${config.username}:${config.password}@${config.host}:${config.port}${config.mountpoint}`
  ];
  
  console.log('📡 Parametri ffmpeg admin:', ffmpegArgs.join(' '));
  
  const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let hasConnected = false;
  let connectionTime = null;
  
  ffmpeg.stderr.on('data', (data) => {
    const text = data.toString();
    
    if (text.includes('Connected') && !hasConnected) {
      hasConnected = true;
      connectionTime = Date.now();
      console.log('✅ ffmpeg si è connesso al server con credenziali admin!');
    } else if (text.includes('time=')) {
      const timeMatch = text.match(/time=([\d:.]+)/);
      if (timeMatch) {
        process.stdout.write(`📡 Streaming: ${timeMatch[1]}\r`);
      }
    } else if (text.includes('error') || text.includes('Error')) {
      console.log(`⚠️  ffmpeg warning/error: ${text.trim()}`);
    }
  });
  
  ffmpeg.on('close', (code) => {
    console.log('\n');
    console.log('📊 RISULTATO STREAMING ADMIN:');
    console.log(`   Exit code: ${code}`);
    console.log(`   Connesso: ${hasConnected ? 'SÌ' : 'NO'}`);
    if (connectionTime) {
      console.log(`   Tempo connessione: ${Date.now() - connectionTime}ms`);
    }
  });
  
  ffmpeg.on('error', (error) => {
    console.log(`❌ Errore ffmpeg: ${error.message}`);
  });
  
  return ffmpeg;
}

// Funzione per monitorare i cambiamenti con focus su kick autopilot
async function monitorAdminChanges(ffmpeg) {
  console.log('\n🔍 MONITORAGGIO CAMBIAMENTI ADMIN...');
  
  let previousSources = [];
  let checkCount = 0;
  let autopilotKicked = false;
  
  const monitorInterval = setInterval(async () => {
    checkCount++;
    const currentSources = await checkServerStatus();
    const currentSourcesArray = Array.isArray(currentSources) ? currentSources : [currentSources];
    
    console.log(`\n📊 CHECK #${checkCount} - ${new Date().toLocaleTimeString()}:`);
    
    if (currentSourcesArray.length === 0) {
      console.log('   Nessun stream attivo');
    } else {
      currentSourcesArray.forEach((source, index) => {
        const isNew = !previousSources.find(s => s.listenurl === source.listenurl);
        const isGone = !currentSourcesArray.find(s => s.listenurl === source.listenurl);
        let status = '🔄 ESISTENTE';
        
        if (isNew) status = '🆕 NUOVO';
        if (isGone) status = '❌ RIMOSSO';
        
        console.log(`   ${status} Stream ${index + 1}:`);
        console.log(`      URL: ${source.listenurl || 'N/A'}`);
        console.log(`      Server: ${source.server_name || 'N/A'}`);
        console.log(`      Listeners: ${source.listeners || 0}`);
        console.log(`      Title: ${source.title || 'N/A'}`);
      });
    }
    
    // Controlla se l'autopilot è stato kickato
    const autopilotStillActive = currentSourcesArray.find(s => 
      s.listenurl === 'http://localhost:8000/;'
    );
    
    if (!autopilotStillActive && previousSources.find(s => s.listenurl === 'http://localhost:8000/;')) {
      console.log('🎉 SUCCESSO! L\'autopilot è stato kickato dalle credenziali admin!');
      autopilotKicked = true;
    }
    
    // Controlla se il nostro stream è visibile e ha listeners
    const ourStreamVisible = currentSourcesArray.find(s => 
      s.listenurl && s.listenurl.includes('/live')
    );
    
    if (ourStreamVisible) {
      const listeners = ourStreamVisible.listeners || 0;
      if (listeners > 1) {
        console.log(`🎯 SUCCESSO! Il nostro stream /live è visibile con ${listeners} listeners!`);
      } else {
        console.log(`⚠️  Il nostro stream /live è visibile ma ha solo ${listeners} listener(s)`);
      }
    }
    
    // Controlla se siamo gli unici stream attivi
    if (currentSourcesArray.length === 1 && ourStreamVisible) {
      console.log('🏆 PERFETTO! Siamo gli unici stream attivi sul server!');
    }
    
    previousSources = currentSourcesArray;
    
    // Ferma il monitoraggio dopo 8 controlli o se l'autopilot è stato kickato
    if (checkCount >= 8 || autopilotKicked) {
      clearInterval(monitorInterval);
      console.log('\n⏰ Monitoraggio completato. Fermando ffmpeg...');
      if (ffmpeg && !ffmpeg.killed) {
        ffmpeg.kill('SIGTERM');
      }
      setTimeout(() => {
        console.log('\n✅ Test admin completato!');
        if (autopilotKicked) {
          console.log('🎉 SUCCESSO: L\'autopilot è stato kickato!');
        } else {
          console.log('⚠️  L\'autopilot non è stato kickato. Prova con password admin diversa.');
        }
        process.exit(0);
      }, 2000);
    }
  }, 4000); // Controlla ogni 4 secondi
}

// Test principale
async function main() {
  console.log('🎯 INIZIO TEST ADMIN KICK AUTOPILOT');
  
  // 1. Mostra status iniziale
  await showCurrentStatus();
  
  // 2. Avvia streaming con credenziali admin
  const ffmpeg = startAdminStreaming();
  
  // 3. Aspetta 6 secondi per la connessione
  setTimeout(async () => {
    console.log('\n⏳ Aspetto 6 secondi per stabilizzare la connessione admin...');
    await showCurrentStatus();
    
    // 4. Inizia monitoraggio
    monitorAdminChanges(ffmpeg);
  }, 6000);
  
  // 5. Termina dopo 40 secondi
  setTimeout(() => {
    if (ffmpeg && !ffmpeg.killed) {
      ffmpeg.kill('SIGTERM');
    }
    console.log('\n⏰ Timeout raggiunto. Test admin terminato.');
    process.exit(0);
  }, 40000);
}

main().catch(console.error);
