import React, { useState, useEffect, useRef } from 'react'
import { Send, MessageCircle, Users, Smile } from 'lucide-react'
import EmojiPicker from './EmojiPicker'
import { getDJColorByName } from '../utils/djColors'

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ✅ DEBUG: Log dei messaggi per debug
  useEffect(() => {
    console.log('🐛 [DJChat] Messages received:', messages)
    console.log('🐛 [DJChat] Messages type:', typeof messages)
    console.log('🐛 [DJChat] Messages isArray:', Array.isArray(messages))
    if (messages.length > 0) {
      console.log('🐛 [DJChat] First message:', messages[0])
      console.log('🐛 [DJChat] First message type:', typeof messages[0])
    }
  }, [messages])

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

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji)
    setShowEmojiPicker(false)
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
                {Array.isArray(messages) ? messages
                  .filter(msg => {
                    // ✅ Filtra solo messaggi validi
                    if (!msg || typeof msg !== 'object') {
                      console.warn('🐛 [DJChat] Messaggio non valido filtrato:', msg)
                      return false
                    }
                    if (!msg.id || !msg.djName) {
                      console.warn('🐛 [DJChat] Messaggio malformato filtrato:', msg)
                      return false
                    }
                    return true
                  })
                  .map((msg) => {
                    // ✅ CRITICAL FIX: Assicurati che il message sia stringa
                    const messageText = typeof msg.message === 'string' ? msg.message : 
                                       typeof msg.message === 'object' ? JSON.stringify(msg.message) :
                                       String(msg.message || '')

                    // ✅ NEW: Ottieni colore del DJ
                    const djColor = getDJColorByName(msg.djName)
                    const djColorStyle = djColor ? { color: djColor.color } : {}

                    return (
                      <div
                        key={msg.id}
                        className={`p-2 rounded text-xs mb-1 ${
                          msg.isSystem
                            ? 'bg-blue-900/20 text-blue-300'
                            : 'bg-gray-800 text-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            {!msg.isSystem && (
                              <span 
                                className="font-medium"
                                style={djColorStyle}
                              >
                                {msg.djName}:
                              </span>
                            )}
                            <span className="ml-1 text-sm">
                              {messageText}
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
                    )
                  }) : []}
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
              onClick={() => setShowEmojiPicker(true)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors flex items-center"
              title="Aggiungi emoji"
            >
              <Smile className="w-3 h-3" />
            </button>
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

      {/* Emoji Picker */}
      <EmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
      />
    </div>
  )
}

export default DJChat
