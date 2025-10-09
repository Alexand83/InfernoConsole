const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const installerDir = __dirname;
const outputDir = path.join(installerDir, '..', 'dist-electron');
const mainFile = 'main-gui-simple.js';
const outputExe = 'Inferno-Console-Installer.exe';

console.log('\n🔨 BUILDING CUSTOM INSTALLER FOR GITHUB RELEASE\n');

// 1. Clean previous builds (but preserve portable executable)
console.log('🧹 Cleaning previous builds...');
if (fs.existsSync(outputDir)) {
    // Check if portable executable exists
    const portableExePath = path.join(outputDir, 'Inferno-Console-win.exe');
    if (fs.existsSync(portableExePath)) {
        console.log('💾 Portable executable found, skipping clean to preserve it');
        // Only clean installer-specific files
        const installerFiles = ['Inferno-Console-Installer.exe', 'Inferno-Console-Uninstaller.exe', 'latest.yml', 'package.json', 'README.md', 'release-info.json'];
        installerFiles.forEach(file => {
            const filePath = path.join(outputDir, file);
            if (fs.existsSync(filePath)) {
                fs.removeSync(filePath);
            }
        });
        // Clean installer directory if it exists
        const installerDirPath = path.join(outputDir, 'installer');
        if (fs.existsSync(installerDirPath)) {
            fs.removeSync(installerDirPath);
        }
    } else {
        // No portable executable, safe to clean everything
        fs.removeSync(outputDir);
        fs.mkdirpSync(outputDir);
    }
} else {
    fs.mkdirpSync(outputDir);
}
console.log('✅ Clean completed');

// 2. Create installer executable using electron-builder
console.log('🔨 Creating installer executable...');

