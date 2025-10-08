#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Script per creare una release reale e completa
 * Simula esattamente quello che fa GitHub Actions
 */

const args = process.argv.slice(2);
const version = args[0];

if (!version) {
  console.error('❌ [REAL RELEASE] Version is required');
  console.log('Usage: node scripts/create-real-release.js [version]');
  console.log('Example: node scripts/create-real-release.js 1.4.112');
  process.exit(1);
}

console.log('🚀 [REAL RELEASE] Creating real release for version:', version);

function runCommand(command, description) {
  console.log(`🔧 [REAL RELEASE] ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ [REAL RELEASE] ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ [REAL RELEASE] ${description} failed:`, error.message);
    return false;
  }
}

function updatePackageJson(newVersion) {
  console.log('📝 [REAL RELEASE] Updating package.json...');
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  packageJson.version = newVersion;
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ [REAL RELEASE] package.json updated to version ${newVersion}`);
}

function buildApplication() {
  console.log('🔨 [REAL RELEASE] Building application...');
  return runCommand('npm run build', 'Building application');
}

function createInstaller() {
  console.log('📦 [REAL RELEASE] Creating installer...');
  
  // Vai nella directory installer
  const installerDir = path.join(__dirname, '..', 'installer');
  const originalDir = process.cwd();
  
  try {
    process.chdir(installerDir);
    
    // Installa dipendenze
    if (!runCommand('npm install', 'Installing installer dependencies')) {
      return false;
    }
    
    // Crea installer
    if (!runCommand('node build-installer.js', 'Building installer')) {
      return false;
    }
    
    return true;
  } finally {
    process.chdir(originalDir);
  }
}

function createDistribution() {
  console.log('📁 [REAL RELEASE] Creating distribution...');
  return runCommand('npm run dist:win', 'Creating distribution files for Windows');
}

function generateDeltaPatches(version) {
  console.log('🔧 [REAL RELEASE] Generating delta patches...');
  
  try {
    // Trova l'ultima versione
    const releasesDir = path.join(__dirname, '..', 'releases');
    if (fs.existsSync(releasesDir)) {
      const versions = fs.readdirSync(releasesDir)
        .filter(dir => fs.statSync(path.join(releasesDir, dir)).isDirectory())
        .sort((a, b) => {
          const aParts = a.split('.').map(Number);
          const bParts = b.split('.').map(Number);
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0;
            const bPart = bParts[i] || 0;
            if (aPart !== bPart) return aPart - bPart;
          }
          return 0;
        });
      
      const previousVersion = versions[versions.length - 1];
      
      if (previousVersion) {
        console.log(`📁 [REAL RELEASE] Found previous version: ${previousVersion}`);
        return runCommand(`node scripts/generate-delta-release.js ${previousVersion} ${version}`, 'Generating delta patches');
      } else {
        console.log('📁 [REAL RELEASE] No previous version found, creating full release');
        return runCommand(`node scripts/generate-delta-release.js ${version}`, 'Creating full release');
      }
    } else {
      console.log('📁 [REAL RELEASE] No releases directory found, creating full release');
      return runCommand(`node scripts/generate-delta-release.js ${version}`, 'Creating full release');
    }
  } catch (error) {
    console.log('⚠️ [REAL RELEASE] Delta patch generation failed, continuing...');
    return true;
  }
}

function prepareReleaseAssets(version) {
  console.log('📦 [REAL RELEASE] Preparing release assets...');
  
  const distElectronDir = path.join(__dirname, '..', 'dist-electron');
  const releasesDir = path.join(__dirname, '..', 'releases', version);
  const releaseAssetsDir = path.join(__dirname, '..', 'release-assets');
  
  // Crea directory release-assets
  if (fs.existsSync(releaseAssetsDir)) {
    fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(releaseAssetsDir, { recursive: true });
  
  // File installer da copiare
  const installerFiles = [
    'Inferno-Console-Installer.exe',
    'Inferno-Console-win.exe',
    'Inferno-Console-Uninstaller.exe',
    'latest.yml'
  ];
  
  console.log('📁 [REAL RELEASE] Copying installer files...');
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
    console.log('🔧 [REAL RELEASE] Copying delta patches...');
    const deltaPatchesDir = path.join(releaseAssetsDir, 'delta-patches');
    fs.mkdirSync(deltaPatchesDir, { recursive: true });
    
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
    
    console.log(`✅ [REAL RELEASE] Delta patches copied to delta-patches/`);
  }
  
  // Lista finale degli assets
  console.log('\n📋 [REAL RELEASE] Final release assets:');
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
  
  return true;
}

function createGitTag(version) {
  console.log('🏷️ [REAL RELEASE] Creating git tag...');
  
  try {
    // Aggiungi e committa le modifiche
    runCommand('git add .', 'Adding files to git');
    runCommand(`git commit -m "Release v${version}"`, 'Committing changes');
    
    // Crea tag
    runCommand(`git tag -a v${version} -m "Release v${version}"`, 'Creating git tag');
    
    console.log(`✅ [REAL RELEASE] Git tag v${version} created`);
    return true;
  } catch (error) {
    console.log('⚠️ [REAL RELEASE] Git operations failed, continuing...');
    return true;
  }
}

// Funzione principale
function main() {
  try {
    console.log('🎯 [REAL RELEASE] Starting real release process...');
    
    // 1. Aggiorna package.json
    updatePackageJson(version);
    
    // 2. Build dell'applicazione
    if (!buildApplication()) {
      throw new Error('Build failed');
    }
    
    // 3. Crea installer
    if (!createInstaller()) {
      throw new Error('Installer creation failed');
    }
    
    // 4. Crea distribuzione (opzionale)
    console.log('⚠️ [REAL RELEASE] Skipping distribution creation (requires GH_TOKEN)');
    // if (!createDistribution()) {
    //   throw new Error('Distribution creation failed');
    // }
    
    // 5. Genera delta patches
    if (!generateDeltaPatches(version)) {
      throw new Error('Delta patch generation failed');
    }
    
    // 6. Prepara assets di release
    if (!prepareReleaseAssets(version)) {
      throw new Error('Release assets preparation failed');
    }
    
    // 7. Crea git tag
    createGitTag(version);
    
    console.log('🎉 [REAL RELEASE] Real release process completed successfully!');
    console.log(`📁 [REAL RELEASE] Release files created in: release-assets/`);
    console.log(`🏷️ [REAL RELEASE] Git tag created: v${version}`);
    console.log('');
    console.log('📋 [REAL RELEASE] Next steps:');
    console.log('1. Push the tag to GitHub: git push origin v' + version);
    console.log('2. GitHub Actions will automatically create the release');
    console.log('3. All assets will be uploaded to GitHub Release');
    
  } catch (error) {
    console.error('❌ [REAL RELEASE] Real release process failed:', error);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main();
}

module.exports = { updatePackageJson, buildApplication, createInstaller, createDistribution, generateDeltaPatches, prepareReleaseAssets, createGitTag };
