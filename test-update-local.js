/**
 * 🧪 TEST LOCALE AUTO-UPDATER
 * 
 * Script per testare l'auto-updater in locale senza pubblicare su GitHub
 * 
 * Come usare:
 * 1. npm run build (crea la build di produzione)
 * 2. node test-update-local.js (avvia il server mock)
 * 3. Apri l'app in modalità dev e testa il controllo aggiornamenti
 */

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 3456
const MOCK_VERSION = '999.999.999' // Versione fake per test

// Leggi la versione corrente
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
const currentVersion = packageJson.version

console.log('🧪 TEST LOCALE AUTO-UPDATER')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`📦 Versione corrente: ${currentVersion}`)
console.log(`📦 Versione mock: ${MOCK_VERSION}`)
console.log(`🌐 Server mock: http://localhost:${PORT}`)
console.log('')

// Percorsi per i file di test
const TEST_DIR = path.join(__dirname, 'test-update')
const MOCK_INSTALLER = path.join(TEST_DIR, 'Inferno-Console-Setup.exe')
const LATEST_YML = path.join(TEST_DIR, 'latest.yml')

// Crea directory di test
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true })
  console.log('✅ Directory test creata:', TEST_DIR)
}

// Crea un mock installer (file vuoto per test)
if (!fs.existsSync(MOCK_INSTALLER)) {
  // Crea un file di test da 1MB (simulazione installer)
  const mockData = Buffer.alloc(1024 * 1024) // 1 MB
  fs.writeFileSync(MOCK_INSTALLER, mockData)
  console.log('✅ Mock installer creato:', MOCK_INSTALLER)
}

// Crea latest.yml per electron-updater
const latestYmlContent = `version: ${MOCK_VERSION}
files:
  - url: Inferno-Console-Setup.exe
    sha512: MOCK_HASH_FOR_TESTING
    size: ${fs.statSync(MOCK_INSTALLER).size}
path: Inferno-Console-Setup.exe
sha512: MOCK_HASH_FOR_TESTING
releaseDate: ${new Date().toISOString()}
`

fs.writeFileSync(LATEST_YML, latestYmlContent)
console.log('✅ latest.yml creato:', LATEST_YML)
console.log('')

// Mock response per GitHub API
const mockGitHubRelease = {
  tag_name: `v${MOCK_VERSION}`,
  name: `Test Release ${MOCK_VERSION}`,
  body: '🧪 Test release per auto-updater locale',
  published_at: new Date().toISOString(),
  assets: [
    {
      name: 'Inferno-Console-Setup.exe',
      size: fs.statSync(MOCK_INSTALLER).size,
      browser_download_url: `http://localhost:${PORT}/download/Inferno-Console-Setup.exe`,
      content_type: 'application/x-msdownload'
    },
    {
      name: 'latest.yml',
      size: fs.statSync(LATEST_YML).size,
      browser_download_url: `http://localhost:${PORT}/download/latest.yml`,
      content_type: 'text/yaml'
    }
  ]
}

// Server HTTP mock
const server = http.createServer((req, res) => {
  console.log(`📡 ${req.method} ${req.url}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // GitHub API mock - latest release
  if (req.url === '/repos/Alexand83/InfernoConsole/releases/latest') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(mockGitHubRelease))
    return
  }

  // Download latest.yml
  if (req.url === '/download/latest.yml') {
    res.writeHead(200, {
      'Content-Type': 'text/yaml',
      'Content-Length': fs.statSync(LATEST_YML).size
    })
    fs.createReadStream(LATEST_YML).pipe(res)
    return
  }

  // Download installer mock
  if (req.url === '/download/Inferno-Console-Setup.exe') {
    const stat = fs.statSync(MOCK_INSTALLER)
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="Inferno-Console-Setup.exe"'
    })
    
    // Simula download lento per testare la progress bar
    const stream = fs.createReadStream(MOCK_INSTALLER, { highWaterMark: 64 * 1024 }) // 64KB chunks
    stream.on('data', (chunk) => {
      res.write(chunk)
      // Pausa di 50ms per simulare velocità di rete
      stream.pause()
      setTimeout(() => stream.resume(), 50)
    })
    stream.on('end', () => res.end())
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not Found')
})

server.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ Server mock avviato su http://localhost:${PORT}`)
  console.log('')
  console.log('📋 ENDPOINT DISPONIBILI:')
  console.log(`   • GitHub API: http://localhost:${PORT}/repos/Alexand83/InfernoConsole/releases/latest`)
  console.log(`   • latest.yml: http://localhost:${PORT}/download/latest.yml`)
  console.log(`   • Installer:  http://localhost:${PORT}/download/Inferno-Console-Setup.exe`)
  console.log('')
  console.log('🎯 COME TESTARE:')
  console.log('   1. Modifica electron/updater.js per usare localhost (vedi istruzioni sotto)')
  console.log('   2. Avvia l\'app in modalità dev: npm run dev')
  console.log('   3. Vai nelle Impostazioni e clicca "Controlla Aggiornamenti"')
  console.log('   4. Dovresti vedere la versione 999.999.999 disponibile')
  console.log('')
  console.log('💡 MODIFICA TEMPORANEA PER TEST:')
  console.log('   In electron/updater.js, riga ~770, cambia:')
  console.log('   const url = \'https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest\'')
  console.log('   in:')
  console.log(`   const url = 'http://localhost:${PORT}/repos/Alexand83/InfernoConsole/releases/latest'`)
  console.log('')
  console.log('⚠️  RICORDA: Ripristina la URL originale dopo i test!')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Premi CTRL+C per fermare il server')
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Arresto server...')
  server.close(() => {
    console.log('✅ Server fermato')
    process.exit(0)
  })
})

