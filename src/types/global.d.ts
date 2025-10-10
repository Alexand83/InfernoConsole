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
      // getAppPath: RIMOSSO per versione portabile
      
      // Proxy APIs
      'get-proxy-stats': () => Promise<{ success: boolean; stats?: any; error?: string }>
      'test-all-proxies': () => Promise<{ success: boolean; workingProxies?: any[]; error?: string }>
      'add-proxy': (proxyConfig: any) => Promise<{ success: boolean; error?: string }>
      'remove-proxy': (host: string, port: number) => Promise<{ success: boolean; error?: string }>
      'force-proxy-rotation': () => Promise<{ success: boolean; proxy?: any; error?: string }>
      
      // VPN APIs
      'get-free-vpns': () => Promise<{ success: boolean; vpns?: any[]; error?: string }>
      'get-premium-vpns': () => Promise<{ success: boolean; vpns?: any[]; error?: string }>
      'get-vpn-status': () => Promise<{ success: boolean; status?: any; error?: string }>
      'connect-vpn': (vpnConfig: any) => Promise<{ success: boolean; status?: any; error?: string }>
      'disconnect-vpn': () => Promise<{ success: boolean; error?: string }>
      'test-vpn-connection': () => Promise<{ success: boolean; ip?: string; error?: string }>
      'get-vpn-countries': () => Promise<{ success: boolean; countries?: string[]; error?: string }>
      'get-vpn-data-usage': () => Promise<{ success: boolean; usage?: number; error?: string }>
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
