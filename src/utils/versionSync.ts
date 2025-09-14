// Utility per sincronizzare la versione con package.json e GitHub
import packageJson from '../../package.json';

export interface VersionInfo {
  version: string;
  buildDate: string;
  gitCommit?: string;
  gitBranch?: string;
  buildNumber?: string;
}

/**
 * Ottiene la versione dal package.json
 */
export function getAppVersion(): string {
  return packageJson.version;
}

/**
 * Ottiene informazioni complete sulla versione
 */
export function getVersionInfo(): VersionInfo {
  const version = getAppVersion();
  const buildDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return {
    version,
    buildDate,
    // In futuro possiamo aggiungere git commit e branch
    // gitCommit: process.env.GIT_COMMIT,
    // gitBranch: process.env.GIT_BRANCH,
    // buildNumber: process.env.BUILD_NUMBER,
  };
}

/**
 * Formatta la versione per display
 */
export function formatVersion(versionInfo: VersionInfo): string {
  return `${versionInfo.version} (${versionInfo.buildDate})`;
}

/**
 * Controlla se c'è una nuova versione disponibile
 * (per auto-update)
 */
export async function checkForUpdates(): Promise<{
  hasUpdate: boolean;
  latestVersion?: string;
  currentVersion: string;
}> {
  const currentVersion = getAppVersion();
  
  try {
    // In futuro possiamo controllare GitHub API per nuove versioni
    // const response = await fetch('https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest');
    // const data = await response.json();
    // const latestVersion = data.tag_name.replace('v', '');
    
    return {
      hasUpdate: false, // Per ora sempre false
      currentVersion,
    };
  } catch (error) {
    console.error('Errore nel controllo aggiornamenti:', error);
    return {
      hasUpdate: false,
      currentVersion,
    };
  }
}

/**
 * Ottiene il changelog per la versione corrente
 */
export function getChangelog(): string[] {
  const version = getAppVersion();
  
  // Changelog per versione
  const changelogs: Record<string, string[]> = {
    '1.0.3': [
      '🎨 Aggiunta icona personalizzata InfernoConsole',
      '🔧 Fix build GitHub Actions',
      '🚀 Sistema auto-update configurato',
      '🎵 Migliorato sistema streaming continuo',
      '🐛 Fix auto-reconnessione dopo disconnessione manuale'
    ],
    '1.0.2': [
      '🔧 Fix configurazione GitHub Actions',
      '📦 Build Windows e macOS ottimizzate',
      '🎵 Sistema streaming migliorato'
    ],
    '1.0.1': [
      '🎵 Prime funzionalità DJ Console',
      '🎛️ Mixer audio integrato',
      '📻 Streaming Icecast supportato'
    ],
    '1.0.0': [
      '🎉 Prima release di InfernoConsole',
      '🎵 Sistema DJ Console completo',
      '🎛️ Mixer professionale',
      '📻 Streaming live supportato'
    ]
  };
  
  return changelogs[version] || ['📝 Versione in sviluppo'];
}
