import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

export interface DeltaFile {
  path: string
  hash: string
  size: number
  delta: {
    from: string
    patchUrl: string
    patchSize: number
    hasOldVersion: boolean
  }
}

export interface UpdateManifest {
  version: string
  previousVersion: string
  generatedAt: string
  files: DeltaFile[]
  totalPatchSize: number
}

export interface UpdateInfo {
  version: string
  previousVersion: string
  files: DeltaFile[]
  totalSize: number
  needsUpdate: boolean
  updateType: 'delta' | 'full'
}

export class DeltaUpdater {
  private baseUrl = 'https://api.github.com/repos/Alexand83/InfernoConsole/releases'
  private updateDir: string
  private installDir: string

  constructor() {
    // Determina le directory di installazione e aggiornamento
    this.installDir = this.getInstallDirectory()
    this.updateDir = path.join(this.installDir, 'Updates')
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      console.log('🔍 Checking for delta updates...')
      
      // Scarica manifest della versione più recente
      const manifest = await this.downloadManifest()
      const currentVersion = this.getCurrentVersion()
      
      console.log(`📊 Current: ${currentVersion}, Latest: ${manifest.version}`)
      
      const needsUpdate = this.compareVersions(manifest.version, currentVersion) > 0
      
      if (needsUpdate) {
        // Filtra solo i file che hanno effettivamente bisogno di aggiornamento
        const filesToUpdate = await this.filterFilesToUpdate(manifest.files)
        const totalSize = filesToUpdate.reduce((sum, file) => sum + file.delta.patchSize, 0)
        
        console.log(`📦 Update available: ${filesToUpdate.length} files, ${this.formatBytes(totalSize)}`)
        
        return {
          version: manifest.version,
          previousVersion: manifest.previousVersion,
          files: filesToUpdate,
          totalSize,
          needsUpdate: true,
          updateType: totalSize < 10 * 1024 * 1024 ? 'delta' : 'full' // Se < 10MB, usa delta
        }
      }
      
      return { 
        version: manifest.version, 
        previousVersion: manifest.previousVersion,
        files: [], 
        totalSize: 0, 
        needsUpdate: false,
        updateType: 'delta'
      }
    } catch (error) {
      console.error('❌ Error checking for updates:', error)
      return { 
        version: '', 
        previousVersion: '', 
        files: [], 
        totalSize: 0, 
        needsUpdate: false,
        updateType: 'delta'
      }
    }
  }

  async downloadAndApplyUpdate(updateInfo: UpdateInfo): Promise<void> {
    if (!updateInfo.needsUpdate) {
      console.log('✅ No updates needed')
      return
    }

    console.log(`🔄 Applying ${updateInfo.updateType} update to version ${updateInfo.version}`)
    console.log(`📊 Files to update: ${updateInfo.files.length}`)
    console.log(`💾 Total size: ${this.formatBytes(updateInfo.totalSize)}`)

    try {
      // Crea directory di aggiornamento se non esiste
      await this.ensureDirectoryExists(this.updateDir)

      // Scarica e applica ogni patch
      for (const file of updateInfo.files) {
        try {
          console.log(`📥 Processing ${file.path}...`)
          
          // Scarica patch
          const patchData = await this.downloadPatch(file.delta.patchUrl)
          
          // Applica patch
          await this.applyPatch(file.path, patchData, file)
          
          // Verifica integrità
          await this.verifyFile(file.path, file.hash)
          
          console.log(`✅ Updated ${file.path}`)
        } catch (error) {
          console.error(`❌ Failed to update ${file.path}:`, error)
          
          // Fallback: scarica il file completo
          await this.downloadFullFile(file)
        }
      }
      
      console.log(`🎉 ${updateInfo.updateType} update completed!`)
      
      // Salva info sull'aggiornamento
      await this.saveUpdateInfo(updateInfo)
      
    } catch (error) {
      console.error('💥 Update failed:', error)
      throw error
    }
  }

  private async downloadManifest(): Promise<UpdateManifest> {
    try {
      const response = await fetch(`${this.baseUrl}/latest`)
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }
      
      const release = await response.json()
      console.log(`📋 Found release: ${release.tag_name}`)
      
      // Trova il file manifest.json negli asset
      const manifestAsset = release.assets.find((asset: any) => 
        asset.name === 'manifest.json'
      )
      
      if (!manifestAsset) {
        throw new Error('Manifest not found in release')
      }
      
      console.log(`📥 Downloading manifest from: ${manifestAsset.browser_download_url}`)
      const manifestResponse = await fetch(manifestAsset.browser_download_url)
      
      if (!manifestResponse.ok) {
        throw new Error(`Failed to download manifest: ${manifestResponse.status}`)
      }
      
      const manifest = await manifestResponse.json()
      console.log(`📊 Manifest loaded: ${manifest.files.length} files`)
      
      return manifest
    } catch (error) {
      console.error('❌ Failed to download manifest:', error)
      throw error
    }
  }

  private async downloadPatch(patchUrl: string): Promise<Buffer> {
    console.log(`📥 Downloading patch: ${patchUrl}`)
    
    const response = await fetch(patchUrl)
    if (!response.ok) {
      throw new Error(`Failed to download patch: ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  private async applyPatch(filePath: string, patchData: Buffer, fileInfo: DeltaFile): Promise<void> {
    const targetPath = path.join(this.installDir, filePath)
    const backupPath = path.join(this.updateDir, `${filePath}.backup`)
    
    try {
      // Crea backup del file esistente
      if (await this.fileExists(targetPath)) {
        await fs.copyFile(targetPath, backupPath)
      }
      
      // Crea directory se non esiste
      await this.ensureDirectoryExists(path.dirname(targetPath))
      
      if (fileInfo.delta.hasOldVersion) {
        // Applica patch
        await this.applyDeltaPatch(targetPath, patchData)
      } else {
        // File nuovo, scrivi direttamente
        await fs.writeFile(targetPath, patchData)
      }
      
    } catch (error) {
      // Ripristina backup se l'applicazione della patch fallisce
      if (await this.fileExists(backupPath)) {
        await fs.copyFile(backupPath, targetPath)
      }
      throw error
    }
  }

  private async applyDeltaPatch(targetPath: string, patchData: Buffer): Promise<void> {
    try {
      // Implementazione semplificata del patch
      // In produzione, usare bsdiff o librerie simili
      
      if (patchData.length < 8) {
        throw new Error('Invalid patch data')
      }
      
      // Leggi header del patch (dimensione file vecchio + nuovo)
      const oldSize = patchData.readUInt32LE(0)
      const newSize = patchData.readUInt32LE(4)
      const newData = patchData.slice(8)
      
      if (newData.length !== newSize) {
        throw new Error('Patch data size mismatch')
      }
      
      // Scrivi il nuovo file
      await fs.writeFile(targetPath, newData)
      
    } catch (error) {
      console.error('❌ Failed to apply delta patch:', error)
      throw error
    }
  }

  private async downloadFullFile(fileInfo: DeltaFile): Promise<void> {
    console.log(`🔄 Fallback: downloading full file for ${fileInfo.path}`)
    
    // Scarica il file completo dalla release
    const response = await fetch(`${this.baseUrl}/latest`)
    const release = await response.json()
    
    const asset = release.assets.find((a: any) => 
      a.name.includes('Inferno-Console') && a.name.endsWith('.exe')
    )
    
    if (asset) {
      const fullResponse = await fetch(asset.browser_download_url)
      const fullData = await fullResponse.arrayBuffer()
      
      const targetPath = path.join(this.installDir, fileInfo.path)
      await fs.writeFile(targetPath, Buffer.from(fullData))
    }
  }

  private async verifyFile(filePath: string, expectedHash: string): Promise<void> {
    const fullPath = path.join(this.installDir, filePath)
    
    if (!await this.fileExists(fullPath)) {
      throw new Error(`File not found: ${filePath}`)
    }
    
    const fileData = await fs.readFile(fullPath)
    const actualHash = createHash('sha256').update(fileData).digest('hex')
    const expectedHashClean = expectedHash.replace('sha256:', '')
    
    if (actualHash !== expectedHashClean) {
      throw new Error(`File integrity check failed for ${filePath}`)
    }
    
    console.log(`✅ File integrity verified: ${filePath}`)
  }

  private async filterFilesToUpdate(files: DeltaFile[]): Promise<DeltaFile[]> {
    const filesToUpdate: DeltaFile[] = []
    
    for (const file of files) {
      const filePath = path.join(this.installDir, file.path)
      
      if (!await this.fileExists(filePath)) {
        // File nuovo, deve essere scaricato
        filesToUpdate.push(file)
        continue
      }
      
      // Verifica se il file è cambiato
      const currentHash = await this.calculateFileHash(filePath)
      const expectedHash = file.hash.replace('sha256:', '')
      
      if (currentHash !== expectedHash) {
        filesToUpdate.push(file)
      }
    }
    
    return filesToUpdate
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    const fileData = await fs.readFile(filePath)
    return createHash('sha256').update(fileData).digest('hex')
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      // Directory potrebbe già esistere
    }
  }

  private async saveUpdateInfo(updateInfo: UpdateInfo): Promise<void> {
    const updateInfoPath = path.join(this.updateDir, 'last-update.json')
    const updateInfoData = {
      ...updateInfo,
      appliedAt: new Date().toISOString()
    }
    
    await fs.writeFile(updateInfoPath, JSON.stringify(updateInfoData, null, 2))
  }

  private getCurrentVersion(): string {
    // Prova a leggere la versione dal package.json o da file di versione
    try {
      const packageJson = require('../../package.json')
      return packageJson.version || '1.4.109'
    } catch {
      return '1.4.109'
    }
  }

  private getInstallDirectory(): string {
    // Determina la directory di installazione
    // Prova prima il registro, poi percorsi di default
    
    try {
      // Leggi dal registro se disponibile
      const { execSync } = require('child_process')
      const result = execSync('reg query HKCU\\Software\\InfernoConsole /v InstallPath', { encoding: 'utf8' })
      const match = result.match(/InstallPath\s+REG_SZ\s+(.*)/i)
      if (match && match[1]) {
        return match[1].trim()
      }
    } catch {
      // Fallback ai percorsi di default
    }
    
    // Percorsi di fallback
    const os = require('os')
    const possiblePaths = [
      path.join(os.homedir(), 'Documents', 'Inferno Console'),
      path.join(os.homedir(), 'Desktop', 'Inferno Console'),
      path.join(os.homedir(), 'AppData', 'Local', 'Inferno Console')
    ]
    
    for (const possiblePath of possiblePaths) {
      try {
        if (fs.existsSync(possiblePath)) {
          return possiblePath
        }
      } catch {
        continue
      }
    }
    
    // Ultimo fallback
    return path.join(os.homedir(), 'Documents', 'Inferno Console')
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0
      
      if (v1Part > v2Part) return 1
      if (v1Part < v2Part) return -1
    }
    
    return 0
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Metodo pubblico per resettare la cache
  async resetCache(): Promise<void> {
    try {
      if (await this.fileExists(this.updateDir)) {
        await fs.rm(this.updateDir, { recursive: true, force: true })
        console.log('✅ Update cache cleared')
      }
    } catch (error) {
      console.error('❌ Failed to clear update cache:', error)
    }
  }

  // Metodo pubblico per ottenere info sull'ultimo aggiornamento
  async getLastUpdateInfo(): Promise<any> {
    try {
      const updateInfoPath = path.join(this.updateDir, 'last-update.json')
      if (await this.fileExists(updateInfoPath)) {
        const data = await fs.readFile(updateInfoPath, 'utf8')
        return JSON.parse(data)
      }
    } catch (error) {
      console.error('❌ Failed to read last update info:', error)
    }
    return null
  }
}

export default DeltaUpdater
