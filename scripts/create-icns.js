const fs = require('fs');
const path = require('path');

// Script per creare un'icona ICNS per macOS
function createICNS() {
  const svgPath = path.join(__dirname, '..', 'build', 'icon.svg');
  const icnsPath = path.join(__dirname, '..', 'build', 'icon.icns');
  
  if (!fs.existsSync(svgPath)) {
    console.error('❌ File SVG non trovato:', svgPath);
    return;
  }
  
  console.log('🎨 Icona SVG trovata:', svgPath);
  console.log('📝 Per macOS, l\'icona ICNS è opzionale.');
  console.log('   Electron userà l\'icona ICO convertita automaticamente.');
  console.log('   Se vuoi un\'icona ICNS specifica, usa:');
  console.log('   - https://cloudconvert.com/svg-to-icns');
  console.log('   - https://convertio.co/svg-icns/');
  console.log('');
  console.log('✅ Per ora, l\'icona ICO funzionerà anche su macOS!');
}

createICNS();
