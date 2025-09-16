#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Percorso del package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');

try {
  // Legge il package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Aggiorna la data di build con la data/ora corrente
  const now = new Date();
  packageJson.buildDate = now.toISOString();
  
  // Scrive il package.json aggiornato
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  console.log(`✅ Build date updated to: ${packageJson.buildDate}`);
} catch (error) {
  console.error('❌ Error updating build date:', error);
  process.exit(1);
}
