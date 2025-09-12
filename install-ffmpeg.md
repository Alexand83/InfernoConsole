# Installazione ffmpeg per Windows

## Metodo 1: Winget (Raccomandato)
```bash
winget install ffmpeg
```

## Metodo 2: Chocolatey
```bash
choco install ffmpeg
```

## Metodo 3: Download manuale
1. Vai su https://ffmpeg.org/download.html#build-windows
2. Scarica la versione "essentials" 
3. Estrai in C:\ffmpeg
4. Aggiungi C:\ffmpeg\bin al PATH di Windows

## Verifica installazione
```bash
ffmpeg -version
```

## Per il nostro test
1. Installa ffmpeg con uno dei metodi sopra
2. Modifica `icecast-test-config.json` con la tua password
3. Esegui: `node test-icecast.js`












