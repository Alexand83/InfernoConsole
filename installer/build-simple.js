#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class SimpleInstallerBuilder {
    constructor() {
        this.rootDir = __dirname;
        this.distDir = path.join(this.rootDir, 'dist');
        this.outputDir = path.join(this.rootDir, '..', 'dist-electron');
    }

    async build() {
        try {
            console.log(chalk.blue.bold('\n🔨 BUILDING SIMPLE CUSTOM INSTALLER\n'));

            // 1. Clean previous builds
            await this.clean();

            // 2. Install dependencies
            await this.installDependencies();

            // 3. Build the installer
            await this.buildInstaller();

            // 4. Copy to output directory
            await this.copyToOutput();

            console.log(chalk.green.bold('\n✅ SIMPLE INSTALLER BUILD COMPLETED!\n'));
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
            execSync('npx pkg main-simple.js --targets node18-win-x64 --output Inferno-Console-Installer.exe', {
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

        // Get file size
        const stats = await fs.stat(outputPath);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(chalk.blue(`📊 Installer size: ${fileSizeMB} MB`));
    }
}

// Run the build
const builder = new SimpleInstallerBuilder();
builder.build().catch(error => {
    console.error(chalk.red('\n❌ BUILD FAILED:'), error.message);
    process.exit(1);
});
