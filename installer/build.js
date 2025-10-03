#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class InstallerBuilder {
    constructor() {
        this.rootDir = __dirname;
        this.distDir = path.join(this.rootDir, 'dist');
        this.outputDir = path.join(this.rootDir, '..', 'dist-electron');
    }

    async build() {
        try {
            console.log(chalk.blue.bold('\n🔨 BUILDING CUSTOM INSTALLER\n'));

            // 1. Clean previous builds
            await this.clean();

            // 2. Install dependencies
            await this.installDependencies();

            // 3. Build the installer
            await this.buildInstaller();

            // 4. Copy to output directory
            await this.copyToOutput();

            console.log(chalk.green.bold('\n✅ INSTALLER BUILD COMPLETED!\n'));
            console.log(chalk.blue(`📁 Output: ${this.outputDir}`));
            console.log(chalk.blue(`📦 Installer: ${path.join(this.outputDir, 'Inferno-Console-Installer.exe')}`));

        } catch (error) {
            console.error(chalk.red('\n❌ BUILD FAILED:'), error.message);
            process.exit(1);
        }
    }

    async clean() {
        console.log(chalk.yellow('🧹 Cleaning previous builds...'));
        
        await fs.remove(this.distDir);
        await fs.ensureDir(this.distDir);
        
        console.log(chalk.green('✅ Clean completed'));
    }

    async installDependencies() {
        console.log(chalk.yellow('📦 Installing dependencies...'));
        
        try {
            execSync('npm install', { 
                cwd: this.rootDir, 
                stdio: 'inherit' 
            });
            console.log(chalk.green('✅ Dependencies installed'));
        } catch (error) {
            throw new Error(`Failed to install dependencies: ${error.message}`);
        }
    }

    async buildInstaller() {
        console.log(chalk.yellow('🔨 Building installer executable...'));
        
        try {
            // Build with pkg
            execSync('npx pkg main.js --targets node18-win-x64 --output Inferno-Console-Installer.exe', {
                cwd: this.rootDir,
                stdio: 'inherit'
            });
            
            console.log(chalk.green('✅ Installer executable built'));
        } catch (error) {
            throw new Error(`Failed to build installer: ${error.message}`);
        }
    }

    async copyToOutput() {
        console.log(chalk.yellow('📁 Copying to output directory...'));
        
        await fs.ensureDir(this.outputDir);
        
        // Copy the installer executable
        const installerPath = path.join(this.rootDir, 'Inferno-Console-Installer.exe');
        const outputPath = path.join(this.outputDir, 'Inferno-Console-Installer.exe');
        
        if (await fs.pathExists(installerPath)) {
            await fs.copy(installerPath, outputPath);
            console.log(chalk.green('✅ Installer copied to output directory'));
        } else {
            throw new Error('Installer executable not found');
        }

        // Copy GUI files (for development)
        const guiSource = path.join(this.rootDir, 'gui');
        const guiDest = path.join(this.outputDir, 'installer-gui');
        
        if (await fs.pathExists(guiSource)) {
            await fs.copy(guiSource, guiDest);
            console.log(chalk.green('✅ GUI files copied'));
        }
    }

    async createPortableInstaller() {
        console.log(chalk.yellow('📦 Creating portable installer...'));
        
        // Create a simple batch file that runs the installer
        const batchContent = `@echo off
echo Starting Inferno Console Installer...
"Inferno-Console-Installer.exe" --gui
pause
`;

        const batchPath = path.join(this.outputDir, 'Run-Installer.bat');
        await fs.writeFile(batchPath, batchContent);
        
        console.log(chalk.green('✅ Portable installer created'));
    }

    async createUninstaller() {
        console.log(chalk.yellow('🗑️  Creating uninstaller...'));
        
        // The uninstaller is created by the main installer
        // This is just a placeholder for future enhancements
        console.log(chalk.green('✅ Uninstaller will be created during installation'));
    }
}

// Run the build
const builder = new InstallerBuilder();
builder.build().catch(error => {
    console.error(chalk.red('\n❌ BUILD FAILED:'), error.message);
    process.exit(1);
});
