const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ProgressBar = require('progress');

class AppDownloader {
  constructor() {
    this.downloadUrl = 'https://github.com/Alexand83/InfernoConsole/releases/latest/download/Inferno-Console-win.exe';
    this.tempDir = require('os').tmpdir();
  }

  async downloadApp(installPath) {
    try {
      console.log(chalk.blue('🌐 Connessione a GitHub...'));
      
      // Verifica se il file esiste già
      const localPath = path.join(installPath, 'Inferno-Console-win.exe');
      if (await fs.pathExists(localPath)) {
        console.log(chalk.yellow('📁 File già presente, verifica versione...'));
        return localPath;
      }

      // Crea directory temporanea
      const tempFile = path.join(this.tempDir, `inferno-console-${Date.now()}.exe`);
      
      console.log(chalk.blue(`📥 Download da: ${this.downloadUrl}`));
      console.log(chalk.blue(`💾 Salvataggio in: ${tempFile}`));

      // Configura axios per il download
      const response = await axios({
        method: 'GET',
        url: this.downloadUrl,
        responseType: 'stream',
        timeout: 300000, // 5 minuti
        headers: {
          'User-Agent': 'Inferno-Console-Installer/1.0.0'
        }
      });

      const totalSize = parseInt(response.headers['content-length'], 10);
      const progressBar = new ProgressBar(
        '📥 Downloading [:bar] :percent :etas',
        {
          complete: '█',
          incomplete: '░',
          width: 30,
          total: totalSize
        }
      );

      // Stream del download con progress bar
      const writer = fs.createWriteStream(tempFile);
      
      response.data.on('data', (chunk) => {
        progressBar.tick(chunk.length);
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          try {
            console.log(chalk.green('\n✅ Download completato!'));
            
            // Verifica integrità del file
            const stats = await fs.stat(tempFile);
            console.log(chalk.blue(`📊 Dimensioni file: ${(stats.size / 1024 / 1024).toFixed(2)} MB`));
            
            if (stats.size < 1000000) { // Meno di 1MB = probabile errore
              throw new Error('File scaricato troppo piccolo, possibile errore');
            }

            // Copia nella directory di installazione
            console.log(chalk.yellow('📁 Copia nella directory di installazione...'));
            await fs.copy(tempFile, localPath);
            await fs.remove(tempFile);
            
            console.log(chalk.green(`✅ File copiato in: ${localPath}`));
            resolve(localPath);
            
          } catch (error) {
            reject(error);
          }
        });

        writer.on('error', (error) => {
          reject(new Error(`Errore durante il download: ${error.message}`));
        });

        response.data.on('error', (error) => {
          reject(new Error(`Errore di connessione: ${error.message}`));
        });
      });

    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Errore di connessione. Verifica la connessione internet e riprova.');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Timeout durante il download. La connessione è troppo lenta.');
      } else if (error.response && error.response.status === 404) {
        throw new Error('File non trovato su GitHub. Verifica che la release esista.');
      } else {
        throw new Error(`Errore durante il download: ${error.message}`);
      }
    }
  }

  async checkForUpdates() {
    try {
      const response = await axios.get('https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Inferno-Console-Installer/1.0.0'
        }
      });

      return {
        version: response.data.tag_name,
        downloadUrl: response.data.assets.find(asset => 
          asset.name.includes('win.exe')
        )?.browser_download_url || this.downloadUrl,
        publishedAt: response.data.published_at
      };
    } catch (error) {
      console.log(chalk.yellow('⚠️  Impossibile verificare aggiornamenti'));
      return null;
    }
  }

  async verifyDownload(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        throw new Error('Il file scaricato non è valido');
      }

      if (stats.size < 1000000) { // Meno di 1MB
        throw new Error('File troppo piccolo, possibile corruzione');
      }

      console.log(chalk.green(`✅ Verifica completata: ${(stats.size / 1024 / 1024).toFixed(2)} MB`));
      return true;
      
    } catch (error) {
      throw new Error(`Verifica file fallita: ${error.message}`);
    }
  }
}

module.exports = { AppDownloader };
