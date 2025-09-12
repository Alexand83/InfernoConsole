const path = require('path');

module.exports = {
  // Configurazione specifica per Windows
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'ia32']
      },
      {
        target: 'portable',
        arch: ['x64']
      }
    ],
    artifactName: 'DJ-Console-${version}-win-${arch}.${ext}',
    requestedExecutionLevel: 'asInvoker',
    icon: path.join(__dirname, 'icon.ico'),
    publisherName: 'DJ Console Team',
    verifyUpdateCodeSignature: false,
    signAndEditExecutable: false
  },
  
  // Configurazione NSIS per l'installer
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    installerIcon: path.join(__dirname, 'icon.ico'),
    uninstallerIcon: path.join(__dirname, 'icon.ico'),
    installerHeaderIcon: path.join(__dirname, 'icon.ico'),
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'DJ Console',
    include: path.join(__dirname, 'installer.nsh'),
    perMachine: false,
    deleteAppDataOnUninstall: true,
    displayLanguageSelector: true,
    languages: ['Italian', 'English'],
    license: path.join(__dirname, 'LICENSE.txt'),
    welcomeImage: path.join(__dirname, 'welcome.bmp'),
    headerImage: path.join(__dirname, 'header.bmp')
  },
  
  // Configurazione per il packaging
  files: [
    'dist/**',
    'electron/**',
    'package.json',
    'node_modules/@ffmpeg-installer/**'
  ],
  
  // Configurazione ASAR
  asar: true,
  asarUnpack: [
    'node_modules/@ffmpeg-installer/**',
    'node_modules/ffmpeg-static/**'
  ],
  
  // Configurazione per le dipendenze
  extraResources: [
    {
      from: 'node_modules/@ffmpeg-installer/ffmpeg.exe',
      to: 'ffmpeg.exe'
    }
  ],
  
  // Configurazione per la compressione
  compression: 'maximum',
  
  // Configurazione per i file di output
  outputDir: 'dist-electron',
  
  // Configurazione per il nome dell'app
  productName: 'DJ Console',
  appId: 'com.djconsole.app',
  
  // Configurazione per la versione
  generateUpdatesFilesForAllChannels: false,
  publish: null
};
