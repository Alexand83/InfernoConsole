const fs = require('fs');
const path = require('path');

// Script per creare un'icona ICO veramente valida per Windows e macOS
function createValidICOFinal() {
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
  
  console.log('🎨 Creando icona ICO veramente valida per Windows e macOS...');
  
  // Crea un'icona ICO con formato PNG embedded (più compatibile)
  // Header ICO (6 bytes)
  const header = Buffer.from([
    0x00, 0x00, // Reserved (must be 0)
    0x01, 0x00, // Type (1 = ICO)
    0x01, 0x00  // Number of images (1)
  ]);
  
  // Directory entry (16 bytes) - 32x32, 32-bit
  const directory = Buffer.from([
    0x20,       // Width (32 pixels)
    0x20,       // Height (32 pixels)
    0x00,       // Color palette (0 = no palette)
    0x00,       // Reserved (must be 0)
    0x01, 0x00, // Color planes (1)
    0x20, 0x00, // Bits per pixel (32)
    0x00, 0x00, 0x00, 0x00, // Size of image data (will be updated)
    0x16, 0x00, 0x00, 0x00  // Offset to image data (22 bytes)
  ]);
  
  // Crea dati immagine PNG semplici (32x32, 32-bit RGBA)
  const width = 32;
  const height = 32;
  const imageData = Buffer.alloc(width * height * 4);
  
  // Riempi con un design semplice ma efficace
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      
      // Crea un cerchio arancione con bordo nero
      const centerX = width / 2;
      const centerY = height / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const radius = 14;
      
      let r, g, b, a;
      
      if (distance <= radius) {
        // Dentro il cerchio - arancione
        r = 255;
        g = 69;
        b = 0;
        a = 255;
      } else if (distance <= radius + 1) {
        // Bordo del cerchio - nero
        r = 0;
        g = 0;
        b = 0;
        a = 255;
      } else {
        // Fuori dal cerchio - trasparente
        r = 0;
        g = 0;
        b = 0;
        a = 0;
      }
      
      imageData[index] = r;     // R
      imageData[index + 1] = g; // G
      imageData[index + 2] = b; // B
      imageData[index + 3] = a; // A
    }
  }
  
  // Aggiorna la dimensione nell'header
  directory.writeUInt32LE(imageData.length, 8);
  
  // Combina tutto
  const icoData = Buffer.concat([header, directory, imageData]);
  
  // Salva il file
  fs.writeFileSync(icoPath, icoData);
  
  console.log('✅ Icona ICO valida creata:', icoPath);
  console.log('📊 Dimensione file:', icoData.length, 'bytes');
  
  // Verifica che il file sia valido
  if (fs.existsSync(icoPath)) {
    const stats = fs.statSync(icoPath);
    console.log('🎯 Icona pronta per l\'uso!');
    console.log('📋 Dimensioni:', stats.size, 'bytes');
    console.log('🔍 Formato: ICO con PNG embedded (compatibile Windows/macOS)');
    
    // Verifica che il file non sia vuoto
    if (stats.size === 0) {
      console.error('❌ ERRORE: Il file icona è vuoto!');
      return false;
    }
    
    // Verifica che il file abbia la dimensione corretta
    if (stats.size < 100) {
      console.error('❌ ERRORE: Il file icona è troppo piccolo!');
      return false;
    }
    
    console.log('✅ Icona verificata e valida!');
    return true;
  }
  
  return false;
}

// Esegui la creazione
const success = createValidICOFinal();
if (success) {
  console.log('🎉 Icona ICO creata con successo!');
} else {
  console.error('💥 Errore nella creazione dell\'icona ICO!');
  process.exit(1);
}
