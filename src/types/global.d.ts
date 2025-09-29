// Dichiarazioni globali per le API Electron

declare global {
  interface Window {
    // Auto-updater API
    autoUpdater: {
      downloadUpdate: () => Promise<any>
      installUpdate: () => Promise<any>
      resetCache: () => Promise<any>
      forceCheckUpdates: () => Promise<any>
      onDownloadProgress: (callback: (event: any, progress: any) => void) => void
      removeDownloadProgressListener: (callback: (event: any, progress: any) => void) => void
    }
    
    // Electron API
    electronAPI: {
      invoke: (channel: string, data?: any) => Promise<any>
      send: (channel: string, data?: any) => void
      startStreaming: (config: any) => Promise<any>
      notifyConnectionLost: (reason: string) => Promise<any>
      onFFmpegError: (callback: (event: any, error: any) => void) => void
      onFFmpegDisconnected: (callback: (event: any) => void) => void
      onFFmpegConnected: (callback: (event: any) => void) => void
      removeFFmpegListeners: () => void
      on: (event: string, callback: (event: any, data: any) => void) => void
      removeListener: (event: string, callback: (event: any, data: any) => void) => void
      getAppPath: () => Promise<{ success: boolean; exePath?: string; appPath?: string; appDir?: string; platform?: string; error?: string }>
    }
    
    // Desktop Stream API
    desktopStream: {
      start: (options: any) => Promise<any>
      write: (chunk: any) => void
      writeContinuous: (chunk: any) => void
      writeChunk: (chunk: any) => void
      stop: () => Promise<any>
      updateMetadata: (meta: any) => Promise<any>
      pauseInput: () => Promise<any>
      resumeInput: () => Promise<any>
    }
    
    // Logger API
    log: {
      info: (msg: string) => void
      error: (msg: string) => void
      warn: (msg: string) => void
    }
  }
}

export {}
