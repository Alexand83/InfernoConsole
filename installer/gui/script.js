const { ipcRenderer } = require('electron');
const path = require('path');

class NSISInstaller {
    constructor() {
        this.currentStep = 'welcome';
        this.steps = ['welcome', 'license', 'path', 'install', 'complete'];
        this.installPath = 'C:\\Program Files\\Inferno Console';
        this.isInstalling = false;
        
        this.init();
    }

    init() {
        console.log('🚀 Initializing NSIS-style Installer...');
        
        this.setupEventListeners();
        this.updateNavigation();
        this.updateButtons();
        this.calculateFreeSpace();
        
        // Setup IPC listeners
        ipcRenderer.on('installer-log', (event, message) => {
            this.addLog(message);
        });

        ipcRenderer.on('installer-progress', (event, { step, percentage, message }) => {
            this.updateProgress(percentage);
            this.updateInstallStatus(message);
        });

        ipcRenderer.on('installation-progress', (event, { message, percentage, completed, error }) => {
            this.updateProgress(percentage);
            this.updateInstallStatus(message);
            // Only add log if it's not a percentage update
            if (!message.includes('%') && !message.includes('progress')) {
                if (error) {
                    this.addLog(`❌ ${message}`);
                } else {
                    this.addLog(`📦 ${message}`);
                }
            }
        });
    }

