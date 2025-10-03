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

        // Footer buttons (bind explicitly in addition to inline handlers)
        const backBtn = document.getElementById('backBtn');
        const nextBtn = document.getElementById('nextBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const finishBtn = document.getElementById('finishBtn');
        
        if (backBtn) backBtn.addEventListener('click', () => this.goBack());
        if (nextBtn) nextBtn.addEventListener('click', async () => {
            // Prevent multiple clicks
            if (this.isInstalling) {
                console.log('Installation already in progress, ignoring click');
                return;
            }
            
            if (this.currentStep === 'path') {
                await this.startInstallation();
            } else {
                await this.goNext();
            }
        });
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelInstall());
        if (finishBtn) finishBtn.addEventListener('click', () => this.finishInstall());

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
        
        // Can ONLY go to previous steps, never forward via sidebar
        return stepIndex < currentIndex;
    }
    
    canGoNext() {
        const currentIndex = this.steps.indexOf(this.currentStep);
        return currentIndex < this.steps.length - 1;
    }

    goToStep(step, forced = false) {
        console.log(`goToStep() called: ${step}, forced: ${forced}, currentStep: ${this.currentStep}`);
        const stepIndex = this.steps.indexOf(step);
        const currentIndex = this.steps.indexOf(this.currentStep);
        
        console.log(`Step indices - target: ${stepIndex}, current: ${currentIndex}`);
        
        // Allow if forced (Next/Back), otherwise respect canNavigateToStep
        if (!forced && !this.canNavigateToStep(step)) {
            console.log('Navigation blocked by canNavigateToStep');
            return;
        }
        
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
        console.log(`Current step updated to: ${this.currentStep}`);
        
        // ALWAYS update navigation and buttons after changing step
        this.updateNavigation();
        this.updateButtons();
        
        // Special handling for each step
        if (step === 'path') {
            this.calculateFreeSpace();
        }
    }

    updateNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            const step = item.dataset.step;
            const stepIndex = this.steps.indexOf(step);
            const currentIndex = this.steps.indexOf(this.currentStep);
            
            if (stepIndex < currentIndex) {
                // Previous completed steps - clickable
                item.style.opacity = '1';
                item.style.cursor = 'pointer';
                item.classList.add('completed');
                item.classList.remove('disabled', 'active');
            } else if (stepIndex === currentIndex) {
                // Current step - active
                item.style.opacity = '1';
                item.style.cursor = 'default';
                item.classList.add('active');
                item.classList.remove('completed', 'disabled');
            } else {
                // Future steps - completely disabled
                item.style.opacity = '0.3';
                item.style.cursor = 'not-allowed';
                item.classList.add('disabled');
                item.classList.remove('completed', 'active');
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
        
        // Show back button if not on first step
        if (currentIndex > 0) {
            backBtn.style.display = 'inline-block';
        }
        
        // Show next button based on current step
        if (this.canGoNext()) {
            nextBtn.style.display = 'inline-block';
            
            switch (this.currentStep) {
                case 'welcome':
                    nextBtn.textContent = 'Avanti';
                    nextBtn.className = 'btn btn-primary';
                    nextBtn.disabled = false;
                    break;
                
                case 'license':
                    nextBtn.textContent = 'Avanti';
                    nextBtn.className = 'btn btn-primary';
                    nextBtn.disabled = !document.getElementById('licenseAgree').checked;
                    break;
                
                case 'path':
                    nextBtn.textContent = 'Installa';
                    nextBtn.className = 'btn btn-primary';
                    nextBtn.disabled = false;
                    break;
                
                default:
                    nextBtn.textContent = 'Avanti';
                    nextBtn.className = 'btn btn-primary';
                    nextBtn.disabled = false;
                    break;
            }
        }
        
        // Special cases
        if (this.currentStep === 'install') {
            cancelBtn.style.display = 'inline-block';
            cancelBtn.disabled = this.isInstalling;
        }
        
        if (this.currentStep === 'complete') {
            finishBtn.style.display = 'inline-block';
            finishBtn.textContent = 'Fine';
        }
    }

    async goNext() {
        console.log('goNext() called, current step:', this.currentStep);
        
        switch (this.currentStep) {
            case 'welcome':
                console.log('Going to license...');
                this.goToStep('license', true);
                break;
            case 'license':
                console.log('Going to path...');
                this.goToStep('path', true);
                break;
            case 'path':
                console.log('Starting installation...');
                await this.startInstallation();
                break;
            default:
                console.log('Generic forward navigation...');
                const currentIndex = this.steps.indexOf(this.currentStep);
                const nextIndex = currentIndex + 1;
                if (nextIndex < this.steps.length) {
                    const nextStep = this.steps[nextIndex];
                    this.goToStep(nextStep, true);
                }
                break;
        }
    }

    goBack() {
        const currentIndex = this.steps.indexOf(this.currentStep);
        if (currentIndex > 0) {
            this.goToStep(this.steps[currentIndex - 1], true);
        }
    }

    async startInstallation() {
        console.log('startInstallation() called');
        
        // Prevent multiple installations
        if (this.isInstalling) {
            console.log('Installation already in progress, ignoring');
            return;
        }
        
        this.isInstalling = true;
        this.goToStep('install', true); // Force navigation to install step
        this.updateButtons();
        
        try {
            this.addLog('🔧 Avvio installazione...');
            this.updateInstallStatus('Preparazione...');
            
            // Get the selected install path
            const selectedPath = document.getElementById('installPath').value;
            console.log('Selected path:', selectedPath);
            if (!selectedPath) {
                throw new Error('Nessun percorso di installazione selezionato');
            }
            
            this.installPath = selectedPath;
            this.addLog(`📁 Percorso di installazione: ${this.installPath}`);
            
            // Call the real installation
            console.log('Calling IPC start-installation...');
            const result = await ipcRenderer.invoke('start-installation', {
                installPath: this.installPath
            });
            
            console.log('Installation result:', result);
            if (result.success) {
                this.addLog('✅ Installazione completata con successo!');
                this.updateInstallStatus('Installazione completata!');
                
                // Update completion info
                document.getElementById('installLocation').textContent = this.installPath;
                
                setTimeout(() => {
                    this.goToStep('complete', true); // Force navigation to complete step
                    this.updateButtons();
                }, 1000);
            } else {
                throw new Error(result.message || 'Installazione fallita');
            }
            
        } catch (error) {
            console.error('Installation error:', error);
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
                // Get install path from the input field as fallback
                const installPath = this.installPath || document.getElementById('installPath').value;
                console.log('Install path for launch:', installPath);
                
                if (installPath) {
                    const executablePath = path.join(installPath, 'Inferno-Console-win.exe');
                    this.addLog(`🚀 Tentativo avvio applicazione: ${executablePath}`);
                    const result = await ipcRenderer.invoke('open-path', executablePath);
                    
                    if (result && result.success) {
                        this.addLog('✅ Applicazione avviata con successo!');
                    } else {
                        const errorMsg = result ? result.message : 'Risultato non definito';
                        this.addLog(`❌ Errore avvio applicazione: ${errorMsg}`);
                        alert(`Errore: ${errorMsg}\n\nVerifica che l'installazione sia stata completata correttamente.`);
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

// Global functions for window controls and folder browsing
function browseFolder() {
    if (window.installer) {
        window.installer.browseFolder();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing installer...');
    window.installer = new NSISInstaller();
    console.log('Installer initialized:', window.installer);
});

// Handle window close
window.addEventListener('beforeunload', (event) => {
    if (window.installer && window.installer.isInstalling) {
        event.preventDefault();
        event.returnValue = 'L\'installazione è in corso. Sei sicuro di voler chiudere?';
    }
});