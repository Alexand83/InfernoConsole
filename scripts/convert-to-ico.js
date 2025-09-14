const fs = require('fs');
const path = require('path');
const https = require('https');

// Script per convertire SVG in ICO usando un servizio online
async function convertSVGToICO() {
  const svgPath = path.join(__dirname, '..', 'build', 'icon.svg');
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
  
  if (!fs.existsSync(svgPath)) {
    console.error('❌ File SVG non trovato:', svgPath);
    return;
  }
  
  console.log('🎨 Icona SVG trovata:', svgPath);
  console.log('📝 Per convertire automaticamente:');
  console.log('');
  console.log('🔗 Opzioni online:');
  console.log('   1. https://convertio.co/svg-ico/');
  console.log('   2. https://favicon.io/favicon-converter/');
  console.log('   3. https://www.icoconverter.com/');
  console.log('');
  console.log('💻 Opzioni locali:');
  console.log('   - ImageMagick: magick icon.svg icon.ico');
  console.log('   - GIMP: Apri SVG e esporta come ICO');
  console.log('   - Inkscape: inkscape --export-type=ico icon.svg');
  console.log('');
  console.log('📋 Dimensioni consigliate:');
  console.log('   - 16x16, 32x32, 48x48, 64x64, 128x128, 256x256');
  console.log('');
  console.log('🎯 Dopo la conversione, salva il file come:');
  console.log('   ', icoPath);
}

// Esegui la conversione
convertSVGToICO().catch(console.error);
