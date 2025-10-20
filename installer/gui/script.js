const { ipcRenderer } = require('electron');
const path = require('path');

class NSISInstaller {
    constructor() {
        this.currentStep = 'welcome';
        this.steps = ['welcome', 'license', 'path', 'install', 'complete'];
        this.installPath = ''; // Will be set from backend
        this.isInstalling = false;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing NSIS-style Installer...');
        
        this.setupEventListeners();
        await this.loadInstallOptions();

        // Version labels removed by request; no dynamic population needed
        // Auto-detect existing installation to enable update fast-path
        try {
            const detection = await ipcRenderer.invoke('detect-existing-install');
            if (detection && detection.exists && detection.installPath) {
                // Pre-fill path and skip to install step directly
                this.installPath = detection.installPath;
                const pathInput = document.getElementById('installPath');
                if (pathInput) pathInput.value = this.installPath;
                this.addLog(`🔎 Installazione esistente rilevata in: ${this.installPath}`);

                // Mark license as accepted to bypass button disabling
                const licenseAgree = document.getElementById('licenseAgree');
                if (licenseAgree) {
                    licenseAgree.checked = true;
                }

                // Jump to install step and start immediately
                this.goToStep('install', true);
                this.updateButtons();
                // Ensure UI controls are set for install step
                this.setupInstallButton();
                // Start installation automatically
                setTimeout(() => this.startInstallation(), 300);
                return; // Stop normal init flow
            }
        } catch (e) {
            // Ignore detection errors; continue normal flow
        }
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
            // Sanitize noisy prefixes and internal tags
            const clean = (message || '')
              .replace(/^\[DL\]\s*/i, '')
              .replace(/^\[DL\]\[[^\]]+\]\s*/i, '')
              .replace(/GitHub API/gi, 'server aggiornamenti')
              .replace(/HTTP error:\s*/i, 'Errore download: ')
              .replace(/Status:\s*/i, '')
              .trim();

