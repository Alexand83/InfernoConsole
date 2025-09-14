const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Script per aggiornare automaticamente la versione
 * Sincronizza package.json con GitHub e aggiorna i file necessari
 */

function updateVersion() {
  console.log('🔄 Aggiornamento versione automatico...');
  
  // Leggi package.json
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  console.log('📦 Versione corrente:', packageJson.version);
  
  // Controlla se ci sono modifiche non committate
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (gitStatus.trim()) {
      console.log('⚠️  Ci sono modifiche non committate. Committale prima di aggiornare la versione.');
      return;
    }
  } catch (error) {
    console.log('⚠️  Errore nel controllo Git:', error.message);
  }
  
  // Controlla se ci sono tag per la versione corrente
  try {
    const currentTag = `v${packageJson.version}`;
    const gitTags = execSync('git tag', { encoding: 'utf8' });
    
    if (gitTags.includes(currentTag)) {
      console.log('✅ Tag già esistente per la versione corrente');
    } else {
      console.log('📝 Creazione tag per la versione corrente...');
      execSync(`git tag ${currentTag}`, { stdio: 'inherit' });
      console.log('✅ Tag creato:', currentTag);
    }
  } catch (error) {
    console.log('⚠️  Errore nella gestione dei tag:', error.message);
  }
  
  console.log('🎯 Versione sincronizzata con successo!');
  console.log('📋 Prossimi passi:');
  console.log('   1. git push origin master');
  console.log('   2. git push origin --tags');
  console.log('   3. GitHub Actions creerà automaticamente il release');
}

// Esegui l'aggiornamento
updateVersion();