// Create a simple Electron app for the installer
const installerMain = `const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { spawn } = require('child_process');

class InstallerApp {
    constructor() {
        this.mainWindow = null;
        this.installPath = '';
        this.isInstalling = false;
    }

    sendProgress(message, percentage, isComplete = false, isError = false) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('installation-progress', {
                message: message,
                percentage: percentage,
                isComplete: isComplete,
                isError: isError
            });
        }
    }

    async performInstallation() {
        if (this.isInstalling) {
            throw new Error('Installation already in progress');
        }

        this.isInstalling = true;
        
        try {
            // Send progress to GUI
            this.sendProgress('Installing...', 0);

            // 0. Verify target path is writable
            this.sendProgress('Verifica permessi cartella...', 5);
            await this.verifyWritable(this.installPath);

            // 1. Create installation directory
            this.sendProgress('Creazione directory di installazione...', 10);
            await this.ensureDir(this.installPath);
            this.sendProgress('Directory creata con successo!', 20);

            // 1.1 Immediately write install path to registry (early write)
            await this.writeInstallPathToRegistry();

            // 2. Download application
            this.sendProgress('Preparazione download...', 30);
            this.sendProgress('[DL] Inizio download applicazione...', 30);
            const downloadPath = await this.downloadAppWithProgress();
            this.sendProgress('[DL] Download completato con successo!', 50);

            // 2.5. Download uninstaller
            this.sendProgress('[DL] Inizio download uninstaller...', 55);
            const uninstallerPath = await this.downloadUninstallerWithProgress();
            this.sendProgress('[DL] Download uninstaller completato!', 60);

            // 3. Install application
            this.sendProgress('Installazione applicazione...', 70);
            await this.installApp(downloadPath);
            this.sendProgress('Applicazione installata!', 85);

            // 4. Create shortcuts
            this.sendProgress('Creazione shortcut...', 85);
            await this.createShortcuts(this.createShortcutEnabled);
            this.sendProgress('Shortcut creati!', 90);

            // 5. Create uninstaller
            this.sendProgress('Creazione uninstaller...', 90);
            await this.createUninstaller();
            this.sendProgress('Uninstaller creato!', 95);

            // 6. Create installer marker
            this.sendProgress('Creazione marker installer...', 95);
            await this.createInstallerMarker();
            this.sendProgress('✅ Installazione completata al 100%!', 100);

            // Write install path to registry for uninstaller (final confirm)
            await this.writeInstallPathToRegistry();

            // Clean up temp file (the corrupted one)
            const tempFileToDelete = path.join(this.installPath, 'Inferno-Console-temp.exe');
            if (fs.existsSync(tempFileToDelete)) {
                try {
                    fs.unlinkSync(tempFileToDelete);
                    this.sendProgress('🧹 File temporaneo rimosso', 95);
                } catch (error) {
                    this.sendProgress('⚠️ Impossibile rimuovere file temporaneo', 95);
                }
            }

            // 7. Installation completed
            this.sendProgress('Installazione completata!', 100);

            // 8. Installation completed

            this.sendProgress('Installazione completata con successo!', 100, true);

            return { 
                success: true, 
                installPath: this.installPath,
                executablePath: path.join(this.installPath, 'Inferno Console.exe')
            };

        } catch (error) {
            this.sendProgress(\`Error: \${error.message}\`, 0, false, true);
            throw error;
        } finally {
            this.isInstalling = false;
        }
    }

    async verifyWritable(targetDir) {
        return new Promise((resolve, reject) => {
            try {
                const probeDir = fs.existsSync(targetDir) ? targetDir : path.dirname(targetDir);
                const testFile = path.join(probeDir, '.write-test-' + Date.now() + '.tmp');
                fs.writeFile(testFile, 'test', (err) => {
                    if (err) {
                        // Check if it's Program Files or similar system directory
                        const isSystemDir = targetDir.toLowerCase().includes('program files') || 
                                          targetDir.toLowerCase().includes('programdata') ||
                                          targetDir.toLowerCase().includes('windows');
                        
                        if (isSystemDir) {
                            this.sendProgress('⚠️ Per installare in questa cartella servono i permessi di amministratore', 5, false, false);
                            this.sendProgress('💡 Suggerimento: Esegui l\\'installer come amministratore o scegli una cartella diversa', 5, false, false);
                            reject(new Error('REQUIRES_ADMIN'));
                        } else {
                            this.sendProgress('❌ Permessi insufficienti sulla cartella selezionata', 5, false, true);
                            reject(new Error('Permessi insufficienti sulla cartella scelta. Prova una cartella diversa.'));
                        }
                    } else {
                        fs.unlink(testFile, () => resolve());
                    }
                });
            } catch (e) {
                this.sendProgress('❌ Impossibile verificare i permessi sulla cartella selezionata', 5, false, true);
                reject(new Error('Impossibile verificare i permessi sulla cartella selezionata'));
            }
        });
    }

    async ensureDir(dirPath) {
        return new Promise((resolve, reject) => {
            fs.mkdir(dirPath, { recursive: true }, (err) => {
                if (err && err.code !== 'EEXIST') {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async downloadAppWithProgress() {
        const outputPath = path.join(this.installPath, 'Inferno-Console-win.exe');
        this.sendProgress(\`[DL] Percorso download: \${outputPath}\`, 30);

        const getJson = (url) => new Promise((resolve, reject) => {
            console.log('[DL][API] GET', url);
            this.sendProgress('[DL][API] Connessione a GitHub API...', 30);
            const req = https.request(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'inferno-console-installer',
                    'Accept': 'application/vnd.github+json'
                }
            }, (res) => {
                console.log('[DL][API] Status:', res.statusCode, 'CT:', res.headers['content-type']);
                this.sendProgress(\`[DL][API] Status: \${res.statusCode}, Content-Type: \${res.headers['content-type']}\`, 30);
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(JSON.parse(data));
                        } else {
                            const msg = \`GitHub API HTTP \${res.statusCode}: \${res.statusMessage}\`;
                            this.sendProgress(msg, 30, false, true);
                            reject(new Error(msg));
                        }
                    } catch (e) { 
                        this.sendProgress('Errore parsing risposta API GitHub', 30, false, true);
                        reject(e); 
                    }
                });
            });
            req.on('error', (err) => { 
                console.error('[DL][API] Error:', err.message); 
                this.sendProgress(\`Errore API GitHub: \${err.message}\`, 30, false, true);
                reject(err); 
            });
            req.end();
        });

        const resolveAssetUrl = async () => {
            const apiUrl = 'https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest';
            const release = await getJson(apiUrl);
            this.sendProgress(\`[DL] Release trovata: \${release.tag_name}\`, 31);
            
            if (release && Array.isArray(release.assets)) {
                this.sendProgress(\`[DL] Assets disponibili: \${release.assets.length}\`, 31);
                release.assets.forEach(asset => {
                    this.sendProgress(\`[DL] - \${asset.name} (\${asset.size} bytes)\`, 31);
                });
                
                const asset = release.assets.find(a => a && a.name && a.name.toLowerCase().includes('inferno-console-win.exe'));
                if (asset && asset.browser_download_url) {
                    console.log('[DL] Resolved asset URL:', asset.browser_download_url);
                    this.sendProgress(\`[DL] URL release risolta: \${asset.browser_download_url}\`, 31);
                    return asset.browser_download_url;
                } else {
                    this.sendProgress('[DL] Asset inferno-console-win.exe non trovato negli assets', 31);
                }
            } else {
                this.sendProgress('[DL] Nessun asset trovato nella release', 31);
            }
            
            console.warn('[DL] Asset non trovato via API, uso fallback latest/download');
            this.sendProgress('[DL] Asset non trovato via API, uso URL fallback', 31);
            return 'https://github.com/Alexand83/InfernoConsole/releases/latest/download/Inferno-Console-win.exe';
        };

        const download = (url) => new Promise((resolve, reject) => {
            console.log('[DL] Download URL:', url);
            this.sendProgress(\`[DL] Download URL: \${url}\`, 32);
            const file = fs.createWriteStream(outputPath);
            const request = https.get(url, { headers: { 'User-Agent': 'inferno-console-installer', 'Accept': 'application/octet-stream' } }, (response) => {
                console.log('[DL] Status:', response.statusCode, 'CT:', response.headers['content-type'], 'CL:', response.headers['content-length']);
                this.sendProgress(\`[DL] Status: \${response.statusCode}, Content-Type: \${response.headers['content-type']}, Content-Length: \${response.headers['content-length']}\`, 33);
                
                if ([301,302,307,308].includes(response.statusCode)) {
                    const redirectUrl = response.headers.location;
                    console.log('[DL] Redirect ->', redirectUrl);
                    this.sendProgress(\`[DL] Redirecting to: \${redirectUrl}\`, 34);
                    if (redirectUrl) {
                        this.sendProgress('Redirect download...', 35);
                        response.destroy();
                        resolve(download(redirectUrl));
                        return;
                    } else {
                        this.sendProgress('Redirect senza location', 35, false, true);
                        reject(new Error('Redirect senza location'));
                        return;
                    }
                }

                const contentType = (response.headers['content-type'] || '').toLowerCase();
                if (contentType.includes('text/html')) {
                    console.error('[DL] Unexpected HTML response');
                    this.sendProgress('[DL] Risposta HTML inattesa dal server (asset non trovato?)', 40, false, true);
                    reject(new Error('Risposta non valida (HTML) dal server.')); 
                    return;
                }

                if (response.statusCode !== 200) {
                    console.error('[DL] HTTP error:', response.statusCode, response.statusMessage);
                    this.sendProgress(\`[DL] HTTP error: \${response.statusCode} \${response.statusMessage}\`, 40, false, true);
                    reject(new Error(\`HTTP \${response.statusCode}: \${response.statusMessage}\`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize > 0) {
                        const percent = Math.round((downloadedSize / totalSize) * 100);
                        const progress = Math.round(30 + (downloadedSize / totalSize) * 30);
                        if (percent % 5 === 0) console.log('[DL] Progress:', percent + '%');
                        this.sendProgress(\`Scaricamento in corso... \${percent}%\`, progress);
                    } else {
                        this.sendProgress('Scaricamento in corso...', 45);
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    try {
                        const stats = fs.statSync(outputPath);
                        console.log('[DL] File size:', stats.size);
                        this.sendProgress(\`[DL] File scaricato: \${stats.size} bytes\`, 55);
                        if (!stats || stats.size < 1024 * 1024) {
                            this.sendProgress('[DL] File scaricato troppo piccolo (<1MB)', 55, false, true);
                            fs.unlinkSync(outputPath);
                            return reject(new Error('Download incompleto o file troppo piccolo'));
                        }
                        this.sendProgress('[DL] Download completato con successo!', 60);
                    } catch (e) {
                        this.sendProgress('[DL] Impossibile validare il file scaricato', 55, false, true);
                        return reject(new Error('Impossibile validare il file scaricato'));
                    }
                    resolve(outputPath);
                });

                file.on('error', (err) => {
                    console.error('[DL] File stream error:', err.message);
                    this.sendProgress(\`[DL] Errore scrittura file: \${err.message}\`, 50, false, true);
                    fs.unlink(outputPath, () => {});
                    reject(err);
                });
            });
            request.on('error', (err) => { 
                console.error('[DL] Request error:', err.message); 
                this.sendProgress(\`[DL] Errore richiesta download: \${err.message}\`, 35, false, true);
                reject(err); 
            });
        });

        try {
            const assetUrl = await resolveAssetUrl();
            this.sendProgress('[DL] Connessione a GitHub Releases...', 32);
            const downloadedPath = await download(assetUrl);
            this.sendProgress(\`[DL] Download completato: \${downloadedPath}\`, 60);
            
            // Verify the downloaded file exists
            if (!fs.existsSync(downloadedPath)) {
                throw new Error(\`File scaricato non trovato: \${downloadedPath}\`);
            }
            
            const stats = fs.statSync(downloadedPath);
            this.sendProgress(\`[DL] File verificato: \${stats.size} bytes\`, 60);
            
            return downloadedPath;
        } catch (e) {
            console.warn('[DL] Primary URL failed:', e.message);
            this.sendProgress(\`[DL] Errore URL principale: \${e.message}\`, 33, false, true);
            const fallback = 'https://github.com/Alexand83/InfernoConsole/releases/latest/download/Inferno-Console-win.exe';
            this.sendProgress('[DL] Tentativo con URL fallback...', 33);
            const downloadedPath = await download(fallback);
            
            // Verify the fallback download
            if (!fs.existsSync(downloadedPath)) {
                throw new Error(\`File fallback non trovato: \${downloadedPath}\`);
            }
            
            return downloadedPath;
        }
    }

    async downloadUninstallerWithProgress() {
        const outputPath = path.join(this.installPath, 'Inferno-Console-Uninstaller.exe');
        this.sendProgress('[DL] Percorso uninstaller: ' + outputPath, 55);

        const getJson = (url) => new Promise((resolve, reject) => {
            console.log('[DL][UNINSTALLER] GET', url);
            this.sendProgress('[DL][UNINSTALLER] Connessione a GitHub API...', 55);
            const req = https.request(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'inferno-console-installer',
                    'Accept': 'application/vnd.github+json'
                }
            }, (res) => {
                console.log('[DL][UNINSTALLER] Status:', res.statusCode);
                this.sendProgress('[DL][UNINSTALLER] Status: ' + res.statusCode, 55);
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(JSON.parse(data));
                        } else {
                            const msg = 'GitHub API HTTP ' + res.statusCode + ': ' + res.statusMessage;
                            this.sendProgress(msg, 55, false, true);
                            reject(new Error(msg));
                        }
                    } catch (e) { 
                        this.sendProgress('Errore parsing risposta API GitHub per uninstaller', 55, false, true);
                        reject(e); 
                    }
                });
            });
            req.on('error', (err) => { 
                console.error('[DL][UNINSTALLER] Error:', err.message); 
                this.sendProgress('Errore API GitHub uninstaller: ' + err.message, 55, false, true);
                reject(err); 
            });
            req.end();
        });

        const resolveUninstallerUrl = async () => {
            const apiUrl = 'https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest';
            const release = await getJson(apiUrl);
            this.sendProgress('[DL][UNINSTALLER] Release trovata: ' + release.tag_name, 56);
            
            if (release && Array.isArray(release.assets)) {
                this.sendProgress('[DL][UNINSTALLER] Assets disponibili: ' + release.assets.length, 56);
                
                // Look for uninstaller asset
                const uninstallerAsset = release.assets.find(asset => 
                    asset.name === 'Inferno-Console-Uninstaller.exe'
                );
                
                if (uninstallerAsset) {
                    this.sendProgress('[DL][UNINSTALLER] Uninstaller trovato: ' + uninstallerAsset.name, 57);
                    return uninstallerAsset.browser_download_url;
                } else {
                    this.sendProgress('❌ [DL][UNINSTALLER] Uninstaller non trovato negli asset!', 57, false, true);
                    throw new Error('Uninstaller non trovato negli asset della release');
                }
            } else {
                this.sendProgress('❌ [DL][UNINSTALLER] Nessun asset trovato nella release!', 57, false, true);
                throw new Error('Nessun asset trovato nella release');
            }
        };

        const downloadUninstaller = (url, outputPath) => new Promise((resolve, reject) => {
            console.log('[DL][UNINSTALLER] Download URL:', url);
            this.sendProgress('[DL][UNINSTALLER] Download da: ' + url, 58);
            const file = fs.createWriteStream(outputPath);
            const request = https.get(url, { 
                headers: { 
                    'User-Agent': 'inferno-console-installer', 
                    'Accept': 'application/octet-stream' 
                } 
            }, (response) => {
                console.log('[DL][UNINSTALLER] Status:', response.statusCode, 'CT:', response.headers['content-type'], 'CL:', response.headers['content-length']);
                this.sendProgress('[DL][UNINSTALLER] Status: ' + response.statusCode, 58);
                
                if ([301,302,307,308].includes(response.statusCode)) {
                    const redirectUrl = response.headers.location;
                    console.log('[DL][UNINSTALLER] Redirect ->', redirectUrl);
                    this.sendProgress('[DL][UNINSTALLER] Redirect to: ' + redirectUrl, 58);
                    if (redirectUrl) {
                        this.sendProgress('[DL][UNINSTALLER] Redirect download...', 58);
                        response.destroy();
                        resolve(downloadUninstaller(redirectUrl, outputPath));
                        return;
                    } else {
                        this.sendProgress('[DL][UNINSTALLER] Redirect senza location', 58, false, true);
                        reject(new Error('Redirect senza location'));
                        return;
                    }
                }

                const contentType = (response.headers['content-type'] || '').toLowerCase();
                if (contentType.includes('text/html')) {
                    console.error('[DL][UNINSTALLER] Unexpected HTML response');
                    this.sendProgress('[DL][UNINSTALLER] Risposta HTML inattesa dal server', 58, false, true);
                    reject(new Error('Risposta non valida (HTML) dal server.')); 
                    return;
                }

                if (response.statusCode !== 200) {
                    console.error('[DL][UNINSTALLER] HTTP error:', response.statusCode, response.statusMessage);
                    this.sendProgress('[DL][UNINSTALLER] HTTP error: ' + response.statusCode + ' ' + response.statusMessage, 58, false, true);
                    reject(new Error('HTTP ' + response.statusCode + ': ' + response.statusMessage));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize > 0) {
                        const percent = Math.round((downloadedSize / totalSize) * 100);
                        const progress = Math.round(58 + (downloadedSize / totalSize) * 20); // Da 58% a 78%
                        if (percent % 5 === 0) console.log('[DL][UNINSTALLER] Progress:', percent + '%');
                        this.sendProgress('[DL][UNINSTALLER] Progresso: ' + percent + '%', progress);
                    } else {
                        this.sendProgress('[DL][UNINSTALLER] Download in corso...', 65);
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    try {
                        const stats = fs.statSync(outputPath);
                        console.log('[DL][UNINSTALLER] File size:', stats.size);
                        this.sendProgress('[DL][UNINSTALLER] File scaricato: ' + stats.size + ' bytes', 78);
                        if (!stats || stats.size < 1024 * 1024) {
                            this.sendProgress('[DL][UNINSTALLER] File scaricato troppo piccolo (<1MB)', 78, false, true);
                            fs.unlinkSync(outputPath);
                            return reject(new Error('Download incompleto o file troppo piccolo'));
                        }
                        this.sendProgress('✅ [DL][UNINSTALLER] Download completato!', 80);
                    } catch (e) {
                        this.sendProgress('[DL][UNINSTALLER] Impossibile validare il file scaricato', 78, false, true);
                        return reject(new Error('Impossibile validare il file scaricato'));
                    }
                    resolve(outputPath);
                });

                file.on('error', (err) => {
                    console.error('[DL][UNINSTALLER] File stream error:', err.message);
                    this.sendProgress('[DL][UNINSTALLER] Errore scrittura file: ' + err.message, 70, false, true);
                    fs.unlink(outputPath, () => {});
                    reject(err);
                });
            });
            request.on('error', (err) => { 
                console.error('[DL][UNINSTALLER] Request error:', err.message); 
                this.sendProgress('[DL][UNINSTALLER] Errore richiesta: ' + err.message, 58, false, true);
                reject(err); 
            });
        });

        try {
            const uninstallerUrl = await resolveUninstallerUrl();
            await downloadUninstaller(uninstallerUrl, outputPath);
            return outputPath;
        } catch (error) {
            this.sendProgress('❌ [DL][UNINSTALLER] Errore download uninstaller: ' + error.message, 55, false, true);
            throw error;
        }
    }

    async installApp(downloadedPath) {
        this.sendProgress('[DL] Verifica file scaricato...', 70);
        this.sendProgress(\`[DL] Percorso file: \${downloadedPath}\`, 70);
        
        // Verify downloaded file exists
        if (!fs.existsSync(downloadedPath)) {
            this.sendProgress(\`[DL] ERRORE: File non trovato: \${downloadedPath}\`, 70, false, true);
            throw new Error('File scaricato non trovato: ' + downloadedPath);
        }
        
        this.sendProgress('[DL] File scaricato verificato!', 70);
        
        const targetPath = path.join(this.installPath, 'Inferno-Console-win.exe');
        const tempPath = path.join(this.installPath, 'Inferno-Console-temp.exe');
        
        // Strategy: Rename temp to main executable, keep corrupted as temp for deletion
        this.sendProgress('📁 Creazione file principale funzionante...', 70);
        
        // Copy to temp file first (this will be the working one)
        fs.copyFileSync(downloadedPath, tempPath);
        this.sendProgress('✅ File temporaneo creato: Inferno-Console-temp.exe', 72);
        
        // Copy to target file (this might be corrupted, will be used as temp)
        fs.copyFileSync(downloadedPath, targetPath);
        this.sendProgress('✅ File secondario creato: Inferno-Console-win.exe', 73);
        
        // Kill any running Inferno Console processes before renaming
        this.sendProgress('🔄 Chiusura processi Inferno Console esistenti...', 74);
        try {
            const { execSync } = require('child_process');
            execSync('taskkill /f /im "Inferno Console.exe" /t', { stdio: 'ignore' });
            execSync('taskkill /f /im "Inferno-Console-temp.exe" /t', { stdio: 'ignore' });
            execSync('taskkill /f /im "Inferno-Console-win.exe" /t', { stdio: 'ignore' });
            this.sendProgress('✅ Processi chiusi', 74);
        } catch (error) {
            this.sendProgress('ℹ️ Nessun processo da chiudere', 74);
        }
        
        // Wait a moment for processes to fully terminate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Rename temp to main executable (the working one)
        const mainExePath = path.join(this.installPath, 'Inferno Console.exe');
        fs.renameSync(tempPath, mainExePath);
        this.sendProgress('✅ File principale rinominato: Inferno Console.exe', 75);
        
        // Rename target to temp (the potentially corrupted one)
        fs.renameSync(targetPath, tempPath);
        this.sendProgress('✅ File secondario rinominato: Inferno-Console-temp.exe', 76);
        
        // Verify main file exists
        if (fs.existsSync(mainExePath)) {
            const mainStats = fs.statSync(mainExePath);
            this.sendProgress(\`✅ Applicazione installata: \${mainStats.size} bytes\`, 85);
        } else {
            this.sendProgress('❌ ERRORE: File principale non creato!', 85, false, true);
            throw new Error('File principale non creato');
        }
    }

    async createShortcuts(createShortcutEnabled = true) {
        try {
            if (!createShortcutEnabled) {
                this.sendProgress('ℹ️ Creazione shortcut disabilitata dall\\'utente', 90);
                return;
            }
            
            // Create desktop shortcut using PowerShell
            const desktopPath = path.join(os.homedir(), 'Desktop', 'Inferno Console.lnk');
            const targetExe = path.join(this.installPath, 'Inferno Console.exe');
            
            // Create Start Menu shortcut
            const startMenuPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Inferno Console.lnk');
            
            // Create PowerShell script for shortcuts
            const tempScriptPath = path.join(os.tmpdir(), 'create_shortcuts.ps1');
            const psScript = [
                '# Create Desktop Shortcut',
                '$WshShell = New-Object -comObject WScript.Shell',
                '$DesktopShortcut = $WshShell.CreateShortcut("' + desktopPath + '")',
                '$DesktopShortcut.TargetPath = "' + targetExe + '"',
                '$DesktopShortcut.WorkingDirectory = "' + this.installPath + '"',
                '$DesktopShortcut.Description = "Inferno Console"',
                '$DesktopShortcut.Save()',
                'Write-Host "Desktop shortcut created"',
                '',
                '# Create Start Menu Shortcut',
                '$StartMenuShortcut = $WshShell.CreateShortcut("' + startMenuPath + '")',
                '$StartMenuShortcut.TargetPath = "' + targetExe + '"',
                '$StartMenuShortcut.WorkingDirectory = "' + this.installPath + '"',
                '$StartMenuShortcut.Description = "Inferno Console"',
                '$StartMenuShortcut.Save()',
                'Write-Host "Start Menu shortcut created"',
                'Write-Host "All shortcuts created successfully"'
            ].join('\\n');
            
            // Write script to temporary file
            fs.writeFileSync(tempScriptPath, psScript, 'utf8');
            
            // Use execSync to run the script file
            const { execSync } = require('child_process');
            
            try {
                const result = execSync('powershell -ExecutionPolicy Bypass -File "' + tempScriptPath + '"', { encoding: 'utf8' });
                this.sendProgress('✅ Shortcut creati con successo!', 90);
                
            } catch (execError) {
                this.sendProgress('❌ Errore creazione shortcut', 85, false, true);
            } finally {
                // Clean up temporary script file
                try {
                    if (fs.existsSync(tempScriptPath)) {
                        fs.unlinkSync(tempScriptPath);
                    }
                } catch (cleanupError) {
                    // Silent cleanup error
                }
            }
            
        } catch (error) {
            this.sendProgress('❌ Errore creazione shortcut: ' + error.message, 85, false, true);
        }
    }

    async createUninstaller() {
        // Check if uninstaller was already downloaded
        const targetUninstaller = path.join(this.installPath, 'Inferno-Console-Uninstaller.exe');
        
        if (fs.existsSync(targetUninstaller)) {
            this.sendProgress('✅ Uninstaller già presente (scaricato da GitHub)', 95);
            console.log('Uninstaller already downloaded from GitHub:', targetUninstaller);
            return;
        }
        
        // Fallback: Copy the Electron uninstaller from the dist-electron directory
        const sourceUninstaller = path.join(__dirname, '..', 'dist-electron', 'Inferno-Console-Uninstaller.exe');
        
        if (fs.existsSync(sourceUninstaller)) {
            fs.copyFileSync(sourceUninstaller, targetUninstaller);
            this.sendProgress('✅ Uninstaller copiato da build locale', 95);
            console.log('Electron uninstaller copied to:', targetUninstaller);
        } else {
            console.warn('Electron uninstaller not found, creating fallback .bat');
            this.sendProgress('⚠️ Creazione uninstaller fallback .bat', 95);
            const uninstallerPath = path.join(this.installPath, 'Uninstall-Inferno-Console.bat');
            const uninstallerContent = \`@echo off
echo Disinstallazione Inferno Console...
rmdir /s /q "\${this.installPath}"
del "%~f0"
echo Disinstallazione completata!
pause\`;
            fs.writeFileSync(uninstallerPath, uninstallerContent);
        }
    }

    async createInstallerMarker() {
        const markerPath = path.join(this.installPath, 'installer-info.json');
        const markerData = {
            version: '1.4.108',
            installPath: this.installPath,
            installDate: new Date().toISOString(),
            installerType: 'custom'
        };
        fs.writeFileSync(markerPath, JSON.stringify(markerData, null, 2));
    }

    async writeInstallPathToRegistry() {
        try {
            const { execSync } = require('child_process');
            // Escape embedded quotes for reg.exe
            const safePath = (this.installPath || '').replace(/"/g, '""');
            // Use quadruple backslashes here so that generated installer code contains double backslashes
            const cmd = 'reg add "HKCU\\\\Software\\\\InfernoConsole" /v InstallPath /t REG_SZ /d "' + safePath + '" /f';
            execSync(cmd, { stdio: 'ignore' });
            this.sendProgress('✅ Percorso installazione salvato nel Registro di sistema (HKCU)', 100);
        } catch (e1) {
            try {
                // PowerShell fallback with Registry provider (no need to escape backslashes)
                const psPath = (this.installPath || '').replace(/'/g, "''");
                const psCmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "' +
                  "New-Item -Path 'HKCU:\\Software\\InfernoConsole' -Force | Out-Null; " +
                  "Set-ItemProperty -Path 'HKCU:\\Software\\InfernoConsole' -Name 'InstallPath' -Value '" + psPath + "' -Force" +
                '"';
                const { execSync } = require('child_process');
                execSync(psCmd, { stdio: 'ignore' });
                this.sendProgress('✅ Percorso installazione salvato nel Registro di sistema (PowerShell fallback)', 100);
            } catch (e2) {
                this.sendProgress('⚠️ Impossibile scrivere nel Registro di sistema: ' + e2.message, 100);
            }
        }
    }


}

function createWindow() {
        const mainWindow = new BrowserWindow({
            width: 1300,
            height: 1000,
            minWidth: 1200,
            minHeight: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        frame: false,
        titleBarStyle: 'hidden',
        menuBarVisible: false,
        resizable: true,
        minimizable: true,
        maximizable: false,
        closable: true
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    
    mainWindow.once('ready-to-show', () => {
        // Nessun menu - interfaccia pulita
        Menu.setApplicationMenu(null);
    });
    
    // Handle window controls via IPC
    ipcMain.handle('minimize-app', () => {
        mainWindow.minimize();
    });
    
    ipcMain.handle('close-app', () => {
        mainWindow.close();
    });
    
    ipcMain.handle('finish-installation', () => {
        app.quit();
    });
    
    // Handle installation logic
    ipcMain.handle('start-installation', async (event, data) => {
        const { installPath, createShortcut } = data;
        console.log('Starting installation to:', installPath);
        console.log('Create shortcut enabled:', createShortcut);
        
        // Real installation process
        const installer = new InstallerApp();
        installer.mainWindow = mainWindow;
        installer.installPath = installPath;
        installer.createShortcutEnabled = createShortcut;
        return await installer.performInstallation();
    });
    
    ipcMain.handle('select-install-path', async () => {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Installation Directory'
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });
    
    ipcMain.handle('open-path', async (event, targetPath) => {
        const { shell } = require('electron');
        const fs = require('fs');
        try {
            console.log('🔍 Verifica file:', targetPath);
            
            if (targetPath && fs.existsSync(targetPath)) {
                const stats = fs.statSync(targetPath);
                console.log('✅ File trovato:', stats.size, 'bytes');
                await shell.openPath(targetPath);
                return { success: true };
            }
            
            console.log('❌ File non trovato:', targetPath);
            return { success: false, message: 'File not found: ' + (targetPath || 'undefined') };
        } catch (err) {
            console.log('❌ Errore apertura:', err.message);
            return { success: false, message: err.message };
        }
    });

    
    ipcMain.handle('force-kill-all-processes', async () => {
        const { exec } = require('child_process');
        return new Promise((resolve, reject) => {
            console.log('🔄 Terminazione FORZATA di tutti i processi Inferno Console...');
            
            // Multiple kill commands to be absolutely sure
            const killCommands = [
                'taskkill /f /im "Inferno Console.exe" 2>nul',
                'taskkill /f /im "Inferno-Console-win.exe" 2>nul',
                'taskkill /f /im "Inferno-Console-temp.exe" 2>nul',
                'taskkill /f /im "InfernoConsole.exe" 2>nul',
                'wmic process where "name like \'%Inferno%\'" delete 2>nul',
                'wmic process where "commandline like \'%Inferno%\'" delete 2>nul'
            ];
            
            let completed = 0;
            let hasError = false;
            
            killCommands.forEach((cmd, index) => {
                exec(cmd, (error, stdout, stderr) => {
                    completed++;
                    if (error && error.code !== 1) { // Code 1 means no processes found
                        console.log('⚠️ Errore comando ' + (index + 1) + ':', error.message);
                        hasError = true;
                    } else {
                        console.log('✅ Comando ' + (index + 1) + ' completato');
                    }
                    
                    if (completed === killCommands.length) {
                        if (hasError) {
                            console.log('⚠️ Alcuni comandi hanno avuto errori, ma continuo...');
                        }
                        console.log('✅ Terminazione processi completata');
                        resolve();
                    }
                });
            });
        });
    });
    
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});`;

