// Sistema di logging completo per debug

interface LogEntry {
  timestamp: number
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG'
  category: string
  message: string
  data?: any
}

class AudioLogger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private isEnabled = true

  public log(level: LogEntry['level'], category: string, message: string, data?: any): void {
    if (!this.isEnabled) return

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data
    }

    this.logs.push(entry)

    // Limita il numero di log mantenuti
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Log anche nella console per debug immediato
    const consoleMessage = `[${category}] ${message}`
    switch (level) {
      case 'ERROR':
        console.error(consoleMessage, data)
        break
      case 'WARNING':
        console.warn(consoleMessage, data)
        break
      case 'DEBUG':
        console.debug(consoleMessage, data)
        break
      default:
        console.log(consoleMessage, data)
    }
  }

  public info(category: string, message: string, data?: any): void {
    this.log('INFO', category, message, data)
  }

  public warn(category: string, message: string, data?: any): void {
    this.log('WARNING', category, message, data)
  }

  public error(category: string, message: string, data?: any): void {
    this.log('ERROR', category, message, data)
  }

  public debug(category: string, message: string, data?: any): void {
    this.log('DEBUG', category, message, data)
  }

  public getLogs(category?: string, level?: LogEntry['level']): LogEntry[] {
    let filtered = [...this.logs]

    if (category) {
      filtered = filtered.filter(log => log.category === category)
    }

    if (level) {
      filtered = filtered.filter(log => log.level === level)
    }

    return filtered
  }

  public getRecentLogs(minutes: number = 5): LogEntry[] {
    const cutoff = Date.now() - (minutes * 60 * 1000)
    return this.logs.filter(log => log.timestamp > cutoff)
  }

  public clearLogs(): void {
    this.logs = []
    console.log('[AudioLogger] Logs cleared')
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    console.log(`[AudioLogger] Logging ${enabled ? 'enabled' : 'disabled'}`)
  }

  public getStats(): { total: number, byLevel: Record<string, number>, byCategory: Record<string, number> } {
    const byLevel: Record<string, number> = {}
    const byCategory: Record<string, number> = {}

    this.logs.forEach(log => {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1
      byCategory[log.category] = (byCategory[log.category] || 0) + 1
    })

    return {
      total: this.logs.length,
      byLevel,
      byCategory
    }
  }
}

// Istanza singleton
export const audioLogger = new AudioLogger()

// Utility hooks per React
export function useAudioLogger() {
  return audioLogger
}

// Shortcuts per logging rapido
export const logAudio = {
  info: (message: string, data?: any) => audioLogger.info('AUDIO', message, data),
  warn: (message: string, data?: any) => audioLogger.warn('AUDIO', message, data),
  error: (message: string, data?: any) => audioLogger.error('AUDIO', message, data),
  debug: (message: string, data?: any) => audioLogger.debug('AUDIO', message, data)
}

export const logDeck = {
  info: (message: string, data?: any) => audioLogger.info('DECK', message, data),
  warn: (message: string, data?: any) => audioLogger.warn('DECK', message, data),
  error: (message: string, data?: any) => audioLogger.error('DECK', message, data),
  debug: (message: string, data?: any) => audioLogger.debug('DECK', message, data)
}

export const logMixer = {
  info: (message: string, data?: any) => audioLogger.info('MIXER', message, data),
  warn: (message: string, data?: any) => audioLogger.warn('MIXER', message, data),
  error: (message: string, data?: any) => audioLogger.error('MIXER', message, data),
  debug: (message: string, data?: any) => audioLogger.debug('MIXER', message, data)
}

export const logStream = {
  info: (message: string, data?: any) => audioLogger.info('STREAM', message, data),
  warn: (message: string, data?: any) => audioLogger.warn('STREAM', message, data),
  error: (message: string, data?: any) => audioLogger.error('STREAM', message, data),
  debug: (message: string, data?: any) => audioLogger.debug('STREAM', message, data)
}














