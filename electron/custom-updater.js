/**
 * Custom Updater per Inferno Console
 * Mostra UI con progress bar durante l'aggiornamento
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { app, BrowserWindow } = require('electron')

class CustomUpdater {
  constructor() {
    this.progressWindow = null
  }

  /**
   * Esegue l'aggiornamento con UI
   * @param {string} installerPath - Path dell'installer NSIS scaricato
   */
  async performUpdate(installerPath) {
    try {
      console.log('🚀 [UPDATER] Avvio aggiornamento...')
      
      // 1. Crea finestra di progresso
      this.createProgressWindow()
      await this.sleep(500)
      
      // 2. Ottieni path installazione
      const installDir = path.dirname(process.execPath)
      const exeName = path.basename(process.execPath)
      const targetExe = path.join(installDir, exeName)
      
      this.updateProgress('Preparazione aggiornamento...', 10)
      await this.sleep(1000)
      
      // 3. Crea backup
      this.updateProgress('Backup versione corrente...', 20)
      const backupPath = targetExe + '.backup'
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath)
      }
      fs.copyFileSync(targetExe, backupPath)
      console.log('✅ [UPDATER] Backup creato:', backupPath)
      await this.sleep(500)
      
      // 4. Estrai nuovo EXE dall'installer NSIS
      this.updateProgress('Estrazione nuova versione...', 30)
      const extractedExe = await this.extractExeFromInstaller(installerPath, installDir)
      await this.sleep(500)
      
      // 5. Prepara batch script
      this.updateProgress('Preparazione installazione...', 60)
      await this.sleep(500)
      
      // 6. Sostituisci EXE usando batch script (prima di chiudere!)
      this.updateProgress('Installazione aggiornamento...', 80)
      await this.replaceExeWithBatch(extractedExe, targetExe, backupPath)
      await this.sleep(500)
      
      // 7. Mostra completamento
      this.updateProgress('Aggiornamento completato!', 100)
      await this.sleep(1000)
      
      // 8. Riavvia app PRIMA di chiudere (così funziona!)
      this.updateProgress('Riavvio applicazione...', 100)
      await this.sleep(500)
      await this.restartAppDirectly(targetExe, installDir)
      
      // 9. Chiudi app dopo il riavvio
      await this.sleep(1000)
      await this.closeApp()
      
    } catch (error) {
      console.error('❌ [UPDATER] Errore:', error)
      this.showError(error.message)
      throw error
    }
  }

  /**
   * Crea finestra di progresso
   */
  createProgressWindow() {
    this.progressWindow = new BrowserWindow({
      width: 550,
      height: 400,
      frame: false,
      resizable: false,
      transparent: false,
      alwaysOnTop: true,
      center: true,
      backgroundColor: '#1a1a1a',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background: radial-gradient(ellipse at top, #1a1a2e 0%, #0f0f1e 50%, #000 100%);
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 40px;
      position: relative;
      overflow: hidden;
    }
    body::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: 
        radial-gradient(circle at 20% 50%, rgba(255, 107, 53, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 50%, rgba(247, 147, 30, 0.1) 0%, transparent 50%);
      animation: rotate 20s linear infinite;
    }
    @keyframes rotate {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .container {
      position: relative;
      z-index: 1;
      text-align: center;
      width: 100%;
      max-width: 500px;
    }
    .logo-container {
      position: relative;
      margin-bottom: 20px;
    }
    .logo {
      font-size: 64px;
      filter: drop-shadow(0 0 20px rgba(255, 107, 53, 0.8));
      animation: pulse 3s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { 
        transform: scale(1);
        filter: drop-shadow(0 0 20px rgba(255, 107, 53, 0.8));
      }
      50% { 
        transform: scale(1.1);
        filter: drop-shadow(0 0 40px rgba(247, 147, 30, 1));
      }
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #ff6b35, #f7931e, #fdc830);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .subtitle {
      font-size: 14px;
      opacity: 0.7;
      margin-bottom: 40px;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    .percent {
      font-size: 56px;
      font-weight: 700;
      margin: 20px 0;
      background: linear-gradient(135deg, #ff6b35, #f7931e, #fdc830);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 2px 10px rgba(255, 107, 53, 0.5));
      font-family: 'Courier New', monospace;
    }
    .progress-container {
      width: 100%;
      height: 50px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 25px;
      overflow: hidden;
      margin: 30px 0;
      box-shadow: 
        inset 0 2px 10px rgba(0,0,0,0.5),
        0 5px 20px rgba(0,0,0,0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      position: relative;
    }
    .progress-container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 40%;
      background: linear-gradient(to bottom, rgba(255,255,255,0.1), transparent);
      pointer-events: none;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, 
        #ff6b35 0%, 
        #f7931e 25%,
        #fdc830 50%,
        #f7931e 75%,
        #ff6b35 100%
      );
      background-size: 200% 100%;
      width: 0%;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 25px;
      position: relative;
      box-shadow: 0 0 30px rgba(255, 107, 53, 0.6);
      animation: gradient-shift 3s ease-in-out infinite;
    }
    @keyframes gradient-shift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    .progress-bar::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255,255,255,0.4),
        transparent
      );
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .status { 
      font-size: 18px; 
      opacity: 0.9; 
      margin-top: 25px;
      text-align: center;
      min-height: 24px;
      font-weight: 500;
      letter-spacing: 1px;
      color: #fdc830;
      text-shadow: 0 0 10px rgba(253, 200, 48, 0.5);
      animation: fade-pulse 2s ease-in-out infinite;
    }
    @keyframes fade-pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    .particles {
      position: absolute;
      width: 100%;
      height: 100%;
      overflow: hidden;
      pointer-events: none;
    }
    .particle {
      position: absolute;
      width: 4px;
      height: 4px;
      background: radial-gradient(circle, #fdc830, transparent);
      border-radius: 50%;
      animation: float-up 10s infinite;
      opacity: 0;
    }
    @keyframes float-up {
      0% {
        transform: translateY(100vh) scale(0);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      100% {
        transform: translateY(-100vh) scale(1);
        opacity: 0;
      }
    }
    .error {
      background: linear-gradient(135deg, #d32f2f, #b71c1c);
      padding: 20px;
      border-radius: 15px;
      margin-top: 30px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(211, 47, 47, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  </style>
</head>
<body>
  <div class="particles" id="particles"></div>
  <div class="container">
    <div class="logo-container">
      <div class="logo">🔥</div>
    </div>
    <h1>Inferno Console</h1>
    <div class="subtitle">Aggiornamento in corso</div>
    <div class="percent" id="percent">0%</div>
    <div class="progress-container">
      <div class="progress-bar" id="progress"></div>
    </div>
    <div class="status" id="status">Inizializzazione...</div>
    <div class="error" id="error" style="display:none;"></div>
  </div>
  <script>
    const { ipcRenderer } = require('electron')
    
    // Crea particelle
    const particlesContainer = document.getElementById('particles')
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div')
      particle.className = 'particle'
      particle.style.left = Math.random() * 100 + '%'
      particle.style.animationDelay = Math.random() * 10 + 's'
      particle.style.animationDuration = (Math.random() * 5 + 5) + 's'
      particlesContainer.appendChild(particle)
    }
    
    ipcRenderer.on('update-progress', (e, { message, percent }) => {
      document.getElementById('progress').style.width = percent + '%'
      document.getElementById('percent').textContent = Math.round(percent) + '%'
      document.getElementById('status').textContent = message
    })
    
    ipcRenderer.on('update-error', (e, { message }) => {
      document.getElementById('error').style.display = 'block'
      document.getElementById('error').textContent = '❌ Errore: ' + message
    })
  </script>
</body>
</html>
    `

    this.progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    this.progressWindow.setMenu(null)
  }

  /**
   * Aggiorna progress bar
   */
  updateProgress(message, percent) {
    console.log(`📊 [UPDATER] ${percent}% - ${message}`)
    if (this.progressWindow && !this.progressWindow.isDestroyed()) {
      this.progressWindow.webContents.send('update-progress', { message, percent })
    }
  }

  /**
   * Mostra errore
   */
  showError(message) {
    if (this.progressWindow && !this.progressWindow.isDestroyed()) {
      this.progressWindow.webContents.send('update-error', { message })
    }
  }

  /**
   * Estrae l'EXE dall'installer NSIS usando 7zip
   */
  async extractExeFromInstaller(installerPath, installDir) {
    return new Promise((resolve, reject) => {
      const tempExtractDir = path.join(app.getPath('temp'), 'inferno-extract-' + Date.now())
      fs.mkdirSync(tempExtractDir, { recursive: true })
      
      console.log('📦 [UPDATER] Estrazione installer:', installerPath)
      console.log('📂 [UPDATER] Directory temp:', tempExtractDir)
      
      // NSIS installer può essere estratto con 7zip
      // Cerchiamo 7zip nella directory di electron-builder o nel sistema
      const possible7zipPaths = [
        path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', '7za.exe'),
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe'
      ]
      
      let sevenZipPath = null
      for (const p of possible7zipPaths) {
        if (fs.existsSync(p)) {
          sevenZipPath = p
          break
        }
      }
      
      if (!sevenZipPath) {
        // Se non troviamo 7zip, usiamo l'installer direttamente
        console.log('⚠️ [UPDATER] 7zip non trovato, uso installer diretto')
        resolve(installerPath)
        return
      }
      
      console.log('✅ [UPDATER] Usando 7zip:', sevenZipPath)
      
      // Estrai installer
      const extract = spawn(sevenZipPath, ['x', installerPath, `-o${tempExtractDir}`, '-y'])
      
      extract.on('close', (code) => {
        if (code === 0) {
          // Cerca l'EXE nell'estratto
          const exeName = 'Inferno Console.exe'
          const extractedExe = this.findFileRecursive(tempExtractDir, exeName)
          
          if (extractedExe) {
            console.log('✅ [UPDATER] EXE estratto:', extractedExe)
            resolve(extractedExe)
          } else {
            console.log('⚠️ [UPDATER] EXE non trovato nell\'estratto, uso installer diretto')
            resolve(installerPath)
          }
        } else {
          console.log('⚠️ [UPDATER] Estrazione fallita, uso installer diretto')
          resolve(installerPath)
        }
      })
    })
  }

  /**
   * Trova file ricorsivamente
   */
  findFileRecursive(dir, filename) {
    try {
      const files = fs.readdirSync(dir)
      
      for (const file of files) {
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)
        
        if (stat.isDirectory()) {
          const found = this.findFileRecursive(fullPath, filename)
          if (found) return found
        } else if (file === filename) {
          return fullPath
        }
      }
    } catch (error) {
      console.error('Errore ricerca file:', error)
    }
    return null
  }

  /**
   * Sostituisce EXE usando batch script
   */
  async replaceExeWithBatch(newExePath, targetExePath, backupPath) {
    return new Promise((resolve) => {
      const batchPath = path.join(app.getPath('temp'), 'update-inferno.bat')
      
      // Rileva se siamo in dev mode (electron.exe)
      const isDevMode = targetExePath.toLowerCase().includes('electron.exe')
      const isInstaller = newExePath.toLowerCase().endsWith('-setup.exe')
      
      let batchContent
      
      if (isDevMode) {
        // MODALITÀ DEV: Riavvia electron con il progetto
        const projectDir = process.cwd().replace(/\\/g, '\\\\')
        const electronPath = targetExePath.replace(/\\/g, '\\\\')
        batchContent = `@echo off
chcp 65001 >nul
title Aggiornamento Inferno Console (DEV MODE)
echo.
echo ╔════════════════════════════════════════════╗
echo ║   🔥 Aggiornamento Inferno Console 🔥   ║
echo ║           (MODALITA' TEST)              ║
echo ╚════════════════════════════════════════════╝
echo.
echo ⏳ Attendi chiusura applicazione...
timeout /t 3 /nobreak >nul
echo ✓ Applicazione chiusa
echo.
echo 📦 Test aggiornamento completato!
echo.
echo 🚀 Riavvio applicazione in dev mode...
timeout /t 2 /nobreak >nul
cd /d "${projectDir}"
set UPDATE_TEST_MODE=local
set PATH=%PATH%;%LOCALAPPDATA%\\electron\\dist
if exist "${electronPath}" (
    start "" /D "${projectDir}" "${electronPath}" .
    echo ✓ Electron avviato
) else (
    echo ❌ Electron non trovato: ${electronPath}
    pause
)
echo.
echo ✅ Test completato! L'app dovrebbe riavviarsi.
timeout /t 3 /nobreak >nul
if exist "${backupPath}" del "${backupPath}" 2>nul
del "%~f0"
`
      } else if (isInstaller) {
        // MODALITÀ PRODUZIONE: Usa installer NSIS
        const installDir = path.dirname(targetExePath).replace(/\\/g, '\\\\')
        const exePath = targetExePath.replace(/\\/g, '\\\\')
        const installerPath = newExePath.replace(/\\/g, '\\\\')
        batchContent = `@echo off
chcp 65001 >nul
title Aggiornamento Inferno Console
echo.
echo ╔════════════════════════════════════════════╗
echo ║   🔥 Aggiornamento Inferno Console 🔥   ║
echo ╚════════════════════════════════════════════╝
echo.
echo ⏳ Attendi chiusura applicazione...
timeout /t 3 /nobreak >nul
echo ✓ Applicazione chiusa
echo.
echo 📦 Installazione aggiornamento...
if exist "${installerPath}" (
    "${installerPath}" /S /D="${installDir}"
    if %errorlevel% equ 0 (
        echo ✓ Aggiornamento completato
        echo.
        echo 🚀 Riavvio applicazione...
        timeout /t 2 /nobreak >nul
        if exist "${exePath}" (
            start "" "${exePath}"
            echo ✓ Applicazione riavviata
        ) else (
            echo ❌ Applicazione non trovata: ${exePath}
            pause
        )
    ) else (
        echo ❌ Errore durante l'installazione
        pause
    )
) else (
    echo ❌ Installer non trovato: ${installerPath}
    pause
)
timeout /t 2 /nobreak >nul
if exist "${backupPath}" del "${backupPath}" 2>nul
del "%~f0"
`
      } else {
        // Sostituisci EXE direttamente
        batchContent = `@echo off
chcp 65001 >nul
title Aggiornamento Inferno Console
echo.
echo ╔════════════════════════════════════════════╗
echo ║   🔥 Aggiornamento Inferno Console 🔥   ║
echo ╚════════════════════════════════════════════╝
echo.
echo ⏳ Attendi chiusura applicazione...
timeout /t 3 /nobreak >nul
echo ✓ Applicazione chiusa
echo.
echo 📦 Installazione aggiornamento...
copy /y "${newExePath}" "${targetExePath}"
if %errorlevel% neq 0 (
    echo ❌ Errore durante la copia, ripristino backup...
    copy /y "${backupPath}" "${targetExePath}"
    pause
    exit /b 1
)
echo ✓ Aggiornamento completato
echo.
echo 🚀 Riavvio applicazione...
timeout /t 1 /nobreak >nul
start "" "${targetExePath}"
del "${backupPath}" 2>nul
del "%~f0"
`
      }
      
      fs.writeFileSync(batchPath, batchContent)
      console.log('📝 [UPDATER] Batch script creato:', batchPath)
      
      // Esegui batch
      spawn('cmd.exe', ['/c', batchPath], {
        detached: true,
        stdio: 'inherit',
        windowsHide: false
      }).unref()
      
      resolve()
    })
  }

  /**
   * Riavvia l'app direttamente (prima di chiudere)
   */
  async restartAppDirectly(exePath, installDir) {
    return new Promise((resolve) => {
      const isDevMode = exePath.toLowerCase().includes('electron.exe')
      
      console.log('🚀 [UPDATER] Riavvio app direttamente...')
      console.log('📁 [UPDATER] Path:', exePath)
      console.log('📂 [UPDATER] Directory:', installDir)
      console.log('🔧 [UPDATER] Dev mode:', isDevMode)
      
      if (isDevMode) {
        // Dev mode: riavvia electron con il progetto
        const projectDir = process.cwd()
        const electronPath = exePath
        
        console.log('🔄 [UPDATER] Riavvio electron in dev mode...')
        console.log('📂 [UPDATER] Project dir:', projectDir)
        const newProcess = spawn(electronPath, ['.'], {
          detached: true,
          stdio: 'ignore',
          cwd: projectDir,
          env: { ...process.env, UPDATE_TEST_MODE: 'local' }
        })
        newProcess.unref()
        console.log('✅ [UPDATER] Electron riavviato (PID:', newProcess.pid, ')')
      } else {
        // Production: riavvia l'app installata
        console.log('🔄 [UPDATER] Riavvio app in produzione...')
        const newProcess = spawn(exePath, [], {
          detached: true,
          stdio: 'ignore',
          cwd: installDir
        })
        newProcess.unref()
        console.log('✅ [UPDATER] App riavviata (PID:', newProcess.pid, ')')
      }
      
      setTimeout(resolve, 500)
    })
  }

  /**
   * Chiude l'app
   */
  async closeApp() {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(win => {
      if (win !== this.progressWindow) {
        win.close()
      }
    })
    await this.sleep(500)
    if (this.progressWindow) {
      this.progressWindow.close()
    }
    await this.sleep(500)
    app.quit()
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

module.exports = CustomUpdater