            this.updateProgress(percentage);
            this.updateInstallStatus(clean);
            if (clean && !clean.includes('%')) {
                this.addLog((error ? '❌ ' : '📦 ') + clean);
            }
        });
    }

    async loadInstallOptions() {
        try {
            const installPaths = await ipcRenderer.invoke('get-install-paths');
            console.log('Install paths loaded:', installPaths);
            
            // Set default to Documents (most accessible)
            this.installPath = installPaths.documents;
            
            // Update the path input field
            const pathInput = document.getElementById('installPath');
            if (pathInput) {
                pathInput.value = this.installPath;
            }
            
            // Create dropdown for path selection
            this.createPathSelector(installPaths);
            
        } catch (error) {
            console.error('Error loading install options:', error);
            // Fallback to Documents
            this.installPath = path.join(require('os').homedir(), 'Documents', 'Inferno Console');
            const pathInput = document.getElementById('installPath');
            if (pathInput) {
                pathInput.value = this.installPath;
            }
        }
    }

    createPathSelector(installPaths) {
        const pathInputGroup = document.querySelector('.path-input-group');
        if (!pathInputGroup) return;
        
        // Create dropdown container
        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'path-dropdown-container';
        dropdownContainer.innerHTML = `
            <label for="pathSelector">Seleziona una cartella predefinita:</label>
            <select id="pathSelector" class="path-selector">
                <option value="${installPaths.documents}">📁 Documenti (Raccomandato)</option>
                <option value="${installPaths.desktop}">🖥️ Desktop</option>
                <option value="${installPaths.localappdata}">📂 AppData Locale</option>
                <option value="${installPaths.programs}">⚙️ Programmi (Richiede Admin)</option>
                <option value="custom">📂 Cartella personalizzata...</option>
            </select>
        `;
        
        // Insert before the existing path input
        pathInputGroup.insertBefore(dropdownContainer, pathInputGroup.firstChild);
        
        // Add event listener for dropdown
        const pathSelector = document.getElementById('pathSelector');
        pathSelector.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                this.browseFolder();
            } else {
                this.installPath = e.target.value;
                const pathInput = document.getElementById('installPath');
                if (pathInput) {
                    pathInput.value = this.installPath;
                }
                this.checkAdminRequired();
                this.calculateFreeSpace();
            }
        });
    }

    checkAdminRequired() {
        const adminWarning = document.getElementById('adminWarning');
        if (adminWarning) {
            adminWarning.remove();
        }

        // Check if path requires admin privileges
        const requiresAdmin = this.installPath.includes('Program Files') || 
                             this.installPath.includes('Program Files (x86)') ||
                             this.installPath.includes('C:\\Windows\\') ||
                             this.installPath.includes('C:\\ProgramData\\');

        if (requiresAdmin) {
            this.showAdminWarning();
        }
    }

    showAdminWarning() {
        const pathInputGroup = document.querySelector('.path-input-group');
        if (!pathInputGroup) return;

        const warningDiv = document.createElement('div');
        warningDiv.id = 'adminWarning';
        warningDiv.className = 'admin-warning';
        warningDiv.innerHTML = `
            <div class="warning-header">
                <span class="warning-icon">⚠️</span>
                <strong>Privilegi di Amministratore Richiesti</strong>
            </div>
            <div class="warning-content">
                <p>La cartella selezionata richiede privilegi di amministratore per l'installazione.</p>
                <p><strong>Per installare in questa cartella:</strong></p>
                <ol>
                    <li>Chiudi questo installer</li>
                    <li>Tasto destro sull'installer → "Esegui come amministratore"</li>
                    <li>Oppure: Tasto destro → "Proprietà" → "Avanzate" → "Esegui come amministratore"</li>
                </ol>
                <p><strong>Alternative senza admin:</strong></p>
                <ul>
                    <li>📁 Documenti (raccomandato)</li>
                    <li>🖥️ Desktop</li>
                    <li>📂 AppData Locale</li>
                </ul>
            </div>
        `;

        // Insert after the path input
        const pathInputContainer = pathInputGroup.querySelector('.path-input-container');
        pathInputContainer.parentNode.insertBefore(warningDiv, pathInputContainer.nextSibling);
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
                // Go to install step and setup button
                this.goToStep('install', true);
                this.setupInstallButton();
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
        
        // Block navigation during installation
        if (this.isInstalling) {
            return false;
        }
        
        // Can ONLY go to previous steps, never forward via sidebar
        return stepIndex < currentIndex;
    }
    
    canGoNext() {
        // Block navigation during installation
        if (this.isInstalling) {
            return false;
        }
        
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
            // Hide "Avanti" button in install step - only show "Inizia Installazione"
            if (this.currentStep === 'install') {
                nextBtn.style.display = 'none';
            } else {
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
                        nextBtn.textContent = 'Avanti';
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

    setupInstallButton() {
        const startInstallBtn = document.getElementById('startInstallBtn');
        const installProgress = document.querySelector('.install-progress');
        
        if (startInstallBtn) {
            startInstallBtn.addEventListener('click', async () => {
                // Hide the options and show progress + log
                startInstallBtn.style.display = 'none';
                installProgress.style.display = 'block';
                
                const installLog = document.querySelector('.install-log');
                if (installLog) {
                    installLog.style.display = 'block';
                }
                
                // Start installation
                await this.startInstallation();
            });
        }
        
        // Hide progress and log initially
        if (installProgress) {
            installProgress.style.display = 'none';
        }
        
        const installLog = document.querySelector('.install-log');
        if (installLog) {
            installLog.style.display = 'none';
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
            
            // Get checkbox state
            const createShortcut = document.getElementById('createShortcut');
            const createShortcutEnabled = createShortcut ? createShortcut.checked : false;
            console.log('Create shortcut enabled:', createShortcutEnabled);
            
            // Call the real installation
            console.log('Calling IPC start-installation...');
            const result = await ipcRenderer.invoke('start-installation', {
                installPath: this.installPath,
                createShortcut: createShortcutEnabled
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
            
            // Handle admin permission error gracefully
            if (error.message.includes('permessi') || error.message.includes('admin') || error.message.includes('REQUIRES_ADMIN')) {
                this.addLog('💡 Per installare in questa cartella, esegui l\'installer come amministratore');
                this.addLog('🔄 Oppure torna indietro e scegli una cartella diversa (Documenti, Desktop, AppData)');
                this.updateInstallStatus('⚠️ Permessi di amministratore richiesti per questa cartella');
                this.addLog('📋 Istruzioni: Tasto destro sull\'installer → "Esegui come amministratore"');
                // Don't show alert for admin permission error, just show in logs
            } else {
                this.addLog(`❌ Errore: ${error.message}`);
                this.updateInstallStatus(`Errore: ${error.message}`);
                // Only show alert for critical errors, not permission errors
                if (!error.message.includes('permessi') && !error.message.includes('admin')) {
                    alert(`Errore durante l'installazione: ${error.message}`);
                }
            }
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
                this.checkAdminRequired();
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
                    const fs = require('fs');
                    const candidates = [
                        path.join(installPath, 'Inferno Console.exe'), // Main executable
                        path.join(installPath, 'Inferno-Console-temp.exe'), // Try temp file first
                        path.join(installPath, 'Inferno-Console-win.exe'),
                        path.join(installPath, 'Inferno-Console-New.exe')
                    ];
                    const executablePath = candidates.find(p => fs.existsSync(p));
                    
                    if (!executablePath) {
                        const tried = candidates.join(' | ');
                        this.addLog('❌ Percorso eseguibile non trovato');
                        alert('Errore: Eseguibile non trovato. Percorsi provati:\n' + tried + '\n\nVerifica che l\'installazione sia stata completata correttamente.');
                        return;
                    }
                    
                    this.addLog(`🚀 Chiusura forzata di tutti i processi Inferno Console...`);
                    
                    // Kill ALL Inferno Console processes aggressively
                    ipcRenderer.invoke('force-kill-all-processes').then(() => {
                        this.addLog('✅ Tutti i processi terminati con successo!');
                        this.addLog('⏳ Attendo 3 secondi per la chiusura completa...');
                        
                        // Wait longer for complete process termination
                        setTimeout(() => {
                            this.addLog('🚀 Avvio applicazione...');
                            
                            // Now try to launch the app
                            ipcRenderer.invoke('open-path', executablePath).then(result => {
                                if (result && result.success) {
                                    this.addLog('✅ Applicazione avviata con successo!');
                                    
                                    // If we launched the temp file, note it for manual cleanup
                                    if (executablePath.includes('Inferno-Console-temp.exe')) {
                                        this.addLog('💡 File temporaneo: Inferno-Console-temp.exe');
                                        this.addLog('🧹 Puoi eliminarlo manualmente dopo l\'avvio');
                                    }
                                } else {
                                    const errorMsg = result ? result.message : 'Risultato non definito';
                                    this.addLog(`❌ Errore avvio applicazione: ${errorMsg}`);
                                }
                            }).catch(error => {
                                this.addLog(`❌ Errore avvio applicazione: ${error.message}`);
                            });
                            
                            // Close installer after starting app
                            this.addLog('🔒 Chiusura installer...');
                            setTimeout(() => {
                                ipcRenderer.invoke('finish-installation');
                            }, 1000);
                        }, 3000); // Wait 3 seconds for complete termination
                    }).catch(error => {
                        this.addLog(`⚠️ Errore terminazione processi: ${error.message}`);
                        // Try to start app anyway
                        this.addLog('🚀 Tentativo avvio diretto...');
                        ipcRenderer.invoke('open-path', executablePath);
                        setTimeout(() => {
                            ipcRenderer.invoke('finish-installation');
                        }, 1000);
                    });
                } else {
                    this.addLog('❌ Percorso eseguibile non trovato');
                    alert('Errore: Percorso eseguibile non trovato. Verifica l\'installazione.');
                }
            } catch (error) {
                console.error('Error launching app:', error);
                this.addLog(`❌ Errore avvio applicazione: ${error.message}`);
                alert(`Errore critico: ${error.message}`);
            }
        } else {
            // Close installer immediately if not launching app
            this.addLog('✅ Installazione completata!');
            this.addLog('💡 Puoi avviare Inferno Console dalla cartella di installazione');
            this.addLog('🔗 Oppure usa lo shortcut sul desktop');
            setTimeout(() => {
                ipcRenderer.invoke('finish-installation');
            }, 2000);
        }
        
        if (createShortcut) {
            // Shortcut creation would be handled by the installer logic
        }
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