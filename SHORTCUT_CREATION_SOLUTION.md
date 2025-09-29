# Soluzione Creazione Shortcut con Path Reale

## Problema
L'applicazione portable non creava automaticamente shortcut che puntassero al path reale dell'applicazione in esecuzione.

## Soluzione Implementata

### 1. Modifiche a `electron/updater.js`

#### Nuova funzione `createShortcutWithRealPath()`
- Rileva il path reale dell'applicazione in esecuzione usando `app.getPath('exe')`
- Verifica se lo shortcut esiste già e se punta al percorso corretto
- Aggiorna lo shortcut solo se necessario

#### Nuova funzione `createShortcutFile()`
- Crea effettivamente il file shortcut usando PowerShell
- Gestisce errori e fallback

#### Modifiche a `createDesktopShortcut()`
- Ora crea sia shortcut desktop che Start Menu
- Usa il path reale dell'applicazione invece di percorsi fissi
- Crea automaticamente le cartelle necessarie

### 2. Modifiche a `electron/main.js`

#### Abilitazione creazione shortcut all'avvio
- Rimosso il commento dalla chiamata a `createDesktopShortcut()`
- Lo shortcut viene creato 5 secondi dopo l'avvio dell'app

### 3. Modifiche a `build/installer.nsh`

#### Shortcut per installer NSIS
- Aggiunta creazione shortcut desktop e Start Menu durante l'installazione
- Aggiunta rimozione shortcut durante la disinstallazione

## Funzionalità

### Shortcut Desktop
- **Percorso**: `%USERPROFILE%\Desktop\Inferno Console.lnk`
- **Target**: Path reale dell'applicazione in esecuzione
- **Working Directory**: Cartella dell'applicazione
- **Icona**: Icona dell'applicazione

### Shortcut Start Menu
- **Percorso**: `%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Inferno Console.lnk`
- **Target**: Path reale dell'applicazione in esecuzione
- **Working Directory**: Cartella dell'applicazione
- **Icona**: Icona dell'applicazione

## Vantaggi

1. **Path Reale**: Gli shortcut puntano sempre al percorso reale dell'applicazione
2. **Aggiornamento Automatico**: Gli shortcut vengono aggiornati automaticamente dopo gli aggiornamenti
3. **Controllo Intelligente**: Verifica se lo shortcut esiste già e se punta al percorso corretto
4. **Fallback**: Sistema di fallback in caso di errori
5. **Portable e Installer**: Funziona sia per la versione portable che per quella installata

## Utilizzo

### Versione Portable
- Gli shortcut vengono creati automaticamente all'avvio dell'app
- Vengono aggiornati automaticamente dopo ogni aggiornamento

### Versione Installer
- Gli shortcut vengono creati durante l'installazione
- Vengono rimossi durante la disinstallazione

## Log

Il sistema genera log dettagliati per il debug:
- `🔧 [UPDATER]` - Log generali dell'updater
- `🔧 [REAL PATH]` - Log specifici per il path reale
- `🔍 [REAL PATH]` - Log di verifica shortcut esistenti
- `✅ [REAL PATH]` - Log di successo
- `❌ [REAL PATH]` - Log di errore

## Test

Per testare la funzionalità:
1. Avvia l'applicazione
2. Controlla che vengano creati gli shortcut sul desktop e nel Start Menu
3. Verifica che gli shortcut puntino al percorso corretto dell'applicazione
4. Dopo un aggiornamento, verifica che gli shortcut vengano aggiornati automaticamente


