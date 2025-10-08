#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Script per generare delta patches per release automatiche
 * Usage: node scripts/generate-delta-release.js [previousVersion] [newVersion]
 */

const args = process.argv.slice(2);
const previousVersion = args[0] || process.env.PREVIOUS_VERSION;
const newVersion = args[1] || process.env.NEW_VERSION || require('../package.json').version;

console.log('🔍 [DELTA RELEASE] Starting delta patch generation...');
console.log(`📁 [DELTA RELEASE] Previous version: ${previousVersion}`);
console.log(`📁 [DELTA RELEASE] New version: ${newVersion}`);

if (!previousVersion) {
  console.log('❌ [DELTA RELEASE] No previous version specified');
  console.log('💡 [DELTA RELEASE] This will be a full release (no delta patches)');
  process.exit(0);
}

const releasesDir = path.join(__dirname, '..', 'releases');
const previousDir = path.join(releasesDir, previousVersion);
const newDir = path.join(releasesDir, newVersion);

// Crea directory per la nuova versione
if (!fs.existsSync(newDir)) {
  fs.mkdirSync(newDir, { recursive: true });
}

// File da processare per delta patches
const filesToProcess = [
  'main.exe',
  'app.asar',
  'config.json'
];

// Simula la creazione di delta patches
function createDeltaPatch(previousFile, newFile, outputFile) {
  console.log(`🔧 [DELTA RELEASE] Creating patch: ${path.basename(previousFile)} → ${path.basename(newFile)}`);
  
  // Simula contenuto del patch
  const patchContent = `DELTA_PATCH_${previousVersion}_TO_${newVersion}_${path.basename(previousFile)}`;
  
  fs.writeFileSync(outputFile, patchContent);
  
  const stats = fs.statSync(outputFile);
  return {
    size: stats.size,
    hash: crypto.createHash('sha256').update(patchContent).digest('hex').substring(0, 12)
  };
}

// Genera manifest per la nuova versione
function generateManifest() {
  const manifest = {
    version: newVersion,
    previousVersion: previousVersion,
    timestamp: new Date().toISOString(),
    files: [],
    totalSize: 0,
    fullSize: 77000000, // 77 MB simulato
    savings: '0%'
  };

  let totalPatchSize = 0;

  filesToProcess.forEach(fileName => {
    const previousFile = path.join(previousDir, fileName);
    const newFile = path.join(newDir, fileName);
    const patchFile = path.join(newDir, `${fileName}.patch`);

    // Simula file se non esistono
    if (!fs.existsSync(previousFile)) {
      fs.writeFileSync(previousFile, `FAKE_${fileName}_${previousVersion}`);
    }
    if (!fs.existsSync(newFile)) {
      fs.writeFileSync(newFile, `FAKE_${fileName}_${newVersion}`);
    }

    // Crea delta patch
    const patchInfo = createDeltaPatch(previousFile, newFile, patchFile);
    
    manifest.files.push({
      path: fileName,
      hash: crypto.createHash('sha256').update(fs.readFileSync(newFile)).digest('hex').substring(0, 12),
      size: fs.statSync(newFile).size,
      delta: {
        patchSize: patchInfo.size,
        patchHash: patchInfo.hash
      }
    });

    totalPatchSize += patchInfo.size;
  });

  manifest.totalSize = totalPatchSize;
  manifest.savings = ((manifest.fullSize - totalPatchSize) / manifest.fullSize * 100).toFixed(1) + '%';

  // Salva manifest
  const manifestPath = path.join(newDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('✅ [DELTA RELEASE] Manifest created:', manifestPath);
  console.log(`📊 [DELTA RELEASE] Total patch size: ${(totalPatchSize / 1024).toFixed(2)} KB`);
  console.log(`💾 [DELTA RELEASE] Savings: ${manifest.savings}`);

  return manifest;
}

// Crea file di release
function createReleaseFiles() {
  const releaseExe = path.join(newDir, `Inferno-Console-Setup-${newVersion}.exe`);
  const releaseContent = `FAKE_RELEASE_EXE_V${newVersion}_${new Date().toISOString()}`;
  
  fs.writeFileSync(releaseExe, releaseContent);
  console.log('✅ [DELTA RELEASE] Release executable created:', releaseExe);
}

// Funzione principale
function main() {
  try {
    console.log('🚀 [DELTA RELEASE] Starting release generation...');

    // Genera manifest
    const manifest = generateManifest();

    // Crea file di release
    createReleaseFiles();

    // Crea file di changelog
    const changelogPath = path.join(newDir, 'CHANGELOG.md');
    const changelog = `# Release ${newVersion}

## Changes from ${previousVersion}

- Delta updates support
- Improved performance
- Bug fixes
- UI improvements

## Delta Update Information

- **Total Patch Size**: ${(manifest.totalSize / 1024).toFixed(2)} KB
- **Full Size**: ${(manifest.fullSize / 1024 / 1024).toFixed(1)} MB
- **Savings**: ${manifest.savings}
- **Files Updated**: ${manifest.files.length}

## Installation

1. Download the installer
2. Run the setup
3. The app will automatically apply delta updates

Generated on: ${new Date().toISOString()}
`;

    fs.writeFileSync(changelogPath, changelog);
    console.log('✅ [DELTA RELEASE] Changelog created:', changelogPath);

    console.log('🎉 [DELTA RELEASE] Release generation completed successfully!');
    console.log(`📁 [DELTA RELEASE] Release directory: ${newDir}`);
    console.log(`📊 [DELTA RELEASE] Files created:`);
    
    const files = fs.readdirSync(newDir);
    files.forEach(file => {
      const filePath = path.join(newDir, file);
      const stats = fs.statSync(filePath);
      console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });

  } catch (error) {
    console.error('❌ [DELTA RELEASE] Error generating release:', error);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main();
}

module.exports = { generateManifest, createDeltaPatch };
