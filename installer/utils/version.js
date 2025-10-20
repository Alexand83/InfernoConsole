const path = require('path');
const fs = require('fs');

/**
 * Risolve la versione dinamicamente da:
 * 1. Variabili d'ambiente (VERSION, GITHUB_REF_NAME)
 * 2. package.json principale
 * 3. Fallback a '0.0.0'
 */
function resolveVersion() {
  let resolvedVersion = '0.0.0';
  
  try {
    // 1. Prova variabili d'ambiente
    const envVersionRaw = process.env.VERSION || process.env.GITHUB_REF_NAME || '';
    const envVersion = envVersionRaw.startsWith('v') ? envVersionRaw.slice(1) : envVersionRaw;
    
    if (envVersion && envVersion.trim().length > 0) {
      resolvedVersion = envVersion.trim();
      console.log(`📦 Versione da ambiente: ${resolvedVersion}`);
      return resolvedVersion;
    }
    
    // 2. Prova package.json principale
    const rootPkgPath = path.join(__dirname, '..', '..', 'package.json');
    if (fs.existsSync(rootPkgPath)) {
      const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      if (rootPkg && rootPkg.version) {
        resolvedVersion = String(rootPkg.version);
        console.log(`📦 Versione da package.json: ${resolvedVersion}`);
        return resolvedVersion;
      }
    }
    
    // 3. Fallback
    console.log(`⚠️ Versione fallback: ${resolvedVersion}`);
    return resolvedVersion;
    
  } catch (error) {
    console.error('❌ Errore risoluzione versione:', error.message);
    return resolvedVersion;
  }
}

module.exports = { resolveVersion };