// Create installer package.json
const installerPackageJson = {
    "name": "inferno-console-installer",
    "version": "1.4.126",
    "description": "Inferno Console Installer",
    "author": "Alessandro(NeverAgain)",
    "main": "installer-main.js",
    "scripts": {
        "start": "electron ."
    },
    "devDependencies": {
        "electron": "^38.1.0"
    }
};

// Write installer files
fs.writeFileSync(path.join(outputDir, 'installer-main.js'), installerMain);
fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(installerPackageJson, null, 2));

// Copy GUI files
fs.copyFileSync(path.join(installerDir, 'gui', 'index.html'), path.join(outputDir, 'index.html'));
fs.copyFileSync(path.join(installerDir, 'gui', 'style.css'), path.join(outputDir, 'style.css'));
fs.copyFileSync(path.join(installerDir, 'gui', 'script.js'), path.join(outputDir, 'script.js'));

// Create electron-builder config for installer
const installerConfig = {
    "appId": "com.infernoconsole.installer",
    "productName": "Inferno Console Installer",
    "directories": {
        "output": "installer-dist"
    },
    "publish": [
        { "provider": "generic", "url": "" }
    ],
    "files": [
        "installer-main.js",
        "index.html",
        "style.css", 
        "script.js",
        "package.json"
    ],
    "win": {
        "target": "portable",
        "artifactName": "Inferno-Console-Installer.${ext}"
    }
};

