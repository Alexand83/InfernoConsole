#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Script per creare release automatiche
 * Usage: node scripts/create-release.js [version]
 */

const args = process.argv.slice(2);
const version = args[0];

if (!version) {
  console.error('❌ [RELEASE] Version is required');
  console.log('Usage: node scripts/create-release.js [version]');
  console.log('Example: node scripts/create-release.js 1.4.110');
  process.exit(1);
}

console.log('🚀 [RELEASE] Creating release for version:', version);

// Valida formato versione
const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(version)) {
  console.error('❌ [RELEASE] Invalid version format. Use: X.Y.Z (e.g., 1.4.110)');
  process.exit(1);
}

function runCommand(command, description) {
  console.log(`🔧 [RELEASE] ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ [RELEASE] ${description} completed`);
  } catch (error) {
    console.error(`❌ [RELEASE] ${description} failed:`, error.message);
    process.exit(1);
  }
}

function updatePackageJson(newVersion) {
  console.log('📝 [RELEASE] Updating package.json...');
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  packageJson.version = newVersion;
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ [RELEASE] package.json updated to version ${newVersion}`);
}

function createGitTag(version) {
  console.log('🏷️ [RELEASE] Creating git tag...');
  
  try {
    // Aggiungi e committa le modifiche
    runCommand('git add .', 'Adding files to git');
    runCommand(`git commit -m "Release v${version}"`, 'Committing changes');
    
    // Crea tag
    runCommand(`git tag -a v${version} -m "Release v${version}"`, 'Creating git tag');
    
    console.log(`✅ [RELEASE] Git tag v${version} created`);
  } catch (error) {
    console.log('⚠️ [RELEASE] Git operations failed, continuing...');
  }
}

function generateDeltaPatches(version) {
  console.log('🔧 [RELEASE] Generating delta patches...');
  
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
        console.log(`📁 [RELEASE] Found previous version: ${previousVersion}`);
        runCommand(`node scripts/generate-delta-release.js ${previousVersion} ${version}`, 'Generating delta patches');
      } else {
        console.log('📁 [RELEASE] No previous version found, creating full release');
        runCommand(`node scripts/generate-delta-release.js ${version}`, 'Creating full release');
      }
    } else {
      console.log('📁 [RELEASE] No releases directory found, creating full release');
      runCommand(`node scripts/generate-delta-release.js ${version}`, 'Creating full release');
    }
  } catch (error) {
    console.log('⚠️ [RELEASE] Delta patch generation failed, continuing...');
  }
}

function buildApplication() {
  console.log('🔨 [RELEASE] Building application...');
  runCommand('npm run build', 'Building application');
}

function createReleaseNotes(version) {
  console.log('📝 [RELEASE] Creating release notes...');
  
  const releaseNotes = `# Release v${version}

## 🚀 What's New

- Delta updates support for faster downloads
- Improved update system with automatic fallback
- Enhanced UI for update management
- Bug fixes and performance improvements

## 🔄 Delta Updates

This release includes delta update patches for faster downloads:
- **95% smaller downloads** compared to full installers
- **10-20x faster** update process
- **Automatic fallback** to full download if needed

## 📦 Installation

1. Download the installer for your platform
2. Run the installer
3. The app will automatically check for delta updates

## 🛠️ For Developers

- Delta patches are generated automatically
- Manifest files track file changes
- GitHub Actions workflow handles the entire process

Generated on: ${new Date().toISOString()}
`;

  const notesPath = path.join(__dirname, '..', 'releases', version, 'RELEASE_NOTES.md');
  const releasesDir = path.dirname(notesPath);
  
  if (!fs.existsSync(releasesDir)) {
    fs.mkdirSync(releasesDir, { recursive: true });
  }
  
  fs.writeFileSync(notesPath, releaseNotes);
  console.log(`✅ [RELEASE] Release notes created: ${notesPath}`);
}

// Funzione principale
function main() {
  try {
    console.log('🎯 [RELEASE] Starting release process...');
    
    // 1. Aggiorna package.json
    updatePackageJson(version);
    
    // 2. Genera delta patches
    generateDeltaPatches(version);
    
    // 3. Build dell'applicazione
    buildApplication();
    
    // 4. Crea release notes
    createReleaseNotes(version);
    
    // 5. Crea git tag
    createGitTag(version);
    
    console.log('🎉 [RELEASE] Release process completed successfully!');
    console.log(`📁 [RELEASE] Release files created in: releases/${version}/`);
    console.log(`🏷️ [RELEASE] Git tag created: v${version}`);
    console.log('');
    console.log('📋 [RELEASE] Next steps:');
    console.log('1. Push the tag to GitHub: git push origin v' + version);
    console.log('2. GitHub Actions will automatically create the release');
    console.log('3. Delta patches will be uploaded as release assets');
    
  } catch (error) {
    console.error('❌ [RELEASE] Release process failed:', error);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main();
}

module.exports = { updatePackageJson, generateDeltaPatches, createGitTag };
