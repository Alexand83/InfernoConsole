import React, { useState, useEffect } from 'react'
import { AlertTriangle, Play, X } from 'lucide-react'

interface DuplicateTrackDialogProps {
  track: any | null
  activeDeck: 'left' | 'right' | null
  onConfirm: () => void
  onCancel: () => void
  isVisible: boolean
}

const DuplicateTrackDialog: React.FC<DuplicateTrackDialogProps> = ({
  track,
  activeDeck,
  onConfirm,
  onCancel,
  isVisible
}) => {
  const [countdown, setCountdown] = useState(10)
  const [autoConfirm, setAutoConfirm] = useState(false)

  // Countdown automatico
  useEffect(() => {
    if (!isVisible) {
      setCountdown(10)
      return
    }

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (autoConfirm) {
            onConfirm()
          } else {
            onCancel()
          }
          return 10
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible, autoConfirm, onConfirm, onCancel])

  if (!isVisible || !track) return null

  const otherDeck = activeDeck === 'left' ? 'B' : 'A'
  const currentDeck = activeDeck === 'left' ? 'A' : 'B'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-dj-primary border border-dj-accent/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Traccia Duplicata</h3>
            <p className="text-sm text-dj-light/60">Stai caricando la stessa canzone</p>
          </div>
        </div>

        {/* Informazioni traccia */}
        <div className="bg-dj-secondary rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-3 mb-2">
            <Play className="w-5 h-5 text-dj-highlight" />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white truncate">{track.title}</h4>
              <p className="text-sm text-dj-light/60 truncate">{track.artist}</p>
            </div>
          </div>
          
          <div className="text-xs text-dj-light/60 space-y-1">
            <div className="flex justify-between">
              <span>Deck {otherDeck}:</span>
              <span className="text-green-500">GIÀ IN RIPRODUZIONE</span>
            </div>
            <div className="flex justify-between">
              <span>Deck {currentDeck}:</span>
              <span className="text-yellow-500">STA PER ESSERE CARICATA</span>
            </div>
          </div>
        </div>

        {/* Messaggio di avviso */}
        <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-200">
            La traccia <strong>"{track.title}"</strong> è già in riproduzione nel Deck {otherDeck}. 
            Vuoi caricarla comunque nel Deck {currentDeck}?
          </p>
        </div>

        {/* Opzione auto-conferma */}
        <div className="mb-4">
          <label className="flex items-center space-x-2 text-sm text-dj-light/80 cursor-pointer">
            <input
              type="checkbox"
              checked={autoConfirm}
              onChange={(e) => setAutoConfirm(e.target.checked)}
              className="rounded bg-dj-secondary border-dj-accent/30"
            />
            <span>Conferma automaticamente in futuro</span>
          </label>
        </div>

        {/* Countdown */}
        <div className="text-center mb-4">
          <div className="text-xs text-dj-light/60">
            {autoConfirm ? 'Caricamento automatico' : 'Annullamento automatico'} tra
          </div>
          <div className="text-2xl font-bold text-white">{countdown}s</div>
        </div>

        {/* Pulsanti */}
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>Annulla</span>
          </button>
          
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-dj-highlight hover:bg-dj-accent text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>Carica Comunque</span>
          </button>
        </div>

        {/* Info aggiuntiva */}
        <div className="mt-4 text-xs text-dj-light/50 text-center">
          💡 Tip: Puoi disabilitare questo avviso nelle impostazioni
        </div>
      </div>
    </div>
  )
}

export default DuplicateTrackDialog