fs.writeFileSync(path.join(outputDir, 'installer-builder.json'), JSON.stringify(installerConfig, null, 2));

// Build installer using electron-builder
try {
    // Install dependencies first
    console.log('Installing dependencies...');
    execSync('npm install', {
        cwd: outputDir,
        stdio: 'inherit'
    });
    
    // Build with electron-builder
    execSync(`npx electron-builder --config installer-builder.json --win --publish never`, {
        cwd: outputDir,
        stdio: 'inherit'
    });
    
    // Move the built installer to the correct location
    const builtInstaller = path.join(outputDir, 'installer-dist', 'Inferno-Console-Installer.exe');
    if (fs.existsSync(builtInstaller)) {
        fs.moveSync(builtInstaller, path.join(outputDir, outputExe));
        console.log('✅ Installer executable built with electron-builder');
    } else {
        throw new Error('Installer not found after build');
    }
} catch (error) {
    console.error('❌ Failed to build installer executable:', error.message);
    process.exit(1);
}

// 3. Copy installer directory to output
console.log('📁 Copying installer directory...');
try {
    fs.copySync(installerDir, path.join(outputDir, 'installer'));
    console.log('✅ Installer directory copied');
} catch (error) {
    console.error('❌ Failed to copy installer directory:', error.message);
    process.exit(1);
}

