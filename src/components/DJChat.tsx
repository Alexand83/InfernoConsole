import React, { useState, useEffect, useRef } from 'react'
import { Send, MessageCircle, Users } from 'lucide-react'

interface ChatMessage {
  id: string
  djName: string
  message: string
  timestamp: Date
  isSystem: boolean
}

interface DJChatProps {
  connectedDJs: Array<{ id: string; djName: string }>
  onSendMessage?: (message: string) => void
  messages?: ChatMessage[]
}

const DJChat: React.FC<DJChatProps> = ({ connectedDJs, onSendMessage, messages = [] }) => {
  const [newMessage, setNewMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (newMessage.trim() && onSendMessage) {
      onSendMessage(newMessage.trim())
      setNewMessage('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="bg-dj-primary border border-dj-accent rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-dj-accent" />
          <span>Chat DJ</span>
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-dj-light">
            <Users className="w-4 h-4 inline mr-1" />
            {connectedDJs.length}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-dj-accent hover:text-white transition-colors"
            title={isExpanded ? 'Riduci chat' : 'Espandi chat'}
          >
            {isExpanded ? '📉' : '📈'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Lista messaggi */}
          <div className="bg-dj-dark rounded-md p-3 mb-3 h-48 overflow-y-auto border border-dj-accent/20">
            {messages.length === 0 ? (
              <div className="text-center text-dj-light/70 py-8">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <div>Nessun messaggio</div>
                <div className="text-xs mt-1">Inizia una conversazione!</div>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-md ${
                      msg.isSystem
                        ? 'bg-blue-900/20 text-blue-300 text-xs'
                        : 'bg-dj-primary border border-dj-accent/20'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        {!msg.isSystem && (
                          <span className="font-semibold text-dj-accent text-sm">
                            {msg.djName}:
                          </span>
                        )}
                        <span className={`ml-1 ${msg.isSystem ? 'text-xs' : 'text-sm'}`}>
                          {msg.message}
                        </span>
                      </div>
                      <span className="text-xs text-dj-light/50 ml-2">
                        {msg.timestamp ? msg.timestamp.toLocaleTimeString('it-IT', {
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input messaggio */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Scrivi un messaggio..."
              className="flex-1 p-2 bg-dj-dark border border-dj-accent/50 rounded-md text-white placeholder-dj-light/50 focus:ring-2 focus:ring-dj-accent focus:border-transparent"
              maxLength={200}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="px-4 py-2 bg-dj-accent hover:bg-dj-accent-dark disabled:bg-dj-accent/50 text-white rounded-md transition-colors flex items-center space-x-1"
            >
              <Send className="w-4 h-4" />
              <span>Invia</span>
            </button>
          </div>
        </>
      )}

      {!isExpanded && messages.length > 0 && (
        <div className="text-sm text-dj-light/70">
          {messages.length} messaggio{messages.length !== 1 ? 'i' : ''} - Clicca per espandere
        </div>
      )}
    </div>
  )
}

export default DJChat
