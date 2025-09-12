// Configurazione per il sistema di aggiornamenti
export const updateConfig = {
  // URL per verificare gli aggiornamenti
  // Puoi usare:
  // - GitHub API: 'https://api.github.com/repos/username/repo/releases/latest'
  // - Il tuo server: 'https://your-server.com/api/updates'
  // - Un file JSON statico: 'https://your-server.com/updates.json'
  updateUrl: 'https://api.github.com/repos/your-username/djconsole/releases/latest',
  
  // Versione attuale dell'applicazione
  currentVersion: '1.0.0',
  
  // Nome dell'applicazione
  appName: 'DJ Console',
  
  // Intervallo di controllo automatico (in millisecondi)
  // 0 = disabilitato, 3600000 = 1 ora, 86400000 = 24 ore
  checkInterval: 0,
  
  // Mostra notifiche per aggiornamenti disponibili
  showNotifications: true,
  
  // URL per scaricare l'applicazione
  downloadUrl: 'https://github.com/your-username/djconsole/releases',
  
  // URL per il changelog
  changelogUrl: 'https://github.com/your-username/djconsole/blob/main/CHANGELOG.md',
  
  // Configurazione per GitHub API
  github: {
    // Token per aumentare il rate limit (opzionale)
    token: '',
    // Repository owner
    owner: 'your-username',
    // Repository name
    repo: 'djconsole'
  }
}

// Esempio di formato JSON per il tuo server
export const exampleUpdateJson = {
  version: '1.0.1',
  releaseDate: '2024-12-20T10:00:00Z',
  downloadUrl: 'https://github.com/your-username/djconsole/releases/download/v1.0.1/djconsole-1.0.1.zip',
  changelog: [
    'Corretto bug nella sincronizzazione playlist',
    'Migliorata interfaccia utente',
    'Aggiunto supporto per nuovi formati audio'
  ],
  minSystemVersion: '1.0.0',
  critical: false
}

// Funzione per generare URL GitHub API
export const getGitHubApiUrl = (owner: string, repo: string) => {
  return `https://api.github.com/repos/${owner}/${repo}/releases/latest`
}

// Funzione per verificare se l'URL è valido
export const isValidUpdateUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
