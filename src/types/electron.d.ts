/**
 * Electron API Types
 */

export interface WebSocketServerAPI {
  startServer: (sessionCode: string | null, port: number) => Promise<{
    success: boolean
    port?: number
    sessionCode?: string
    error?: string
  }>
  stopServer: () => Promise<{ success: boolean; error?: string }>
  getClients: () => Promise<{ success: boolean; clients?: any[]; error?: string }>
  getServerInfo: () => Promise<{ success: boolean; info?: any; error?: string }>
  onClientConnected: (callback: (event: any, client: any) => void) => void
  onClientAuthenticated: (callback: (event: any, client: any) => void) => void
  onClientDisconnected: (callback: (event: any, client: any) => void) => void
  onAudioData: (callback: (event: any, data: any) => void) => void
  onMicrophoneStatus: (callback: (event: any, data: any) => void) => void
  removeAllListeners: () => void
}

export interface CloudflareTunnelAPI {
  createTunnel: (port: number) => Promise<{
    success: boolean
    tunnelInfo?: any
    error?: string
  }>
  closeTunnel: () => Promise<{ success: boolean; error?: string }>
}

export interface ElectronAPI {
  websocketServerAPI: WebSocketServerAPI
  cloudflareTunnelAPI: CloudflareTunnelAPI
}

declare global {
  interface Window {
    websocketServerAPI?: WebSocketServerAPI
    cloudflareTunnelAPI?: CloudflareTunnelAPI
    electronAPI?: ElectronAPI
  }
}

