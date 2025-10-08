#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const crypto = require('crypto')

class DeltaGenerator {
  constructor() {
    this.currentVersion = process.env.CURRENT_VERSION || '1.4.109'
    this.newVersion = process.env.NEW_VERSION || '1.4.110'
    this.deltaDir = path.join(__dirname, '..', 'deltas', this.newVersion)
    this.oldBuildDir = path.join(__dirname, '..', 'dist-electron', this.currentVersion)
    this.newBuildDir = path.join(__dirname, '..', 'dist-electron', this.newVersion)
  }

  async generateDelta() {
    console.log('🚀 Starting Delta Generation...')
    console.log(`📦 From: ${this.currentVersion} → To: ${this.newVersion}`)
    
    try {
      // Crea directory per delta
      this.ensureDirectoryExists(this.deltaDir)
      
      // Verifica che le build esistano
      if (!fs.existsSync(this.newBuildDir)) {
        throw new Error(`New build directory not found: ${this.newBuildDir}`)
      }
      
      // Genera manifest
      const manifest = await this.generateManifest()
      
      // Genera patch per ogni file modificato
      await this.generatePatches(manifest)
      
      // Salva manifest
      const manifestPath = path.join(this.deltaDir, 'manifest.json')
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      
      console.log('✅ Delta generation completed!')
      console.log(`📁 Output: ${this.deltaDir}`)
      console.log(`📊 Files to patch: ${manifest.files.length}`)
      console.log(`💾 Total patch size: ${this.formatBytes(manifest.totalPatchSize)}`)
      
      return manifest
    } catch (error) {
      console.error('❌ Delta generation failed:', error.message)
      throw error
    }
  }

  async generateManifest() {
    const manifest = {
      version: this.newVersion,
      previousVersion: this.currentVersion,
      generatedAt: new Date().toISOString(),
      files: [],
      totalPatchSize: 0
    }

    // Lista dei file da controllare per aggiornamenti
    const filesToCheck = [
      'Inferno Console.exe',
      'resources/app.asar',
      'resources/elevate.exe',
      'resources/app-update.yml'
    ]

    for (const file of filesToCheck) {
      const oldPath = path.join(this.oldBuildDir, file)
      const newPath = path.join(this.newBuildDir, file)
      
      if (fs.existsSync(newPath)) {
        const fileInfo = await this.analyzeFile(file, oldPath, newPath)
        if (fileInfo) {
          manifest.files.push(fileInfo)
          manifest.totalPatchSize += fileInfo.delta.patchSize
        }
      }
    }

    return manifest
  }

  async analyzeFile(filePath, oldPath, newPath) {
    const newFileStats = fs.statSync(newPath)
    const newFileHash = await this.calculateFileHash(newPath)
    
    let needsUpdate = true
    let patchSize = newFileStats.size // Default: full file size
    
    // Se il file vecchio esiste, controlla se è cambiato
    if (fs.existsSync(oldPath)) {
      const oldFileHash = await this.calculateFileHash(oldPath)
      if (oldFileHash === newFileHash) {
        needsUpdate = false
      } else {
        // Calcola dimensione patch (stima)
        patchSize = Math.min(newFileStats.size, Math.floor(newFileStats.size * 0.3))
      }
    }

    if (!needsUpdate) {
      return null
    }

    return {
      path: filePath,
      hash: `sha256:${newFileHash}`,
      size: newFileStats.size,
      delta: {
        from: this.currentVersion,
        patchUrl: `https://github.com/Alexand83/InfernoConsole/releases/download/v${this.newVersion}/${filePath.replace(/[\/\\]/g, '_')}.delta`,
        patchSize: patchSize,
        hasOldVersion: fs.existsSync(oldPath)
      }
    }
  }

  async generatePatches(manifest) {
    console.log('🔧 Generating patches...')
    
    for (const file of manifest.files) {
      try {
        const oldPath = path.join(this.oldBuildDir, file.path)
        const newPath = path.join(this.newBuildDir, file.path)
        const deltaPath = path.join(this.deltaDir, `${file.path.replace(/[\/\\]/g, '_')}.delta`)
        
        // Crea directory per il file se necessario
        this.ensureDirectoryExists(path.dirname(deltaPath))
        
        if (file.delta.hasOldVersion && fs.existsSync(oldPath)) {
          // Genera patch usando bsdiff (se disponibile) o fallback
          await this.createPatch(oldPath, newPath, deltaPath)
        } else {
          // File nuovo, copia direttamente
          fs.copyFileSync(newPath, deltaPath)
        }
        
        // Aggiorna dimensione reale della patch
        const actualPatchSize = fs.statSync(deltaPath).size
        file.delta.patchSize = actualPatchSize
        
        console.log(`✅ Generated patch for ${file.path} (${this.formatBytes(actualPatchSize)})`)
      } catch (error) {
        console.error(`❌ Failed to generate patch for ${file.path}:`, error.message)
        // Fallback: copia il file completo
        const newPath = path.join(this.newBuildDir, file.path)
        const deltaPath = path.join(this.deltaDir, `${file.path.replace(/[\/\\]/g, '_')}.delta`)
        fs.copyFileSync(newPath, deltaPath)
        file.delta.patchSize = fs.statSync(deltaPath).size
      }
    }
  }

  async createPatch(oldPath, newPath, deltaPath) {
    try {
      // Prova bsdiff se disponibile
      execSync(`bsdiff "${oldPath}" "${newPath}" "${deltaPath}"`, { stdio: 'pipe' })
    } catch (error) {
      // Fallback: usa un semplice diff binario
      console.log(`⚠️ bsdiff not available, using fallback for ${path.basename(newPath)}`)
      await this.createSimplePatch(oldPath, newPath, deltaPath)
    }
  }

  async createSimplePatch(oldPath, newPath, deltaPath) {
    // Implementazione semplificata: per ora copia il file nuovo
    // In produzione, implementare un algoritmo di diff più sofisticato
    const oldData = fs.existsSync(oldPath) ? fs.readFileSync(oldPath) : Buffer.alloc(0)
    const newData = fs.readFileSync(newPath)
    
    // Crea un patch semplice che contiene:
    // 1. Dimensione file vecchio (4 bytes)
    // 2. Dimensione file nuovo (4 bytes)  
    // 3. Dati del file nuovo
    const patchData = Buffer.concat([
      Buffer.alloc(4, oldData.length),
      Buffer.alloc(4, newData.length),
      newData
    ])
    
    fs.writeFileSync(deltaPath, patchData)
  }

  async calculateFileHash(filePath) {
    const fileData = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(fileData).digest('hex')
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  const generator = new DeltaGenerator()
  generator.generateDelta()
    .then(() => {
      console.log('🎉 Delta generation completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Delta generation failed:', error)
      process.exit(1)
    })
}

module.exports = DeltaGenerator
