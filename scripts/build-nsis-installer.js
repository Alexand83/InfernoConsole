const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const https = require('https');

console.log('🚀 Building NSIS Installer for Inferno Console...\n');

// 1. Verifica che NSIS sia installato
console.log('📋 Step 1: Verifica installazione NSIS...');
try {
  const nsisPath = process.env.NSIS_PATH || 'C:\\Program Files (x86)\\NSIS\\makensis.exe';
  
  if (!fs.existsSync(nsisPath)) {
    console.error('❌ NSIS non trovato!');
    console.error('   Scarica NSIS da: https://nsis.sourceforge.io/Download');
    console.error('   Oppure imposta la variabile d\'ambiente NSIS_PATH');
    process.exit(1);
  }
  
  console.log('✅ NSIS trovato:', nsisPath);
} catch (error) {
  console.error('❌ Errore verifica NSIS:', error.message);
  process.exit(1);
}

// 2. Scarica l'ultima release da GitHub
console.log('\n📥 Step 2: Download ultima release da GitHub...');

async function downloadLatestRelease() {
  const distDir = path.join(__dirname, '..', 'dist-electron');
  await fs.ensureDir(distDir);
  
  const outputPath = path.join(distDir, 'Inferno-Console-win.exe');
  
  // Se esiste già, chiedi se sovrascrivere
  if (fs.existsSync(outputPath)) {
    console.log('⚠️  File già presente:', outputPath);
    console.log('   Usando il file esistente...');
    return outputPath;
  }
  
  return new Promise((resolve, reject) => {
    console.log('   Connessione a GitHub API...');
    
    const options = {
      hostname: 'api.github.com',
      path: '/repos/Alexand83/InfernoConsole/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'inferno-console-nsis-builder',
        'Accept': 'application/vnd.github+json'
      }
    };
    
    https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const asset = release.assets.find(a => 
            a.name && a.name.toLowerCase().includes('inferno-console-win.exe')
          );
          
          if (!asset) {
            console.log('⚠️  Asset non trovato, usando build locale se disponibile...');
            
            // Cerca build locale
            const localBuild = path.join(__dirname, '..', 'dist', 'Inferno-Console-win.exe');
            if (fs.existsSync(localBuild)) {
              console.log('✅ Usando build locale:', localBuild);
              fs.copySync(localBuild, outputPath);
              resolve(outputPath);
            } else {
              reject(new Error('Nessuna build disponibile'));
            }
            return;
          }
          
          console.log('   Download:', asset.name, `(${Math.round(asset.size / 1024 / 1024)}MB)`);
          
          // Download del file
          const file = fs.createWriteStream(outputPath);
          https.get(asset.browser_download_url, {
            headers: {
              'User-Agent': 'inferno-console-nsis-builder',
              'Accept': 'application/octet-stream'
            }
          }, (downloadRes) => {
            // Gestisci redirect
            if ([301, 302, 307, 308].includes(downloadRes.statusCode)) {
              https.get(downloadRes.headers.location, (redirectRes) => {
                redirectRes.pipe(file);
                
                file.on('finish', () => {
                  file.close();
                  console.log('✅ Download completato!');
                  resolve(outputPath);
                });
              }).on('error', reject);
              return;
            }
            
            downloadRes.pipe(file);
            
            file.on('finish', () => {
              file.close();
              console.log('✅ Download completato!');
              resolve(outputPath);
            });
            
            file.on('error', (err) => {
              fs.unlink(outputPath, () => {});
              reject(err);
            });
          }).on('error', reject);
          
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// 3. Leggi la versione dal package.json
console.log('\n📦 Step 3: Lettura versione...');
const packageJson = require('../package.json');
const version = packageJson.version || '1.4.139';
const [major, minor, build] = version.split('.');

console.log('   Versione:', version);

// 4. Aggiorna lo script NSIS con la versione corretta
console.log('\n✏️  Step 4: Aggiornamento script NSIS...');
const nsiPath = path.join(__dirname, '..', 'installer', 'inferno-console.nsi');
let nsiContent = fs.readFileSync(nsiPath, 'utf8');

nsiContent = nsiContent.replace(/!define VERSIONMAJOR \d+/, `!define VERSIONMAJOR ${major}`);
nsiContent = nsiContent.replace(/!define VERSIONMINOR \d+/, `!define VERSIONMINOR ${minor}`);
nsiContent = nsiContent.replace(/!define VERSIONBUILD \d+/, `!define VERSIONBUILD ${build}`);

fs.writeFileSync(nsiPath, nsiContent);
console.log('✅ Script NSIS aggiornato con versione:', version);

// 5. Compila l'installer NSIS
async function buildInstaller() {
  try {
    // Download release
    await downloadLatestRelease();
    
    console.log('\n🔨 Step 5: Compilazione installer NSIS...');
    const nsisPath = process.env.NSIS_PATH || 'C:\\Program Files (x86)\\NSIS\\makensis.exe';
    
    const cmd = `"${nsisPath}" "${nsiPath}"`;
    console.log('   Comando:', cmd);
    
    execSync(cmd, { stdio: 'inherit' });
    
    console.log('\n✅ Installer creato con successo!');
    console.log('📦 File:', path.join(__dirname, '..', 'dist', 'Inferno-Console-Setup.exe'));
    
  } catch (error) {
    console.error('\n❌ Errore durante la compilazione:', error.message);
    process.exit(1);
  }
}

buildInstaller();

