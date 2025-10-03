const { ipcRenderer } = require('electron');

class UninstallerGUI {
    constructor() {
        this.currentStep = 'detection';
        this.installationInfo = null;
        this.isUninstalling = false;
        
        this.init();
    }

    init() {
        console.log('🗑️ Initializing Uninstaller GUI...');
        
        this.setupEventListeners();
        this.detectInstallation();
        
        // Setup IPC listeners
        ipcRenderer.on('uninstall-progress', (event, { message, percentage, completed, error }) => {
            this.updateProgress(percentage);
            this.updateUninstallStatus(message);
            this.addLog(message, error ? 'error' : 'success');
            
            if (completed) {
                this.goToStep('complete');
            }
        });
    }

    setupEventListeners() {
        // Footer buttons
        const uninstallBtn = document.getElementById('uninstallBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const finishBtn = document.getElementById('finishBtn');
        
        if (uninstallBtn) uninstallBtn.addEventListener('click', () => this.startUninstallation());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelUninstallation());
        if (finishBtn) finishBtn.addEventListener('click', () => this.finishUninstallation());
    }

    async detectInstallation() {
        try {
            this.addLog('🔍 Ricerca installazione di Inferno Console...');
            
            const result = await ipcRenderer.invoke('detect-installation');
            
            if (result.found) {
                this.installationInfo = result;
                this.addLog(`✅ Installazione trovata: ${result.installPath}`);
                this.addLog(`📁 Dimensione: ${this.formatBytes(result.size)}`);
                
                // Update UI with installation info
                document.getElementById('installPath').textContent = result.installPath;
                document.getElementById('installSize').textContent = this.formatBytes(result.size);
                document.getElementById('exePath').textContent = result.exePath;
                
                setTimeout(() => {
                    this.goToStep('confirmation');
                }, 1500);
            } else {
                this.addLog('❌ Nessuna installazione trovata');
                setTimeout(() => {
                    this.goToStep('notfound');
                }, 1500);
            }
        } catch (error) {
            console.error('Detection error:', error);
            this.addLog(`❌ Errore durante la ricerca: ${error.message}`);
            setTimeout(() => {
                this.goToStep('notfound');
            }, 1500);
        }
    }

    goToStep(step) {
        // Hide all steps
        document.querySelectorAll('.step-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Show selected step
        document.getElementById(`step-${step}`).classList.add('active');
        
        this.currentStep = step;
        this.updateButtons();
    }

    updateButtons() {
        const uninstallBtn = document.getElementById('uninstallBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const finishBtn = document.getElementById('finishBtn');
        
        // Reset all buttons
        uninstallBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        finishBtn.style.display = 'none';
        
        switch (this.currentStep) {
            case 'detection':
                // No buttons during detection
                break;
            case 'confirmation':
                uninstallBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'inline-block';
                break;
            case 'uninstalling':
                cancelBtn.style.display = 'inline-block';
                break;
            case 'complete':
                finishBtn.style.display = 'inline-block';
                break;
            case 'notfound':
                finishBtn.style.display = 'inline-block';
                break;
        }
    }

    async startUninstallation() {
        if (this.isUninstalling) return;
        
        this.isUninstalling = true;
        this.goToStep('uninstalling');
        this.updateButtons();
        
        try {
            this.addLog('🚀 Avvio disinstallazione...');
            
            const result = await ipcRenderer.invoke('start-uninstallation', {
                installPath: this.installationInfo.installPath
            });
            
            if (result.success) {
                this.addLog('✅ Disinstallazione completata con successo!');
            } else {
                this.addLog(`❌ Errore durante la disinstallazione: ${result.message}`);
            }
        } catch (error) {
            console.error('Uninstallation error:', error);
            this.addLog(`❌ Errore critico: ${error.message}`);
        } finally {
            this.isUninstalling = false;
        }
    }

    cancelUninstallation() {
        if (this.isUninstalling) {
            // Show confirmation dialog
            if (confirm('La disinstallazione è in corso. Sei sicuro di voler annullare?')) {
                this.addLog('⚠️ Disinstallazione annullata dall\'utente');
                this.goToStep('confirmation');
                this.updateButtons();
            }
        } else {
            this.closeApp();
        }
    }

    finishUninstallation() {
        this.closeApp();
    }

    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(percentage)}%`;
        }
    }

    updateUninstallStatus(message) {
        const statusElement = document.getElementById('uninstallStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    addLog(message, type = 'info') {
        const logContent = document.getElementById('logContent');
        if (!logContent) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    closeApp() {
        ipcRenderer.invoke('close-app');
    }
}

// Global functions for window controls
function minimizeApp() {
    ipcRenderer.invoke('minimize-app');
}

function closeApp() {
    ipcRenderer.invoke('close-app');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing uninstaller...');
    window.uninstaller = new UninstallerGUI();
    console.log('Uninstaller initialized:', window.uninstaller);
});

// Handle window close
window.addEventListener('beforeunload', (event) => {
    if (window.uninstaller && window.uninstaller.isUninstalling) {
        event.preventDefault();
        event.returnValue = 'La disinstallazione è in corso. Sei sicuro di voler chiudere?';
    }
});
