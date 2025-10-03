#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

class NativeInstallerBuilder {
    constructor() {
        this.rootDir = __dirname;
        this.outputDir = path.join(this.rootDir, '..', 'dist-electron');
    }

    async build() {
        try {
            console.log('\n🔨 BUILDING NATIVE CUSTOM INSTALLER\n');

            // 1. Build the installer
            await this.buildInstaller();

            // 2. Copy to output directory
            await this.copyToOutput();

            console.log('\n✅ NATIVE INSTALLER BUILD COMPLETED!\n');
            console.log(`📁 Output: ${this.outputDir}`);
            console.log(`📦 Installer: ${path.join(this.outputDir, 'Inferno-Console-Installer.exe')}`);

        } catch (error) {
            console.error('\n❌ BUILD FAILED:', error.message);
            process.exit(1);
        }
    }

    async buildInstaller() {
        console.log('🔨 Building installer executable...');
        
        try {
            // Build with pkg
            execSync('npx pkg main-native.js --targets node18-win-x64 --output Inferno-Console-Installer.exe', {
                cwd: this.rootDir,
                stdio: 'inherit'
            });
            
            console.log('✅ Installer executable built');
        } catch (error) {
            throw new Error(`Failed to build installer: ${error.message}`);
        }
    }

    async copyToOutput() {
        console.log('📁 Copying to output directory...');
        
        await fs.ensureDir(this.outputDir);
        
        // Copy the installer executable
        const installerPath = path.join(this.rootDir, 'Inferno-Console-Installer.exe');
        const outputPath = path.join(this.outputDir, 'Inferno-Console-Installer.exe');
        
        if (await fs.pathExists(installerPath)) {
            await fs.copy(installerPath, outputPath);
            console.log('✅ Installer copied to output directory');
            
            // Get file size
            const stats = await fs.stat(outputPath);
            const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`📊 Installer size: ${fileSizeMB} MB`);
        } else {
            throw new Error('Installer executable not found');
        }
    }
}

// Run the build
const builder = new NativeInstallerBuilder();
builder.build().catch(error => {
    console.error('\n❌ BUILD FAILED:', error.message);
    process.exit(1);
});
