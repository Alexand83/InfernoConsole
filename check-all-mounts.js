const http = require('http');

console.log('🔍 VERIFICA COMPLETA - Tutti i mountpoint attivi');

const config = {
  host: 'dj.onlinewebone.com',
  port: 8004
};

function checkAllMounts() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: '/status-json.xsl',
      method: 'GET',
      timeout: 10000
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

    req.on('error', (error) => {
      reject(new Error(`HTTP error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function main() {
  try {
    console.log('📡 Richiesta status completo...');
    const status = await checkAllMounts();
    
    console.log('\n📊 STATO COMPLETO SERVER:');
    console.log(`   Server: ${status.icestats?.server_id || 'N/A'}`);
    console.log(`   Admin: ${status.icestats?.admin || 'N/A'}`);
    console.log(`   Location: ${status.icestats?.location || 'N/A'}`);
    
    if (status.icestats?.source) {
      const sources = Array.isArray(status.icestats.source) 
        ? status.icestats.source 
        : [status.icestats.source];
      
      console.log(`\n📻 MOUNTPOINT ATTIVI (${sources.length}):`);
      
      sources.forEach((source, index) => {
        console.log(`\n   🔸 Stream ${index + 1}:`);
        console.log(`      Mount: ${source.listenurl || 'N/A'}`);
        console.log(`      Server Name: ${source.server_name || 'N/A'}`);
        console.log(`      Listeners: ${source.listeners || 0}`);
        console.log(`      Connected: ${source.connected || 0}s`);
        console.log(`      Title: ${source.title || 'N/A'}`);
        console.log(`      Artist: ${source.artist || 'N/A'}`);
        console.log(`      Genre: ${source.genre || 'N/A'}`);
        console.log(`      Bitrate: ${source.bitrate || 'N/A'} kbps`);
        console.log(`      Audio Info: ${source.audio_info || 'N/A'}`);
      });
    } else {
      console.log('\n❌ Nessun source attivo trovato');
    }
    
  } catch (error) {
    console.log(`❌ Errore: ${error.message}`);
  }
}

main();