// 3.5. Check if portable executable exists
console.log('📁 Checking for portable executable...');
const portableExePath = path.join(outputDir, 'Inferno-Console-win.exe');
if (fs.existsSync(portableExePath)) {
    console.log('✅ Portable executable found');
} else {
    console.log('⚠️  Portable executable not found, will be created by main build');
}

// 4. Build Electron uninstaller first
console.log('🔨 Building Electron uninstaller...');
try {
    execSync('node build-uninstaller.js', { 
        cwd: installerDir, 
        stdio: 'inherit' 
    });
    console.log('✅ Electron uninstaller built');
} catch (error) {
    console.warn('⚠️ Failed to build Electron uninstaller, will use fallback .bat');
}

// 5. Create uninstaller fallback (BAT) without overwriting the EXE
console.log('📦 Creating uninstaller fallback...');
const uninstallerBat = `@echo off
setlocal EnableDelayedExpansion
echo ========================================
echo    INFERNO CONSOLE - UNINSTALLER (FALLBACK)
echo ========================================
echo.
for /f "tokens=3,*" %%A in ('reg query HKCU\Software\InfernoConsole /v InstallPath ^| find /i "REG_SZ"') do set INSTALL_DIR=%%A %%B
if not defined INSTALL_DIR set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
echo [INFO] Cartella: "%INSTALL_DIR%"
echo.
echo [INFO] Rimozione file applicazione...
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%" 2>nul
)
echo [INFO] Rimozione shortcut...
if exist "%USERPROFILE%\Desktop\Inferno Console.lnk" del "%USERPROFILE%\Desktop\Inferno Console.lnk" 2>nul
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Inferno Console.lnk" del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Inferno Console.lnk" 2>nul
echo [OK] Disinstallazione completata.
endlocal
exit /b 0`;