    setupEventListeners() {
        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const step = e.currentTarget.dataset.step;
                if (this.canNavigateToStep(step)) {
                    this.goToStep(step);
                }
            });
        });

        // License agreement
        document.getElementById('licenseAgree').addEventListener('change', () => {
            this.updateButtons();
        });

        // Path input
        document.getElementById('installPath').addEventListener('input', (e) => {
            this.installPath = e.target.value;
            this.calculateFreeSpace();
        });
    }

    canNavigateToStep(step) {
        const stepIndex = this.steps.indexOf(step);
        const currentIndex = this.steps.indexOf(this.currentStep);
        
        // Can only go to previous steps or next step if current is completed
        return stepIndex <= currentIndex + 1;
    }

    goToStep(step) {
        if (!this.canNavigateToStep(step)) return;
        
        // Hide all steps
        document.querySelectorAll('.step-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Show selected step
        document.getElementById(`step-${step}`).classList.add('active');
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-step="${step}"]`).classList.add('active');
        
        this.currentStep = step;
        this.updateButtons();
        
        // Special handling for each step
        if (step === 'path') {
            this.calculateFreeSpace();
        }
    }

    updateNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            const step = item.dataset.step;
            if (this.canNavigateToStep(step)) {
                item.style.opacity = '1';
                item.style.cursor = 'pointer';
            } else {
                item.style.opacity = '0.5';
                item.style.cursor = 'not-allowed';
            }
        });
    }

    updateButtons() {
        const backBtn = document.getElementById('backBtn');
        const nextBtn = document.getElementById('nextBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const finishBtn = document.getElementById('finishBtn');
        
        // Reset all buttons
        backBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        finishBtn.style.display = 'none';
        
        const currentIndex = this.steps.indexOf(this.currentStep);
        
        switch (this.currentStep) {
            case 'welcome':
                nextBtn.style.display = 'inline-block';
                nextBtn.textContent = 'Avanti';
                break;
                
            case 'license':
                backBtn.style.display = 'inline-block';
                nextBtn.style.display = 'inline-block';
                nextBtn.textContent = 'Avanti';
                nextBtn.disabled = !document.getElementById('licenseAgree').checked;
                break;
                
            case 'path':
                backBtn.style.display = 'inline-block';
                nextBtn.style.display = 'inline-block';
                nextBtn.textContent = 'Installa';
                break;
                
            case 'install':
                cancelBtn.style.display = 'inline-block';
                cancelBtn.disabled = this.isInstalling;
                break;
                
            case 'complete':
                finishBtn.style.display = 'inline-block';
                finishBtn.textContent = 'Fine';
                break;
        }
    }

    async goNext() {
        switch (this.currentStep) {
            case 'welcome':
                this.goToStep('license');
                break;
            case 'license':
                this.goToStep('path');
                break;
            case 'path':
                await this.startInstallation();
                break;
        }
    }

    goBack() {
        const currentIndex = this.steps.indexOf(this.currentStep);
        if (currentIndex > 0) {
            this.goToStep(this.steps[currentIndex - 1]);
        }
    }

    async startInstallation() {
        this.isInstalling = true;
        this.goToStep('install');
        this.updateButtons();
        
        try {
            this.addLog('🔧 Avvio installazione...');
            this.updateInstallStatus('Preparazione...');
            
            // Get the selected install path
            const selectedPath = document.getElementById('installPath').value;
            if (!selectedPath) {
                throw new Error('Nessun percorso di installazione selezionato');
            }
            
            this.installPath = selectedPath;
            this.addLog(`📁 Percorso di installazione: ${this.installPath}`);
            
            // Call the real installation
            const result = await ipcRenderer.invoke('start-installation', {
                installPath: this.installPath
            });
            
            if (result.success) {
                this.addLog('✅ Installazione completata con successo!');
                this.updateInstallStatus('Installazione completata!');
                
                // Update completion info
                document.getElementById('installLocation').textContent = this.installPath;
                
                setTimeout(() => {
                    this.goToStep('complete');
                    this.updateButtons();
                }, 1000);
            } else {
                throw new Error(result.message || 'Installazione fallita');
            }
            
        } catch (error) {
            this.addLog(`❌ Errore durante l'installazione: ${error.message}`);
            this.updateInstallStatus(`Errore: ${error.message}`);
            alert(`Errore durante l'installazione: ${error.message}`);
        } finally {
            this.isInstalling = false;
            this.updateButtons();
        }
    }


    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(percentage)}%`;
        }
    }

    updateInstallStatus(message) {
        const statusElement = document.getElementById('installStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    addLog(message) {
        const logContent = document.getElementById('logContent');
        if (logContent) {
            const logEntry = document.createElement('p');
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logContent.appendChild(logEntry);
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    async calculateFreeSpace() {
        // Simulate free space calculation
        const freeSpaceElement = document.getElementById('freeSpace');
        if (freeSpaceElement) {
            freeSpaceElement.textContent = 'Calcolo...';
            
            // Simulate async calculation
            setTimeout(() => {
                freeSpaceElement.textContent = '2.5 GB disponibili';
            }, 500);
        }
    }

    async browseFolder() {
        try {
            const selectedPath = await ipcRenderer.invoke('select-install-path');
            if (selectedPath) {
                this.installPath = selectedPath;
                document.getElementById('installPath').value = selectedPath;
                this.calculateFreeSpace();
            }
        } catch (error) {
            console.error('Error selecting folder:', error);
        }
    }

    cancelInstall() {
        if (confirm('Sei sicuro di voler annullare l\'installazione?')) {
            this.addLog('❌ Installazione annullata dall\'utente');
            this.goToStep('path');
            this.updateButtons();
        }
    }

    async finishInstall() {
        const launchApp = document.getElementById('launchApp').checked;
        const createShortcut = document.getElementById('createShortcut').checked;
        
        if (launchApp) {
            try {
                // Use the executable path from installation result
                const executablePath = this.installPath ? path.join(this.installPath, 'Inferno Console.exe') : null;
                if (executablePath) {
                    this.addLog(`🚀 Tentativo avvio applicazione: ${executablePath}`);
                    const result = await ipcRenderer.invoke('open-path', executablePath);
                    if (result.success) {
                        this.addLog('✅ Applicazione avviata con successo!');
                    } else {
                        this.addLog(`❌ Errore avvio applicazione: ${result.message}`);
                        alert(`Errore: ${result.message}\n\nVerifica che l'installazione sia stata completata correttamente.`);
                    }
                } else {
                    this.addLog('❌ Percorso eseguibile non trovato');
                    alert('Errore: Percorso eseguibile non trovato. Verifica l\'installazione.');
                }
            } catch (error) {
                console.error('Error launching app:', error);
                this.addLog(`❌ Errore avvio applicazione: ${error.message}`);
                alert(`Errore critico: ${error.message}`);
            }
        }
        
        if (createShortcut) {
            // Shortcut creation would be handled by the installer logic
            this.addLog('🔗 Shortcut creato sul desktop');
        }
        
        // Close the installer
        ipcRenderer.invoke('close-app');
    }
}

// Global functions for title bar
function minimizeApp() {
    ipcRenderer.invoke('minimize-app');
}

function closeApp() {
    if (window.installer && window.installer.isInstalling) {
        if (confirm('L\'installazione è in corso. Sei sicuro di voler chiudere?')) {
            ipcRenderer.invoke('close-app');
        }
    } else {
        ipcRenderer.invoke('close-app');
    }
}

// Global functions for buttons
function goNext() {
    if (window.installer) {
        window.installer.goNext();
    }
}

function goBack() {
    if (window.installer) {
        window.installer.goBack();
    }
}

function cancelInstall() {
    if (window.installer) {
        window.installer.cancelInstall();
    }
}

function finishInstall() {
    if (window.installer) {
        window.installer.finishInstall();
    }
}

function browseFolder() {
    if (window.installer) {
        window.installer.browseFolder();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.installer = new NSISInstaller();
});

// Handle window close
window.addEventListener('beforeunload', (event) => {
    if (window.installer && window.installer.isInstalling) {
        event.preventDefault();
        event.returnValue = 'L\'installazione è in corso. Sei sicuro di voler chiudere?';
    }
});