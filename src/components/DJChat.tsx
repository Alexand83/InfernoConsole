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
  onMessagesChange?: (messages: ChatMessage[]) => void
}

const DJChat: React.FC<DJChatProps> = ({ connectedDJs, onSendMessage, messages = [], onMessagesChange }) => {
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

  const removeMessage = (messageId: string) => {
    if (onMessagesChange) {
      const updatedMessages = messages.filter(msg => msg.id !== messageId)
      onMessagesChange(updatedMessages)
    }
  }

  return (
    <div className="bg-gray-800">
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <h3 className="text-xs font-medium text-white flex items-center space-x-1">
          <MessageCircle className="w-3 h-3 text-gray-400" />
          <span>Chat DJ</span>
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            <Users className="w-3 h-3 inline mr-1" />
            {connectedDJs.length}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white transition-colors text-xs"
            title={isExpanded ? 'Riduci chat' : 'Espandi chat'}
          >
            {isExpanded ? '📉' : '📈'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Lista messaggi */}
          <div className="bg-gray-900 p-2 mb-2 h-32 overflow-y-auto border-t border-gray-700">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                <MessageCircle className="w-4 h-4 mx-auto mb-1 opacity-50" />
                <div className="text-xs">Nessun messaggio</div>
                <div className="text-xs mt-1">Inizia una conversazione!</div>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-1 rounded text-xs ${
                      msg.isSystem
                        ? 'bg-blue-900/20 text-blue-300'
                        : 'bg-gray-800 text-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        {!msg.isSystem && (
                          <span className="font-medium text-blue-400">
                            {msg.djName}:
                          </span>
                        )}
                        <span className="ml-1">
                          {msg.message}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {msg.timestamp ? (() => {
                          try {
                            const date = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
                            return date.toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          } catch {
                            return 'N/A'
                          }
                        })() : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input messaggio */}
          <div className="flex space-x-1 p-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Scrivi un messaggio..."
              className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              maxLength={200}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-xs rounded transition-colors flex items-center space-x-1"
            >
              <Send className="w-3 h-3" />
              <span>Invia</span>
            </button>
          </div>
        </>
      )}

      {!isExpanded && messages.length > 0 && (
        <div className="text-xs text-gray-400 p-2 text-center">
          {messages.length} messaggio{messages.length !== 1 ? 'i' : ''} - Clicca per espandere
        </div>
      )}
    </div>
  )
}

export default DJChat