fs.writeFileSync(path.join(outputDir, 'Uninstall-Inferno-Console.bat'), uninstallerBat);
console.log('✅ Uninstaller fallback BAT created');

// 6. Create latest.yml for electron-updater
console.log('📦 Creating latest.yml...');
const installerExePath = path.join(outputDir, outputExe);
const portableExeInOutputPath = path.join(outputDir, 'Inferno-Console-win.exe');

// Read version dynamically from installer/package.json to keep latest.yml in sync
let dynamicVersion = '1.4.126';
try {
    const pkgJsonPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        if (pkg && pkg.version) dynamicVersion = pkg.version;
    }
} catch (_) { /* fallback to default */ }

let latestYml = `version: ${dynamicVersion}
files:
  - url: Inferno-Console-Installer.exe
    sha512: ${require('crypto').createHash('sha512').update(fs.readFileSync(installerExePath)).digest('hex')}
    size: ${fs.statSync(installerExePath).size}`;

// Add portable executable if it exists
if (fs.existsSync(portableExeInOutputPath)) {
    latestYml += `
  - url: Inferno-Console-win.exe
    sha512: ${require('crypto').createHash('sha512').update(fs.readFileSync(portableExeInOutputPath)).digest('hex')}
    size: ${fs.statSync(portableExeInOutputPath).size}`;
}

