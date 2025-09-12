const { spawn } = require('child_process');
const http = require('http');

console.log('🎯 TEST EMULANDO RADIOBOSS - Parametri avanzati');

// Prima: tenta di kickare la playlist automatica
async function kickAutopilot(config) {
  return new Promise((resolve) => {
    console.log('🚀 Tentativo kick autopilot...');
    
    const kickUrl = `http://${config.host}:${config.port}/admin/killsource.xsl?mount=${config.mountpoint}`;
    const options = {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`admin:${config.password}`).toString('base64'),
        'User-Agent': 'RadioBoss'
      },
      timeout: 5000
    };
    
    const req = http.request(kickUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Autopilot kicked successfully');
        } else {
          console.log(`⚠️ Kick response: ${res.statusCode}`);
        }
        resolve();
      });
    });
    
    req.on('error', () => {
      console.log('⚠️ Kick failed, continuing anyway...');
      resolve();
    });
    
    req.on('timeout', () => {
      console.log('⚠️ Kick timeout, continuing anyway...');
      req.destroy();
      resolve();
    });
    
    req.end();
  });
}

async function testRadioBossStyle() {
  const config = {
    host: 'dj.onlinewebone.com',
    port: 8004,
    username: 'source',
    password: 'inferno@inferno',
    mountpoint: '/live',
    djName: 'DJ Test Console'
  };

  // Step 1: Kick autopilot
  await kickAutopilot(config);
  
  // Step 2: Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 3: Connect with RadioBoss-style parameters
  const ffmpegPath = `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe`;
  
  const ffmpegArgs = [
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=30',
    '-acodec', 'libmp3lame',
    '-ab', '128k',
    '-ac', '2',
    '-ar', '44100',
    
    // PARAMETRI ICECAST AVANZATI (come RadioBoss)
    '-ice_genre', 'Electronic/Live DJ',
    '-ice_name', `${config.djName} Live Stream`,
    '-ice_description', `Live DJ Set by ${config.djName}`,
    '-ice_url', 'https://onlinewebone.eu',
    '-ice_public', '1',
    
    // METADATA INIZIALI
    '-metadata', `title=${config.djName} - Test Stream`,
    '-metadata', `artist=${config.djName}`,
    '-metadata', `album=${config.djName} Live`,
    '-metadata', 'genre=Electronic/Live DJ',
    
    // FORMATO E OUTPUT
    '-f', 'mp3',
    '-content_type', 'audio/mpeg',
    
    // USER AGENT (importante!)
    '-user_agent', 'RadioBoss/DJ Console',
    
    `icecast://${config.username}:${config.password}@${config.host}:${config.port}${config.mountpoint}`
  ];

  console.log('🎵 Avvio streaming con parametri RadioBoss-style...');
  
  const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let hasStarted = false;
  let streamingTime = 0;

  ffmpeg.stderr.on('data', (data) => {
    const text = data.toString();
    
    if (text.includes('Opening')) {
      console.log('📡 Apertura connessione Icecast...');
    } else if (text.includes('Stream mapping')) {
      console.log('✅ Connessione riuscita - streaming LIVE iniziato!');
      hasStarted = true;
    } else if (text.includes('ice_name')) {
      console.log('📡 Metadata Icecast inviati');
    } else if (text.includes('time=')) {
      const timeMatch = text.match(/time=([\d:.]+)/);
      if (timeMatch) {
        streamingTime = timeMatch[1];
        process.stdout.write(`📡 Live Streaming: ${streamingTime}\r`);
      }
    }
  });

  // Invia metadata update dopo 5 secondi (come RadioBoss)
  setTimeout(async () => {
    console.log('\n📡 Invio metadata update HTTP...');
    await sendMetadataUpdate(config);
  }, 5000);

  ffmpeg.on('close', (code) => {
    console.log('\n');
    if (code === 0 && hasStarted) {
      console.log('✅ Test RadioBoss-style completato con successo!');
      console.log(`📊 Tempo streaming: ${streamingTime}`);
    } else {
      console.log(`❌ Test fallito (exit code: ${code})`);
    }
  });

  ffmpeg.on('error', (error) => {
    console.log(`❌ Errore ffmpeg: ${error.message}`);
  });

  setTimeout(() => {
    if (!ffmpeg.killed) {
      console.log('\n⏰ Terminando test...');
      ffmpeg.kill('SIGTERM');
    }
  }, 35000);
}

// Metadata update HTTP (stile RadioBoss)
async function sendMetadataUpdate(config) {
  return new Promise((resolve) => {
    const postData = `mount=${encodeURIComponent(config.mountpoint)}&mode=updinfo&song=${encodeURIComponent(config.djName + ' - Live DJ Set')}&charset=UTF-8`;
    
    const options = {
      hostname: config.host,
      port: config.port,
      path: '/admin/metadata',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Basic ' + Buffer.from(`source:${config.password}`).toString('base64'),
        'User-Agent': 'RadioBoss/DJ Console'
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

testRadioBossStyle().catch(console.error);












