const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const uninstallerDir = path.join(__dirname, 'uninstaller-gui');
const outputDir = path.join(__dirname, '..', 'dist-electron');
const outputExe = 'Inferno-Console-Uninstaller.exe';

console.log('\n🗑️ BUILDING CUSTOM UNINSTALLER\n');

// 1. Clean previous uninstaller builds
console.log('🧹 Cleaning previous uninstaller builds...');
const uninstallerExePath = path.join(outputDir, outputExe);
if (fs.existsSync(uninstallerExePath)) {
    fs.removeSync(uninstallerExePath);
}
console.log('✅ Clean completed');

// 2. Create uninstaller executable using electron-builder
console.log('🔨 Creating uninstaller executable...');

// Create electron-builder config for uninstaller
const uninstallerBuilderConfig = {
    "appId": "com.infernoconsole.uninstaller",
    "productName": "Inferno Console Uninstaller",
    "directories": {
        "output": "uninstaller-dist"
    },
    "files": [
        "main-uninstaller.js",
        "index.html",
        "style.css",
        "script.js"
    ],
    "win": {
        "target": "portable",
        "icon": "assets/icon.ico"
    },
    "portable": {
        "artifactName": outputExe
    }
};

const configPath = path.join(uninstallerDir, 'uninstaller-builder.json');
fs.writeFileSync(configPath, JSON.stringify(uninstallerBuilderConfig, null, 2));

// 3. Install dependencies and build
console.log('Installing dependencies...');
execSync('npm install', { cwd: uninstallerDir, stdio: 'inherit' });

console.log('Building uninstaller...');
execSync('npx electron-builder --config uninstaller-builder.json --win', { 
    cwd: uninstallerDir, 
    stdio: 'inherit' 
});

// 4. Move the built uninstaller to output directory
const builtUninstallerPath = path.join(uninstallerDir, 'uninstaller-dist', outputExe);
if (fs.existsSync(builtUninstallerPath)) {
    fs.copySync(builtUninstallerPath, uninstallerExePath);
    console.log('✅ Uninstaller executable built with electron-builder');
} else {
    throw new Error('Uninstaller executable not found after build');
}

// 5. Clean up temporary files
console.log('🧹 Cleaning up...');
fs.removeSync(path.join(uninstallerDir, 'uninstaller-dist'));
fs.removeSync(configPath);

console.log('🎉 UNINSTALLER BUILD COMPLETED!');
console.log(`📁 Output: ${outputDir}`);
console.log(`📦 Uninstaller: ${uninstallerExePath}`);

// Get file size
if (fs.existsSync(uninstallerExePath)) {
    const stats = fs.statSync(uninstallerExePath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Uninstaller size: ${fileSizeInMB} MB`);
}

console.log('🚀 Ready for GitHub Release!');