latestYml += `
path: Inferno-Console-Installer.exe
sha512: ${require('crypto').createHash('sha512').update(fs.readFileSync(installerExePath)).digest('hex')}
releaseDate: ${new Date().toISOString()}`;

fs.writeFileSync(path.join(outputDir, 'latest.yml'), latestYml);
console.log('✅ latest.yml created');

// 7. Create installer package
console.log('📦 Creating installer package...');
const installerPackage = {
    name: 'Inferno-Console-Installer',
            version: '1.4.126',
    description: 'Custom installer for Inferno Console',
    main: outputExe,
    files: [
        outputExe,
        'Inferno-Console-Uninstaller.exe',
        'latest.yml',
        'gui/**/*',
        'assets/**/*'
    ]
};

fs.writeFileSync(
    path.join(outputDir, 'package.json'),
    JSON.stringify(installerPackage, null, 2)
);

console.log('✅ Installer package created');

// 8. Create README for installer
const readmeContent = `# Inferno Console Installer

## Installazione

1. Scarica \`${outputExe}\`
2. Esegui l'installer
3. Segui le istruzioni a schermo

## Caratteristiche

- 🎨 Interfaccia moderna in stile NSIS
- 📁 Selezione directory personalizzabile
- 📊 Progress bar in tempo reale
- 🔗 Creazione automatica shortcut
- 🗑️ Uninstaller incluso

## Requisiti

- Windows 10/11 (64-bit)
- 4 GB RAM (8 GB consigliati)
- 100 MB spazio libero
- Connessione internet per download

## Supporto

Per problemi o domande, visita: https://github.com/Alexand83/InfernoConsole
`;

