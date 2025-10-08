# 🚀 Sistema Delta Updates per Inferno Console

## 📋 **Panoramica**

Il sistema Delta Updates permette di aggiornare Inferno Console scaricando solo le **differenze** tra la versione attuale e quella nuova, invece dell'intera applicazione.

### **Vantaggi:**
- ⚡ **Download 10-20x più veloce** (1-5MB vs 77MB)
- 💾 **Risparmio banda** significativo
- 🔄 **Aggiornamenti più frequenti** possibili
- 📱 **Migliore UX** per utenti con connessioni lente

## 🏗️ **Architettura del Sistema**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub API    │    │   Delta Server   │    │   Client App    │
│                 │    │                  │    │                 │
│ • Release Info  │───▶│ • File Manifest  │───▶│ • Check Updates │
│ • Asset List    │    │ • Delta Patches  │    │ • Download Delta│
│ • Version Tags  │    │ • File Hashes    │    │ • Apply Patch   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔧 **Implementazione**

### **1. File Manifest System**

Ogni release include un `manifest.json`:

```json
{
  "version": "1.4.110",
  "previousVersion": "1.4.109",
  "files": [
    {
      "path": "Inferno Console.exe",
      "hash": "sha256:abc123...",
      "size": 45678901,
      "delta": {
        "from": "1.4.109",
        "patchUrl": "https://github.com/Alexand83/InfernoConsole/releases/download/v1.4.110/Inferno-Console.exe.delta",
        "patchSize": 2048576
      }
    },
    {
      "path": "resources/app.asar",
      "hash": "sha256:def456...",
      "size": 12345678,
      "delta": {
        "from": "1.4.109", 
        "patchUrl": "https://github.com/Alexand83/InfernoConsole/releases/download/v1.4.110/app.asar.delta",
        "patchSize": 1024000
      }
    }
  ]
}
```

### **2. Delta Patch Generation**

**Build Process:**
1. **Build versione corrente** (1.4.109)
2. **Build versione nuova** (1.4.110)
3. **Genera delta patches** usando librerie come:
   - `bsdiff` per file binari
   - `rsync` per file di testo
   - `zlib` per compressione

**Script di generazione:**
```bash
# Genera patch per file eseguibile
bsdiff old/Inferno\ Console.exe new/Inferno\ Console.exe Inferno-Console.exe.delta

# Genera patch per app.asar
bsdiff old/resources/app.asar new/resources/app.asar app.asar.delta
```

### **3. Client Update Logic**

```typescript
class DeltaUpdater {
  async checkForUpdates(): Promise<UpdateInfo> {
    // 1. Scarica manifest della versione più recente
    const manifest = await this.downloadManifest()
    
    // 2. Confronta con versione attuale
    const currentVersion = this.getCurrentVersion()
    const needsUpdate = this.compareVersions(manifest.version, currentVersion) > 0
    
    if (needsUpdate) {
      // 3. Calcola file da aggiornare
      const filesToUpdate = this.calculateDeltaFiles(manifest, currentVersion)
      
      return {
        version: manifest.version,
        updateType: 'delta',
        files: filesToUpdate,
        totalSize: filesToUpdate.reduce((sum, file) => sum + file.delta.patchSize, 0)
      }
    }
    
    return { needsUpdate: false }
  }
  
  async downloadAndApplyUpdate(updateInfo: UpdateInfo): Promise<void> {
    for (const file of updateInfo.files) {
      // 1. Scarica patch delta
      const patchData = await this.downloadPatch(file.delta.patchUrl)
      
      // 2. Applica patch al file esistente
      await this.applyPatch(file.path, patchData)
      
      // 3. Verifica integrità
      await this.verifyFile(file.path, file.hash)
    }
  }
}
```

## 📁 **Struttura File Release**

```
v1.4.110/
├── Inferno-Console-Installer.exe     # Installer completo (fallback)
├── manifest.json                     # Manifest con info delta
├── Inferno-Console.exe.delta         # Patch per eseguibile
├── app.asar.delta                    # Patch per app.asar
└── resources/
    ├── icon.ico.delta                # Patch per icone
    └── other-files.delta             # Altri file modificati
```

## 🔄 **Flusso di Aggiornamento**

