import React, { useState } from 'react'
import { Server, Wifi, WifiOff, TestTube, Save, Globe, Shield, Settings } from 'lucide-react'

interface IcecastServer {
  id: string
  name: string
  host: string
  port: number
  username: string
  password: string
  mountpoint: string
  isDefault: boolean
}

interface IcecastConfigProps {
  onServerSelect?: (server: IcecastServer) => void
  onTestConnection?: (server: IcecastServer) => Promise<boolean>
}

const IcecastConfig: React.FC<IcecastConfigProps> = ({
  onServerSelect,
  onTestConnection
}) => {
  const [servers, setServers] = useState<IcecastServer[]>([
    {
      id: 'local',
      name: 'Local Server',
      host: 'localhost',
      port: 5040,
      username: '',
      password: '',
      mountpoint: '/icecast',
      isDefault: true
    }
  ])
  
  const [selectedServer, setSelectedServer] = useState<string>('local')
  const [showAddForm, setShowAddForm] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [connectionMessage, setConnectionMessage] = useState('')

  const [newServer, setNewServer] = useState<Omit<IcecastServer, 'id'>>({
    name: '',
    host: '',
    port: 5040,
    username: '',
    password: '',
    mountpoint: '/live',
    isDefault: false
  })

  const handleAddServer = () => {
    if (!newServer.name || !newServer.host) return

    const server: IcecastServer = {
      ...newServer,
      id: `server_${Date.now()}`,
      isDefault: false
    }

    setServers([...servers, server])
    setSelectedServer(server.id)
    setShowAddForm(false)
    setNewServer({
      name: '',
      host: '',
      port: 5040,
      username: '',
      password: '',
      mountpoint: '/live',
      isDefault: false
    })

    onServerSelect?.(server)
  }

  const handleDeleteServer = (serverId: string) => {
    if (servers.find(s => s.id === serverId)?.isDefault) return
    
    const updatedServers = servers.filter(s => s.id !== serverId)
    setServers(updatedServers)
    
    if (selectedServer === serverId) {
      setSelectedServer(servers.find(s => s.isDefault)?.id || 'local')
    }
  }

  const handleServerSelect = (serverId: string) => {
    setSelectedServer(serverId)
    const server = servers.find(s => s.id === serverId)
    if (server) {
      onServerSelect?.(server)
    }
  }

  const handleTestConnection = async (server: IcecastServer) => {
    setTestingConnection(true)
    setConnectionStatus('testing')
    setConnectionMessage('Testing connection...')

    try {
      if (onTestConnection) {
        const success = await onTestConnection(server)
        if (success) {
          setConnectionStatus('success')
          setConnectionMessage('Connection successful!')
        } else {
          setConnectionStatus('error')
          setConnectionMessage('Connection failed. Check your settings.')
        }
      } else {
        // Default connection test
        const url = `http://${server.host}:${server.port}${server.mountpoint}`
        const response = await fetch(url, { method: 'HEAD' })
        
        if (response.ok) {
          setConnectionStatus('success')
          setConnectionMessage('Connection successful!')
        } else {
          setConnectionStatus('error')
          setConnectionMessage(`HTTP ${response.status}: ${response.statusText}`)
        }
      }
    } catch (error) {
      setConnectionStatus('error')
      setConnectionMessage(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setTestingConnection(false)
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'success': return 'text-dj-success'
      case 'error': return 'text-dj-error'
      case 'testing': return 'text-dj-warning'
      default: return 'text-dj-light/60'
    }
  }

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'success': return <Wifi className="w-4 h-4 text-dj-success" />
      case 'error': return <WifiOff className="w-4 h-4 text-dj-error" />
      case 'testing': return <TestTube className="w-4 h-4 text-dj-warning animate-spin" />
      default: return <Wifi className="w-4 h-4 text-dj-light/60" />
    }
  }

  const getServerUrl = (server: IcecastServer) => {
    return `http://${server.host}:${server.port}${server.mountpoint}`
  }

  const getWebSocketUrl = (server: IcecastServer) => {
    return `ws://${server.host}:${server.port}`
  }

  return (
    <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Globe className="w-5 h-5 text-dj-highlight" />
          <h3 className="text-lg font-dj font-bold text-white">Icecast Server Configuration</h3>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1 bg-dj-accent hover:bg-dj-highlight text-white rounded-lg transition-all duration-200 text-sm"
        >
          {showAddForm ? 'Cancel' : 'Add Server'}
        </button>
      </div>

      {/* Add Server Form */}
      {showAddForm && (
        <div className="bg-dj-secondary rounded-lg p-4 mb-4 border border-dj-accent/20">
          <h4 className="text-sm font-medium text-white mb-3">Add New Icecast Server</h4>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Server Name</label>
              <input
                type="text"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
                placeholder="My Radio Server"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Host/IP</label>
              <input
                type="text"
                value={newServer.host}
                onChange={(e) => setNewServer({ ...newServer, host: e.target.value })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
                placeholder="icecast.mydomain.com"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Port</label>
              <input
                type="number"
                value={newServer.port}
                onChange={(e) => setNewServer({ ...newServer, port: parseInt(e.target.value) })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
                min="1"
                max="65535"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Mountpoint</label>
              <input
                type="text"
                value={newServer.mountpoint}
                onChange={(e) => setNewServer({ ...newServer, mountpoint: e.target.value })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
                placeholder="/live"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Username</label>
              <input
                type="text"
                value={newServer.username}
                onChange={(e) => setNewServer({ ...newServer, username: e.target.value })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
                placeholder="source"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Password</label>
              <input
                type="password"
                value={newServer.password}
                onChange={(e) => setNewServer({ ...newServer, password: e.target.value })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
                placeholder="hackme"
              />
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleAddServer}
              className="px-4 py-2 bg-dj-highlight hover:bg-dj-accent text-white rounded-lg transition-all duration-200"
            >
              Add Server
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-dj-secondary hover:bg-dj-accent text-dj-light rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Server List */}
      <div className="space-y-3">
        {servers.map((server) => (
          <div
            key={server.id}
            className={`bg-dj-secondary rounded-lg p-3 border transition-all duration-200 ${
              selectedServer === server.id 
                ? 'border-dj-highlight bg-dj-accent/20' 
                : 'border-dj-accent/20 hover:border-dj-accent/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Server className="w-4 h-4 text-dj-accent" />
                <h5 className="font-medium text-white">{server.name}</h5>
                {server.isDefault && (
                  <span className="text-xs px-2 py-1 bg-dj-highlight text-white rounded-full">
                    Default
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleTestConnection(server)}
                  disabled={testingConnection}
                  className="p-1 hover:bg-dj-accent rounded transition-all duration-200"
                  title="Test Connection"
                >
                  <TestTube className="w-4 h-4 text-dj-accent" />
                </button>
                
                {!server.isDefault && (
                  <button
                    onClick={() => handleDeleteServer(server.id)}
                    className="p-1 hover:bg-dj-accent rounded transition-all duration-200"
                    title="Delete Server"
                  >
                    <Settings className="w-4 h-4 text-dj-light/60" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <span className="text-dj-light/60">Host:</span>
                <div className="text-white">{server.host}:{server.port}</div>
              </div>
              
              <div>
                <span className="text-dj-light/60">Mountpoint:</span>
                <div className="text-white">{server.mountpoint}</div>
              </div>
              
              {server.username && (
                <div>
                  <span className="text-dj-light/60">Username:</span>
                  <div className="text-white">{server.username}</div>
                </div>
              )}
              
              <div>
                <span className="text-dj-light/60">Status:</span>
                <div className="flex items-center space-x-2">
                  {getConnectionStatusIcon()}
                  <span className={getConnectionStatusColor()}>
                    {connectionMessage || 'Not tested'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-dj-light/60">Stream URL:</span>
                <code className="text-xs bg-dj-primary px-2 py-1 rounded text-dj-light">
                  {getServerUrl(server)}
                </code>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-xs text-dj-light/60">WebSocket:</span>
                <code className="text-xs bg-dj-primary px-2 py-1 rounded text-dj-light">
                  {getWebSocketUrl(server)}
                </code>
              </div>
            </div>
            
            <button
              onClick={() => handleServerSelect(server.id)}
              className={`w-full mt-3 py-2 rounded-lg transition-all duration-200 ${
                selectedServer === server.id
                  ? 'bg-dj-highlight text-white'
                  : 'bg-dj-accent hover:bg-dj-highlight text-white'
              }`}
            >
              {selectedServer === server.id ? 'Selected' : 'Select Server'}
            </button>
          </div>
        ))}
      </div>

      {/* Connection Status */}
      {connectionStatus !== 'idle' && (
        <div className="mt-4 p-3 rounded-lg border border-dj-accent/20">
          <div className="flex items-center space-x-2">
            {getConnectionStatusIcon()}
            <span className={`text-sm ${getConnectionStatusColor()}`}>
              {connectionMessage}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default IcecastConfig
