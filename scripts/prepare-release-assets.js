#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script per preparare gli assets di release come farebbe GitHub Actions
 */

console.log('📦 [RELEASE ASSETS] Preparing release assets...');

const version = require('../package.json').version;
const releasesDir = path.join(__dirname, '..', 'releases', version);
const distElectronDir = path.join(__dirname, '..', 'dist-electron');
const releaseAssetsDir = path.join(__dirname, '..', 'release-assets');

// Crea directory release-assets
if (!fs.existsSync(releaseAssetsDir)) {
  fs.mkdirSync(releaseAssetsDir, { recursive: true });
  console.log('✅ [RELEASE ASSETS] Created release-assets directory');
}

// Copia file installer da dist-electron
const installerFiles = [
  'Inferno-Console-Installer.exe',
  'Inferno-Console-win.exe',
  'Inferno-Console-Uninstaller.exe',
  'latest.yml'
];

console.log('📁 [RELEASE ASSETS] Copying installer files...');
installerFiles.forEach(file => {
  const sourcePath = path.join(distElectronDir, file);
  const destPath = path.join(releaseAssetsDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    const stats = fs.statSync(destPath);
    console.log(`   ✅ ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.log(`   ❌ ${file} not found`);
  }
});

// Copia delta patches se esistono
if (fs.existsSync(releasesDir)) {
  console.log('🔧 [RELEASE ASSETS] Copying delta patches...');
  const deltaPatchesDir = path.join(releaseAssetsDir, 'delta-patches');
  
  if (!fs.existsSync(deltaPatchesDir)) {
    fs.mkdirSync(deltaPatchesDir, { recursive: true });
  }
  
  // Copia tutti i file dalla directory release
  const files = fs.readdirSync(releasesDir);
  files.forEach(file => {
    const sourcePath = path.join(releasesDir, file);
    const destPath = path.join(deltaPatchesDir, file);
    
    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, destPath);
      const stats = fs.statSync(destPath);
      console.log(`   ✅ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    }
  });
  
  console.log(`✅ [RELEASE ASSETS] Delta patches copied to delta-patches/`);
} else {
  console.log('❌ [RELEASE ASSETS] No delta patches found');
}

// Lista finale degli assets
console.log('\n📋 [RELEASE ASSETS] Final release assets:');
const finalFiles = fs.readdirSync(releaseAssetsDir, { withFileTypes: true });

finalFiles.forEach(item => {
  if (item.isDirectory()) {
    console.log(`📁 ${item.name}/`);
    const subFiles = fs.readdirSync(path.join(releaseAssetsDir, item.name));
    subFiles.forEach(subFile => {
      const subPath = path.join(releaseAssetsDir, item.name, subFile);
      const stats = fs.statSync(subPath);
      console.log(`   - ${subFile} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
  } else {
    const filePath = path.join(releaseAssetsDir, item.name);
    const stats = fs.statSync(filePath);
    console.log(`📄 ${item.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  }
});

console.log('\n🎉 [RELEASE ASSETS] Release assets prepared successfully!');
console.log(`📁 [RELEASE ASSETS] Assets directory: ${releaseAssetsDir}`);
