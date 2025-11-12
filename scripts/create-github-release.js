const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const REPO_OWNER = 'Alexand83';
const REPO_NAME = 'InfernoConsole';

async function createRelease() {
  const packageJson = require('../package.json');
  const version = packageJson.version;
  const tag = `v${version}`;
  
  console.log(`🚀 Creazione release ${tag} su GitHub...\n`);
  
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN non trovato!');
    console.error('   Imposta la variabile d\'ambiente GITHUB_TOKEN o GH_TOKEN');
    console.error('   Esempio: set GITHUB_TOKEN=ghp_your_token_here');
    process.exit(1);
  }
  
  // Step 1: Crea la release
  console.log('📝 Step 1: Creazione release...');
  const releaseData = {
    tag_name: tag,
    name: `${tag} - Auto-Update NSIS Integration`,
    body: `## 🎉 Novità v${version}

### ✨ Caratteristiche Principali
- ✅ **Installer NSIS** integrato con auto-updater
- ✅ **Aggiornamenti automatici** nella stessa directory
- ✅ **Installazione silenziosa** (modalità \`/S\`)
- ✅ **Chiusura automatica** dell'app prima dell'update
- ✅ **Shortcuts preservati** (Desktop + Start Menu)

### 🔧 Miglioramenti Tecnici
- Ottimizzazione memoria durante import massivi (cleanup ogni 50 file)
- Fix durata brani in File Manager (analisi audio robusta)
- Fix connessione DJ Remoto (ngrok WebSocket)
- DevTools shortcuts (F12, Ctrl+Shift+I)

### 📦 Installazione
Scarica \`Inferno-Console-Setup.exe\` per l'installazione completa con auto-updater.

### 🔄 Aggiornamento
Se hai già installato una versione precedente, l'app rileverà automaticamente questo aggiornamento e lo installerà nella stessa directory.

---

**Dimensione**: ~127 MB (compresso LZMA)  
**Compatibilità**: Windows 7+  
**Tipo**: Installer NSIS con auto-updater
`,
    draft: false,
    prerelease: false
  };
  
  const release = await makeRequest(
    'POST',
    `/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
    releaseData
  );
  
  console.log(`✅ Release creata: ${release.html_url}`);
  console.log(`   ID: ${release.id}`);
  console.log(`   Upload URL: ${release.upload_url}\n`);
  
  // Step 2: Upload installer NSIS
  console.log('📤 Step 2: Upload Inferno-Console-Setup.exe...');
  const installerPath = path.join(__dirname, '..', 'dist', 'Inferno-Console-Setup.exe');
  
  if (!fs.existsSync(installerPath)) {
    console.error(`❌ File non trovato: ${installerPath}`);
    process.exit(1);
  }
  
  const stats = fs.statSync(installerPath);
  console.log(`   File: ${installerPath}`);
  console.log(`   Dimensione: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  await uploadAsset(release.upload_url, installerPath, 'Inferno-Console-Setup.exe');
  
  console.log('\n✅ Release pubblicata con successo!');
  console.log(`🔗 URL: ${release.html_url}`);
  console.log('\n🎯 Prossimo step: Testa l\'auto-updater nell\'app v1.4.150');
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'User-Agent': 'inferno-console-release-script',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            resolve(responseData);
          }
        } else {
          console.error(`❌ Errore HTTP ${res.statusCode}`);
          console.error(responseData);
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

function uploadAsset(uploadUrl, filePath, filename) {
  return new Promise((resolve, reject) => {
    // Parse upload URL (rimuovi template {?name,label})
    const url = uploadUrl.replace(/\{[^}]+\}/, '');
    const urlObj = new URL(`${url}?name=${filename}`);
    
    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'User-Agent': 'inferno-console-release-script',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size
      }
    };
    
    console.log(`   Uploading to: ${urlObj.hostname}${urlObj.pathname}${urlObj.search}`);
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('   ✅ Upload completato!');
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            resolve(responseData);
          }
        } else {
          console.error(`   ❌ Errore upload: HTTP ${res.statusCode}`);
          console.error(responseData);
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    
    // Progress tracking
    let uploaded = 0;
    fileStream.on('data', (chunk) => {
      uploaded += chunk.length;
      const percent = ((uploaded / stats.size) * 100).toFixed(1);
      process.stdout.write(`\r   Progress: ${percent}% (${(uploaded / 1024 / 1024).toFixed(2)} MB / ${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    fileStream.on('end', () => {
      console.log(''); // New line after progress
    });
    
    fileStream.pipe(req);
  });
}

// Run
createRelease().catch((error) => {
  console.error('\n❌ Errore:', error.message);
  process.exit(1);
});