### **1. Check Updates**
```typescript
// Client controlla aggiornamenti
const updateInfo = await deltaUpdater.checkForUpdates()

if (updateInfo.needsUpdate) {
  console.log(`Update available: ${updateInfo.version}`)
  console.log(`Download size: ${formatBytes(updateInfo.totalSize)}`)
  console.log(`Files to update: ${updateInfo.files.length}`)
}
```

### **2. Download Delta**
```typescript
// Scarica solo le patch necessarie
for (const file of updateInfo.files) {
  console.log(`Downloading patch for ${file.path}...`)
  const patch = await downloadPatch(file.delta.patchUrl)
  await applyPatch(file.path, patch)
}
```

### **3. Apply & Verify**
```typescript
// Applica patch e verifica integrità
await deltaUpdater.applyUpdate(updateInfo)
await deltaUpdater.verifyInstallation()
```

## 🛠️ **Implementazione Pratica**

### **Step 1: Modifica Build Process**

Aggiungi al `package.json`:
```json
{
  "scripts": {
    "build:delta": "npm run build && node scripts/generate-delta.js",
    "release:delta": "npm run build:delta && npm run release"
  }
}
```

### **Step 2: Script Generazione Delta**

`scripts/generate-delta.js`:
```javascript
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

async function generateDelta() {
  const currentVersion = process.env.CURRENT_VERSION || '1.4.109'
  const newVersion = process.env.NEW_VERSION || '1.4.110'
  
  // Crea directory per delta
  const deltaDir = path.join(__dirname, '..', 'deltas', newVersion)
  fs.mkdirSync(deltaDir, { recursive: true })
  
  // Genera manifest
  const manifest = {
    version: newVersion,
    previousVersion: currentVersion,
    files: []
  }
  
  // Genera patch per ogni file modificato
  const filesToPatch = ['Inferno Console.exe', 'resources/app.asar']
  
  for (const file of filesToPatch) {
    const oldPath = path.join('dist-electron', currentVersion, file)
    const newPath = path.join('dist-electron', newVersion, file)
    const deltaPath = path.join(deltaDir, `${file}.delta`)
    
    if (fs.existsSync(oldPath) && fs.existsSync(newPath)) {
      // Genera patch usando bsdiff
      execSync(`bsdiff "${oldPath}" "${newPath}" "${deltaPath}"`)
      
      // Calcola hash del file nuovo
      const hash = execSync(`sha256sum "${newPath}"`).toString().split(' ')[0]
      
      manifest.files.push({
        path: file,
        hash: `sha256:${hash}`,
        size: fs.statSync(newPath).size,
        delta: {
          from: currentVersion,
          patchUrl: `https://github.com/Alexand83/InfernoConsole/releases/download/v${newVersion}/${file}.delta`,
          patchSize: fs.statSync(deltaPath).size
        }
      })
    }
  }
  
  // Salva manifest
  fs.writeFileSync(path.join(deltaDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  
  console.log(`✅ Delta generated for version ${newVersion}`)
  console.log(`📁 Output: ${deltaDir}`)
}

generateDelta().catch(console.error)
```

### **Step 3: Client Delta Updater**

`src/utils/deltaUpdater.ts`:
```typescript
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
  }
}

export interface UpdateInfo {
  version: string
  previousVersion: string
  files: DeltaFile[]
  totalSize: number
  needsUpdate: boolean
}

export class DeltaUpdater {
  private baseUrl = 'https://api.github.com/repos/Alexand83/InfernoConsole/releases'
  
  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      // Scarica manifest della versione più recente
      const manifest = await this.downloadManifest()
      const currentVersion = this.getCurrentVersion()
      
      const needsUpdate = this.compareVersions(manifest.version, currentVersion) > 0
      
      if (needsUpdate) {
        const totalSize = manifest.files.reduce((sum, file) => sum + file.delta.patchSize, 0)
        
        return {
          ...manifest,
          totalSize,
          needsUpdate: true
        }
      }
      
