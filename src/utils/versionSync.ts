// Utility per sincronizzare la versione con package.json e GitHub
import packageJson from '../../package.json';

export interface VersionInfo {
  version: string;
  buildDate: string;
  isUpdateAvailable: boolean;
  latestVersion?: string;
  updateDate?: string;
  gitCommit?: string;
  gitBranch?: string;
  buildNumber?: string;
}

// Cache per le informazioni di versione
let cachedVersionInfo: VersionInfo | null = null;

/**
 * Ottiene la versione dal package.json
 */
export function getAppVersion(): string {
  return packageJson.version;
}

/**
 * Formatta la data in italiano
 */
function formatItalianDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome'
  };
  
  return new Intl.DateTimeFormat('it-IT', options).format(date);
}

/**
 * Controlla se ci sono aggiornamenti disponibili
 */
async function checkForUpdates(): Promise<{ latestVersion?: string; isUpdateAvailable: boolean }> {
  try {
    // Controlla GitHub API per la versione più recente
    const response = await fetch('https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const latestVersion = data.tag_name.replace('v', '');
    const currentVersion = getAppVersion();
    
    return {
      latestVersion,
      isUpdateAvailable: currentVersion !== latestVersion
    };
  } catch (error) {
    console.error('Errore nel controllo aggiornamenti:', error);
    return { isUpdateAvailable: false };
  }
}

/**
 * Ottiene informazioni complete sulla versione
 */
export async function getVersionInfo(): Promise<VersionInfo> {
  if (cachedVersionInfo) {
    return cachedVersionInfo;
  }
  
  try {
    const version = getAppVersion();
    const buildDate = formatItalianDate(new Date());
    const updateInfo = await checkForUpdates();
    
    cachedVersionInfo = {
      version,
      buildDate,
      isUpdateAvailable: updateInfo.isUpdateAvailable,
      latestVersion: updateInfo.latestVersion,
      updateDate: updateInfo.isUpdateAvailable ? formatItalianDate(new Date()) : undefined
    };
    
    return cachedVersionInfo;
  } catch (error) {
    console.error('Errore nel recupero informazioni versione:', error);
    cachedVersionInfo = {
      version: 'Unknown',
      buildDate: 'N/A',
      isUpdateAvailable: false
    };
    return cachedVersionInfo;
  }
}

/**
 * Formatta la versione per display
 */
export function formatVersion(versionInfo: VersionInfo): string {
  if (versionInfo.isUpdateAvailable && versionInfo.latestVersion) {
    return `${versionInfo.version} → ${versionInfo.latestVersion} (Aggiornamento disponibile)`;
  }
  return `${versionInfo.version} (${versionInfo.buildDate})`;
}

/**
 * Forza il refresh delle informazioni di versione
 */
export function refreshVersionInfo(): void {
  cachedVersionInfo = null;
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