fs.writeFileSync(path.join(outputDir, 'README.md'), readmeContent);

console.log('✅ README created');

console.log('\n🎉 INSTALLER BUILD COMPLETED!\n');
console.log(`📁 Output: ${outputDir}`);
console.log(`📦 Installer: ${path.join(outputDir, outputExe)}`);
console.log(`📊 Installer size: ${(fs.statSync(path.join(outputDir, outputExe)).size / (1024 * 1024)).toFixed(2)} MB`);

// 9. Create GitHub release info
const releaseInfo = {
    tag_name: 'v1.4.126',
    name: 'Inferno Console v1.4.126 - Custom Installer',
    body: `## 🎉 Inferno Console v1.4.126 - Custom Installer

### ✨ Nuove Caratteristiche
- 🎨 **Installer personalizzato** con interfaccia moderna
- 📁 **Selezione directory** personalizzabile
- 📊 **Progress bar** in tempo reale
- 🔗 **Shortcut automatici** desktop e Start Menu
- 🗑️ **Uninstaller** incluso

### 📦 Installazione
1. Scarica \`Inferno-Console-Installer.exe\`
2. Esegui l'installer
3. Segui le istruzioni a schermo

### 🔧 Requisiti
- Windows 10/11 (64-bit)
- 4 GB RAM (8 GB consigliati)
- 100 MB spazio libero
- Connessione internet

### 🚀 Download
- **Installer Personalizzato**: \`Inferno-Console-Installer.exe\`
- **App Portabile**: \`Inferno-Console-win.exe\` (per utenti avanzati)

### 📝 Note
- L'installer scarica automaticamente l'applicazione da GitHub
- Dimensioni installer: ~5MB (efficiente e veloce)
- Installazione completa: ~120MB`,
    draft: false,
    prerelease: false
};

fs.writeFileSync(
    path.join(outputDir, 'release-info.json'),
    JSON.stringify(releaseInfo, null, 2)
);

console.log('✅ Release info created');
console.log('\n🚀 Ready for GitHub Release!');