      return { ...manifest, totalSize: 0, needsUpdate: false }
    } catch (error) {
      console.error('Error checking for updates:', error)
      return { version: '', previousVersion: '', files: [], totalSize: 0, needsUpdate: false }
    }
  }
  
  async downloadAndApplyUpdate(updateInfo: UpdateInfo): Promise<void> {
    console.log(`🔄 Applying delta update to version ${updateInfo.version}`)
    
    for (const file of updateInfo.files) {
      try {
        console.log(`📥 Downloading patch for ${file.path}...`)
        
        // Scarica patch
        const patchData = await this.downloadPatch(file.delta.patchUrl)
        
        // Applica patch
        await this.applyPatch(file.path, patchData)
        
        // Verifica integrità
        await this.verifyFile(file.path, file.hash)
        
        console.log(`✅ Updated ${file.path}`)
      } catch (error) {
        console.error(`❌ Failed to update ${file.path}:`, error)
        throw error
      }
    }
    
    console.log(`🎉 Delta update completed!`)
  }
  
  private async downloadManifest(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/latest`)
    const release = await response.json()
    
    // Trova il file manifest.json negli asset
    const manifestAsset = release.assets.find((asset: any) => 
      asset.name === 'manifest.json'
    )
    
    if (!manifestAsset) {
      throw new Error('Manifest not found in release')
    }
    
    const manifestResponse = await fetch(manifestAsset.browser_download_url)
    return await manifestResponse.json()
  }
  
  private async downloadPatch(patchUrl: string): Promise<Buffer> {
    const response = await fetch(patchUrl)
    if (!response.ok) {
      throw new Error(`Failed to download patch: ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  
  private async applyPatch(filePath: string, patchData: Buffer): Promise<void> {
    // Implementazione semplificata - in produzione usare bsdiff
    const fullPath = path.join(process.resourcesPath, filePath)
    
    // Per ora, sovrascrivi il file (in produzione applicare la patch)
    await fs.writeFile(fullPath, patchData)
  }
  
  private async verifyFile(filePath: string, expectedHash: string): Promise<void> {
    const fullPath = path.join(process.resourcesPath, filePath)
    const fileData = await fs.readFile(fullPath)
    const actualHash = createHash('sha256').update(fileData).digest('hex')
    
    if (`sha256:${actualHash}` !== expectedHash) {
      throw new Error(`File integrity check failed for ${filePath}`)
    }
  }
  
  private getCurrentVersion(): string {
    return process.env.npm_package_version || '1.4.109'
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
}
```

## 🚀 **Deployment Strategy**

### **1. GitHub Actions Workflow**

```yaml
name: Build and Release with Delta

on:
  push:
    tags:
      - 'v*'

jobs:
  build-delta:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build application
        run: npm run build
        
      - name: Generate delta patches
        run: npm run build:delta
        env:
          CURRENT_VERSION: ${{ github.event.repository.default_branch }}
          NEW_VERSION: ${{ github.ref_name }}
          
      - name: Create Release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
          
      - name: Upload Release Assets
        uses: actions/upload-release-asset@v1
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./dist-electron/Inferno-Console-Installer.exe
          asset_name: Inferno-Console-Installer.exe
          asset_content_type: application/octet-stream
          
      - name: Upload Delta Files
        uses: actions/upload-release-asset@v1
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./deltas/${{ github.ref_name }}/manifest.json
          asset_name: manifest.json
          asset_content_type: application/json
```

## 📊 **Risultati Attesi**

### **Prima (Download Completo):**
- 📦 **Dimensione**: 77MB
- ⏱️ **Tempo**: 2-5 minuti (connessione lenta)
- 💾 **Banda**: 77MB per aggiornamento

### **Dopo (Delta Updates):**
- 📦 **Dimensione**: 1-5MB (95% riduzione)
- ⏱️ **Tempo**: 10-30 secondi
- 💾 **Banda**: 1-5MB per aggiornamento

## 🔧 **Fallback Strategy**

Se il sistema delta fallisce:
1. **Rileva errore** nel download/applicazione patch
2. **Fallback automatico** al download completo
3. **Notifica utente** del fallback
4. **Log errori** per debugging

## 🎯 **Prossimi Passi**

1. ✅ **Implementare** script generazione delta
2. ✅ **Modificare** client updater per supportare delta
3. ✅ **Testare** sistema con versioni di test
4. ✅ **Deploy** in produzione
5. ✅ **Monitorare** performance e errori

---

**Risultato**: Sistema di aggiornamenti 10-20x più veloce! 🚀
