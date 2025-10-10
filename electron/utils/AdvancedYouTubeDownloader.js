/**
 * Advanced YouTube Downloader - JavaScript Version
 * Sistema avanzato di download YouTube con multiple strategie di bypass
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const YouTubeProxyManager = require('./YouTubeProxyManager').YouTubeProxyManager

class AdvancedYouTubeDownloader {
  constructor() {
    this.proxyManager = YouTubeProxyManager.getInstance()
    this.ytDlpPath = this.findExecutable('yt-dlp')
    this.youtubeDlPath = this.findExecutable('youtube-dl')
  }

  static getInstance() {
    if (!AdvancedYouTubeDownloader.instance) {
      AdvancedYouTubeDownloader.instance = new AdvancedYouTubeDownloader()
    }
    return AdvancedYouTubeDownloader.instance
  }

  findExecutable(name) {
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules', '.bin', name),
      path.join(process.cwd(), 'node_modules', '.bin', name + '.exe'),
      name, // Assume it's in PATH
      name + '.exe'
    ]

    for (const exePath of possiblePaths) {
      if (fs.existsSync(exePath)) {
        return exePath
      }
    }

    return name // Fallback to name, let the system find it
  }

  async downloadAudio(options) {
    // Prima prova senza proxy (più veloce)
    const strategies = [
      { name: 'yt-dlp', method: this.downloadWithYtDlp.bind(this), priority: 1 },
      { name: 'youtube-dl', method: this.downloadWithYoutubeDl.bind(this), priority: 2 },
      { name: 'yt-dlp-proxy', method: this.downloadWithYtDlpProxy.bind(this), priority: 3 },
      { name: 'youtube-dl-proxy', method: this.downloadWithYoutubeDlProxy.bind(this), priority: 4 }
    ]

    // Ordina per priorità
    strategies.sort((a, b) => a.priority - b.priority)

    for (const strategy of strategies) {
      try {
        console.log(`🔄 [DOWNLOAD] Tentativo con strategia: ${strategy.name}`)
        const result = await strategy.method(options)
        
        if (result.success) {
          console.log(`✅ [DOWNLOAD] Successo con strategia: ${strategy.name}`)
          return { ...result, method: strategy.name }
        }
      } catch (error) {
        console.warn(`⚠️ [DOWNLOAD] Strategia ${strategy.name} fallita:`, error.message)
        
        // Se è un errore di proxy, salta le strategie proxy
        if (strategy.name.includes('proxy') && 
            (error.message.includes('ECONNREFUSED') || 
             error.message.includes('ETIMEDOUT') || 
             error.message.includes('Nessun proxy disponibile'))) {
          console.log(`🔄 [DOWNLOAD] Saltando strategie proxy per errori di connessione`)
          break
        }
        continue
      }
    }

    throw new Error('Tutte le strategie di download hanno fallito')
  }

  async downloadWithYtDlp(options) {
    return new Promise((resolve, reject) => {
      const outputTemplate = path.join(options.outputPath, '%(title)s.%(ext)s')
      
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', options.quality,
        '--output', outputTemplate,
        '--no-warnings',
        '--no-check-certificates',
        '--user-agent', this.proxyManager.getRandomUserAgent(),
        '--add-header', 'referer:youtube.com',
        '--sleep-interval', '1',
        '--max-sleep-interval', '5',
        '--retries', (options.retries || 3).toString(),
        '--fragment-retries', '3',
        '--ignore-errors',
        '--no-playlist',
        '--prefer-free-formats',
        '--extractor-retries', '3',
        '--socket-timeout', (options.timeout || 30).toString(),
        options.url
      ]

      console.log(`🎵 [YT-DLP] Comando: ${this.ytDlpPath} ${args.join(' ')}`)

      const process = spawn(this.ytDlpPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.handleDownloadProcess(process, options, resolve, reject)
    })
  }

  async downloadWithYoutubeDl(options) {
    return new Promise((resolve, reject) => {
      const outputTemplate = path.join(options.outputPath, '%(title)s.%(ext)s')
      
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', options.quality,
        '--output', outputTemplate,
        '--no-warnings',
        '--no-check-certificates',
        '--user-agent', this.proxyManager.getRandomUserAgent(),
        '--add-header', 'referer:youtube.com',
        '--sleep-interval', '1',
        '--max-sleep-interval', '5',
        '--retries', (options.retries || 3).toString(),
        '--fragment-retries', '3',
        '--ignore-errors',
        '--no-playlist',
        '--prefer-free-formats',
        options.url
      ]

      console.log(`🎵 [YOUTUBE-DL] Comando: ${this.youtubeDlPath} ${args.join(' ')}`)

      const process = spawn(this.youtubeDlPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.handleDownloadProcess(process, options, resolve, reject)
    })
  }

  async downloadWithYtDlpProxy(options) {
    const proxy = this.proxyManager.getRandomProxy()
    if (!proxy) {
      throw new Error('Nessun proxy disponibile')
    }

    return new Promise((resolve, reject) => {
      const outputTemplate = path.join(options.outputPath, '%(title)s.%(ext)s')
      
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', options.quality,
        '--output', outputTemplate,
        '--no-warnings',
        '--no-check-certificates',
        '--user-agent', this.proxyManager.getRandomUserAgent(),
        '--add-header', 'referer:youtube.com',
        '--proxy', `${proxy.protocol}://${proxy.host}:${proxy.port}`,
        '--sleep-interval', '2',
        '--max-sleep-interval', '10',
        '--retries', (options.retries || 5).toString(),
        '--fragment-retries', '5',
        '--ignore-errors',
        '--no-playlist',
        '--prefer-free-formats',
        '--extractor-retries', '5',
        '--socket-timeout', (options.timeout || 60).toString(),
        options.url
      ]

      console.log(`🎵 [YT-DLP-PROXY] Comando con proxy ${proxy.host}:${proxy.port}: ${this.ytDlpPath} ${args.join(' ')}`)

      const process = spawn(this.ytDlpPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.handleDownloadProcess(process, options, resolve, reject)
    })
  }

  async downloadWithYoutubeDlProxy(options) {
    const proxy = this.proxyManager.getRandomProxy()
    if (!proxy) {
      throw new Error('Nessun proxy disponibile')
    }

    return new Promise((resolve, reject) => {
      const outputTemplate = path.join(options.outputPath, '%(title)s.%(ext)s')
      
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', options.quality,
        '--output', outputTemplate,
        '--no-warnings',
        '--no-check-certificates',
        '--user-agent', this.proxyManager.getRandomUserAgent(),
        '--add-header', 'referer:youtube.com',
        '--proxy', `${proxy.protocol}://${proxy.host}:${proxy.port}`,
        '--sleep-interval', '2',
        '--max-sleep-interval', '10',
        '--retries', (options.retries || 5).toString(),
        '--fragment-retries', '5',
        '--ignore-errors',
        '--no-playlist',
        '--prefer-free-formats',
        options.url
      ]

      console.log(`🎵 [YOUTUBE-DL-PROXY] Comando con proxy ${proxy.host}:${proxy.port}: ${this.youtubeDlPath} ${args.join(' ')}`)

      const process = spawn(this.youtubeDlPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.handleDownloadProcess(process, options, resolve, reject)
    })
  }

  handleDownloadProcess(process, options, resolve, reject) {
    let output = ''
    let errorOutput = ''
    let currentProgress = 0

    // Simula progresso realistico
    const progressInterval = setInterval(() => {
      if (options.downloadId) {
        currentProgress += Math.random() * 10 + 5
        currentProgress = Math.min(95, currentProgress)
        
        // Invia progresso (se disponibile l'event emitter)
        if (process.emit) {
          process.emit('progress', {
            downloadId: options.downloadId,
            percentage: Math.round(currentProgress),
            speed: 'N/A',
            eta: 'N/A'
          })
        }
      }
    }, 2000)

    process.stdout?.on('data', (data) => {
      output += data.toString()
      console.log(`📥 [DOWNLOAD] Output:`, data.toString().trim())
    })

    process.stderr?.on('data', (data) => {
      errorOutput += data.toString()
      console.log(`⚠️ [DOWNLOAD] Error:`, data.toString().trim())
    })

    process.on('close', (code) => {
      clearInterval(progressInterval)
      
      if (code === 0) {
        // Trova il file scaricato
        const files = fs.readdirSync(options.outputPath).filter(file => 
          file.endsWith('.mp3') && file.includes(options.downloadId)
        )
        
        if (files.length > 0) {
          const filePath = path.join(options.outputPath, files[0])
          const title = files[0].replace('.mp3', '').replace(/[^\w\s-]/g, '')
          
          resolve({
            success: true,
            filePath,
            title,
            artist: 'Unknown Artist',
            duration: 0
          })
        } else {
          reject(new Error('File non trovato dopo il download'))
        }
      } else {
        reject(new Error(`Processo terminato con codice ${code}: ${errorOutput}`))
      }
    })

    process.on('error', (error) => {
      clearInterval(progressInterval)
      reject(error)
    })

    // Timeout
    setTimeout(() => {
      if (!process.killed) {
        process.kill()
        reject(new Error('Timeout del download'))
      }
    }, (options.timeout || 300) * 1000)
  }

  async getVideoInfo(url) {
    const strategies = [
      { name: 'yt-dlp-info', method: this.getInfoWithYtDlp.bind(this) },
      { name: 'youtube-dl-info', method: this.getInfoWithYoutubeDl.bind(this) },
      { name: 'yt-dlp-proxy-info', method: this.getInfoWithYtDlpProxy.bind(this) }
    ]

    for (const strategy of strategies) {
      try {
        console.log(`🔄 [INFO] Tentativo con strategia: ${strategy.name}`)
        const result = await strategy.method(url)
        
        if (result) {
          console.log(`✅ [INFO] Successo con strategia: ${strategy.name}`)
          return result
        }
      } catch (error) {
        console.warn(`⚠️ [INFO] Strategia ${strategy.name} fallita:`, error.message)
        continue
      }
    }

    throw new Error('Tutte le strategie di recupero info hanno fallito')
  }

  async getInfoWithYtDlp(url) {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--user-agent', this.proxyManager.getRandomUserAgent(),
        url
      ]

      const process = spawn(this.ytDlpPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      let output = ''

      process.stdout?.on('data', (data) => {
        output += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output)
            resolve(info)
          } catch (error) {
            reject(new Error('Errore parsing JSON info video'))
          }
        } else {
          reject(new Error(`Errore recupero info: codice ${code}`))
        }
      })

      process.on('error', reject)
    })
  }

  async getInfoWithYoutubeDl(url) {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--user-agent', this.proxyManager.getRandomUserAgent(),
        url
      ]

      const process = spawn(this.youtubeDlPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      let output = ''

      process.stdout?.on('data', (data) => {
        output += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output)
            resolve(info)
          } catch (error) {
            reject(new Error('Errore parsing JSON info video'))
          }
        } else {
          reject(new Error(`Errore recupero info: codice ${code}`))
        }
      })

      process.on('error', reject)
    })
  }

  async getInfoWithYtDlpProxy(url) {
    const proxy = this.proxyManager.getRandomProxy()
    if (!proxy) {
      throw new Error('Nessun proxy disponibile')
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--user-agent', this.proxyManager.getRandomUserAgent(),
        '--proxy', `${proxy.protocol}://${proxy.host}:${proxy.port}`,
        url
      ]

      const process = spawn(this.ytDlpPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      let output = ''

      process.stdout?.on('data', (data) => {
        output += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output)
            resolve(info)
          } catch (error) {
            reject(new Error('Errore parsing JSON info video'))
          }
        } else {
          reject(new Error(`Errore recupero info: codice ${code}`))
        }
      })

      process.on('error', reject)
    })
  }

  async testAllMethods(url) {
    const results = []
    
    const methods = [
      { name: 'yt-dlp', test: () => this.getInfoWithYtDlp(url) },
      { name: 'youtube-dl', test: () => this.getInfoWithYoutubeDl(url) },
      { name: 'yt-dlp-proxy', test: () => this.getInfoWithYtDlpProxy(url) }
    ]

    for (const method of methods) {
      try {
        await method.test()
        results.push({ method: method.name, working: true })
      } catch (error) {
        results.push({ method: method.name, working: false, error: error.message })
      }
    }

    return results
  }
}

module.exports = { AdvancedYouTubeDownloader }
