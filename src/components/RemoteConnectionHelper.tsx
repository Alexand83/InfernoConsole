import React, { useState } from 'react'

interface RemoteConnectionHelperProps {
  onClose: () => void
}

const RemoteConnectionHelper: React.FC<RemoteConnectionHelperProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'webrtc' | 'alternatives'>('webrtc')

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-dj-dark border border-dj-accent rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-dj-accent">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">🌐 Connessioni Remote - Guida Completa</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4">
          {/* Tab Navigation */}
          <div className="flex space-x-2 mb-6">
            <button
              onClick={() => setActiveTab('webrtc')}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === 'webrtc'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🎵 WebRTC (Attuale)
            </button>
            <button
              onClick={() => setActiveTab('alternatives')}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === 'alternatives'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🚀 Alternative Semplici
            </button>
          </div>

          {activeTab === 'webrtc' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded">
                <h3 className="text-blue-400 font-semibold mb-3">🎵 WebRTC per DJ Remoti</h3>
                
                <div className="space-y-4 text-sm text-gray-300">
                  <div>
                    <h4 className="text-white font-medium mb-2">✅ Vantaggi:</h4>
                    <ul className="list-disc pl-4 space-y-1 text-xs">
                      <li>Audio in tempo reale, latenza ultra-bassa (&lt;50ms)</li>
                      <li>Perfetto per DJ che vogliono mixare insieme</li>
                      <li>Push-to-Talk integrato</li>
                      <li>Chat in tempo reale</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-white font-medium mb-2">⚙️ Configurazione per Internet:</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-green-800/20 border border-green-600/30 rounded">
                        <div className="font-medium text-green-400 mb-2">🌟 Opzione 1: Localtunnel (Facile)</div>
                        <div className="text-xs space-y-2">
                          <div>1. Apri il terminale/PowerShell</div>
                          <div>2. Esegui: <code className="bg-black/50 px-1 rounded">npx localtunnel --port 8080</code></div>
                          <div>3. Ti darà un URL tipo: <code className="bg-black/50 px-1 rounded">https://abc123.loca.lt</code></div>
                          <div>4. I client useranno: <code className="bg-black/50 px-1 rounded">abc123.loca.lt</code> (senza https://)</div>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-800/20 border border-blue-600/30 rounded">
                        <div className="font-medium text-blue-400 mb-2">💎 Opzione 2: Ngrok (Professionale)</div>
                        <div className="text-xs space-y-2">
                          <div>1. Installa ngrok da <a href="https://ngrok.com" className="underline">ngrok.com</a></div>
                          <div>2. Esegui: <code className="bg-black/50 px-1 rounded">ngrok http 8080</code></div>
                          <div>3. URL più stabile e veloce</div>
                        </div>
                      </div>

                      <div className="p-3 bg-orange-800/20 border border-orange-600/30 rounded">
                        <div className="font-medium text-orange-400 mb-2">🔧 Opzione 3: Port Forwarding Manuale</div>
                        <div className="text-xs space-y-2">
                          <div>1. Router → Port Forwarding</div>
                          <div>2. Porta 8080 → IP locale</div>
                          <div>3. Usa IP pubblico per connessioni</div>
                          <div>4. Più stabile ma richiede configurazione router</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'alternatives' && (
            <div className="space-y-6">
              <div className="p-4 bg-green-900/20 border border-green-500/30 rounded">
                <h3 className="text-green-400 font-semibold mb-3">🚀 Alternative Più Semplici</h3>
                
                <div className="space-y-4">
                  <div className="p-3 bg-purple-800/20 border border-purple-600/30 rounded">
                    <h4 className="text-purple-400 font-medium mb-2">💬 Discord/TeamSpeak</h4>
                    <div className="text-xs text-gray-300 space-y-1">
                      <div>✅ <strong>Pro:</strong> Facilissimo da usare, qualità audio buona</div>
                      <div>❌ <strong>Contro:</strong> Latenza più alta (~100-200ms), non ideale per DJ sync</div>
                      <div>🎯 <strong>Ideale per:</strong> Comunicazione durante stream, non per mixaggio sincronizzato</div>
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-800/20 border border-indigo-600/30 rounded">
                    <h4 className="text-indigo-400 font-medium mb-2">🎥 Zoom/Google Meet</h4>
                    <div className="text-xs text-gray-300 space-y-1">
                      <div>✅ <strong>Pro:</strong> Condivisione schermo + audio, facilissimo</div>
                      <div>❌ <strong>Contro:</strong> Latenza alta, compressione audio</div>
                      <div>🎯 <strong>Ideale per:</strong> Show/tutorial, non per performance live</div>
                    </div>
                  </div>

                  <div className="p-3 bg-teal-800/20 border border-teal-600/30 rounded">
                    <h4 className="text-teal-400 font-medium mb-2">📱 WhatsApp/Telegram</h4>
                    <div className="text-xs text-gray-300 space-y-1">
                      <div>✅ <strong>Pro:</strong> Tutti ce l'hanno, audio decente</div>
                      <div>❌ <strong>Contro:</strong> Latenza alta, qualità limitata</div>
                      <div>🎯 <strong>Ideale per:</strong> Coordinamento rapido, non per audio professionale</div>
                    </div>
                  </div>

                  <div className="p-3 bg-pink-800/20 border border-pink-600/30 rounded">
                    <h4 className="text-pink-400 font-medium mb-2">🎧 Parsec/Steam Remote Play</h4>
                    <div className="text-xs text-gray-300 space-y-1">
                      <div>✅ <strong>Pro:</strong> Controllo completo del PC, audio perfetto</div>
                      <div>❌ <strong>Contro:</strong> Richiede banda alta, controllo totale del PC</div>
                      <div>🎯 <strong>Ideale per:</strong> Controllo completo della console DJ</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-800/20 border border-yellow-600/30 rounded">
                  <div className="text-yellow-300 text-xs">
                    💡 <strong>Raccomandazione:</strong> Per performance live profesionali, usa WebRTC con tunnel. 
                    Per comunicazione normale, Discord/Zoom vanno benissimo.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-dj-accent">
          <button 
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
          >
            Chiudi Guida
          </button>
        </div>
      </div>
    </div>
  )
}

export default RemoteConnectionHelper

