const http = require('http');

console.log('🔍 Verifico stato server...');

http.get('http://dj.onlinewebone.com:8004/status-json.xsl', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const status = JSON.parse(data);
      const sources = status.icestats?.source;
      const sourcesArray = Array.isArray(sources) ? sources : (sources ? [sources] : []);
      
      console.log('📡 STATO SERVER ATTUALE:');
      if (sourcesArray.length === 0) {
        console.log('✅ Nessun stream attivo - server libero');
      } else {
        sourcesArray.forEach((source, i) => {
          console.log(`📻 Stream ${i+1}:`);
          console.log(`   Mount: ${source.mount || source.listenurl}`);
          console.log(`   Listeners: ${source.listeners || 0}`);
          console.log(`   Connected: ${source.connected || 0}s`);
          console.log(`   Title: ${source.title || 'N/A'}`);
          console.log(`   Artist: ${source.artist || 'N/A'}`);
          console.log('');
        });
      }
    } catch (e) {
      console.log('❌ Errore parsing JSON:', e.message);
    }
  });
}).on('error', err => {
  console.log('❌ Errore connessione:', err.message);
});












