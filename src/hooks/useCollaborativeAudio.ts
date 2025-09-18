/**
 * 🎤 HOOK PER AUDIO COLLABORATIVO
 * Gestisce il mixing di microfoni locali e remoti
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useStreaming } from '../contexts/StreamingContext'
import { useCollaborativeMode } from '../contexts/CollaborativeModeContext'
import CollaborativeAudioMixer from '../audio/CollaborativeAudioMixer'

export interface CollaborativeAudioState {
  isMixing: boolean
  localMicVolume: number
  remoteMicVolumes: Map<string, number>
  masterVolume: number
  outputStream: MediaStream | null
  error: string | null
}

export interface CollaborativeAudioActions {
  startMixing: () => Promise<void>
  stopMixing: () => void
  setLocalMicVolume: (volume: number) => void
  setRemoteMicVolume: (djId: string, volume: number) => void
  setMasterVolume: (volume: number) => void
  addRemoteMicrophone: (djId: string, stream: MediaStream) => Promise<void>
  removeRemoteMicrophone: (djId: string) => void
  clearError: () => void
}

export const useCollaborativeAudio = (): {
  state: CollaborativeAudioState
  actions: CollaborativeAudioActions
} => {
  const { state: streamingState, actions: streamingActions } = useStreaming()
  const { state: collaborativeState } = useCollaborativeMode()
  
  const mixerRef = useRef<CollaborativeAudioMixer | null>(null)
  const [state, setState] = useState<CollaborativeAudioState>({
    isMixing: false,
    localMicVolume: 80,
    remoteMicVolumes: new Map(),
    masterVolume: 100,
    outputStream: null,
    error: null
  })

  // Inizializza mixer
  useEffect(() => {
    const initializeMixer = async () => {
      try {
        mixerRef.current = new CollaborativeAudioMixer({
          sampleRate: 48000,
          bufferSize: 4096,
          localMicGain: state.localMicVolume / 100,
          remoteMicGain: 0.8,
          masterGain: state.masterVolume / 100
        })

        await mixerRef.current.initialize()
        console.log('✅ [COLLABORATIVE AUDIO] Mixer inizializzato')
      } catch (error) {
        console.error('❌ [COLLABORATIVE AUDIO] Errore inizializzazione mixer:', error)
        setState(prev => ({ ...prev, error: `Errore inizializzazione: ${error}` }))
      }
    }

    if (collaborativeState.mode !== 'solo') {
      initializeMixer()
    }

    return () => {
      if (mixerRef.current) {
        mixerRef.current.dispose()
        mixerRef.current = null
      }
    }
  }, [collaborativeState.mode])

  // Gestisce microfoni remoti quando si connettono/disconnettono
  useEffect(() => {
    if (!mixerRef.current || !state.isMixing) return

    const currentRemoteDJs = new Set(collaborativeState.connectedDJs.map(dj => dj.id))
    const previousRemoteDJs = new Set(state.remoteMicVolumes.keys())

    // Rimuovi DJ disconnessi
    previousRemoteDJs.forEach(djId => {
      if (!currentRemoteDJs.has(djId)) {
        actions.removeRemoteMicrophone(djId)
      }
    })

    // Aggiungi nuovi DJ (i loro microfoni verranno aggiunti quando si connettono)
    currentRemoteDJs.forEach(djId => {
      if (!previousRemoteDJs.has(djId)) {
        setState(prev => {
          const newVolumes = new Map(prev.remoteMicVolumes)
          newVolumes.set(djId, 80) // Volume default
          return { ...prev, remoteMicVolumes: newVolumes }
        })
      }
    })
  }, [collaborativeState.connectedDJs, state.isMixing])

  const startMixing = useCallback(async () => {
    try {
      if (!mixerRef.current) {
        throw new Error('Mixer non inizializzato')
      }

      console.log('🎤 [COLLABORATIVE AUDIO] Avvio mixing...')

      // Aggiungi microfono locale se disponibile
      if (collaborativeState.localMicrophone && navigator.mediaDevices) {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        await mixerRef.current.addLocalMicrophone(localStream)
      }

      // Avvia mixer
      const outputStream = await mixerRef.current.start()
      
      setState(prev => ({
        ...prev,
        isMixing: true,
        outputStream,
        error: null
      }))

      // Se siamo in streaming, aggiorna il stream con il mix
      if (streamingState.isStreaming) {
        await updateStreamingWithMix(outputStream)
      }

      console.log('✅ [COLLABORATIVE AUDIO] Mixing avviato')
    } catch (error) {
      console.error('❌ [COLLABORATIVE AUDIO] Errore avvio mixing:', error)
      setState(prev => ({ ...prev, error: `Errore avvio mixing: ${error}` }))
    }
  }, [collaborativeState.localMicrophone, streamingState.isStreaming])

  const stopMixing = useCallback(() => {
    try {
      console.log('🎤 [COLLABORATIVE AUDIO] Fermata mixing...')

      if (mixerRef.current) {
        mixerRef.current.stop()
      }

      setState(prev => ({
        ...prev,
        isMixing: false,
        outputStream: null
      }))

      // Ripristina streaming normale se attivo
      if (streamingState.isStreaming) {
        restoreNormalStreaming()
      }

      console.log('✅ [COLLABORATIVE AUDIO] Mixing fermato')
    } catch (error) {
      console.error('❌ [COLLABORATIVE AUDIO] Errore fermata mixing:', error)
    }
  }, [streamingState.isStreaming])

  const setLocalMicVolume = useCallback((volume: number) => {
    if (mixerRef.current) {
      mixerRef.current.setLocalMicGain(volume / 100)
    }
    setState(prev => ({ ...prev, localMicVolume: volume }))
  }, [])

  const setRemoteMicVolume = useCallback((djId: string, volume: number) => {
    if (mixerRef.current) {
      mixerRef.current.setRemoteMicGain(djId, volume / 100)
    }
    setState(prev => {
      const newVolumes = new Map(prev.remoteMicVolumes)
      newVolumes.set(djId, volume)
      return { ...prev, remoteMicVolumes: newVolumes }
    })
  }, [])

  const setMasterVolume = useCallback((volume: number) => {
    if (mixerRef.current) {
      mixerRef.current.setMasterGain(volume / 100)
    }
    setState(prev => ({ ...prev, masterVolume: volume }))
  }, [])

  const addRemoteMicrophone = useCallback(async (djId: string, stream: MediaStream) => {
    try {
      if (mixerRef.current && state.isMixing) {
        await mixerRef.current.addRemoteMicrophone(djId, stream)
        console.log(`✅ [COLLABORATIVE AUDIO] Microfono remoto aggiunto: ${djId}`)
      }
    } catch (error) {
      console.error(`❌ [COLLABORATIVE AUDIO] Errore aggiunta microfono remoto ${djId}:`, error)
      setState(prev => ({ ...prev, error: `Errore aggiunta microfono remoto: ${error}` }))
    }
  }, [state.isMixing])

  const removeRemoteMicrophone = useCallback((djId: string) => {
    try {
      if (mixerRef.current) {
        mixerRef.current.removeRemoteMicrophone(djId)
      }
      setState(prev => {
        const newVolumes = new Map(prev.remoteMicVolumes)
        newVolumes.delete(djId)
        return { ...prev, remoteMicVolumes: newVolumes }
      })
      console.log(`✅ [COLLABORATIVE AUDIO] Microfono remoto rimosso: ${djId}`)
    } catch (error) {
      console.error(`❌ [COLLABORATIVE AUDIO] Errore rimozione microfono remoto ${djId}:`, error)
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Funzione per aggiornare lo streaming con il mix
  const updateStreamingWithMix = async (mixStream: MediaStream) => {
    try {
      console.log('🎤 [COLLABORATIVE AUDIO] Aggiornamento streaming con mix...')
      
      // Qui dovresti integrare con il tuo sistema di streaming
      // Per ora, logghiamo l'azione
      console.log('📡 [COLLABORATIVE AUDIO] Stream mix pronto per streaming:', mixStream)
      
      // TODO: Integrare con StreamingContext per aggiornare il stream attivo
      // streamingActions.updateAudioStream(mixStream)
      
    } catch (error) {
      console.error('❌ [COLLABORATIVE AUDIO] Errore aggiornamento streaming:', error)
    }
  }

  // Funzione per ripristinare lo streaming normale
  const restoreNormalStreaming = () => {
    try {
      console.log('🎤 [COLLABORATIVE AUDIO] Ripristino streaming normale...')
      
      // TODO: Ripristinare il stream normale
      // streamingActions.restoreNormalAudioStream()
      
    } catch (error) {
      console.error('❌ [COLLABORATIVE AUDIO] Errore ripristino streaming:', error)
    }
  }

  const actions: CollaborativeAudioActions = {
    startMixing,
    stopMixing,
    setLocalMicVolume,
    setRemoteMicVolume,
    setMasterVolume,
    addRemoteMicrophone,
    removeRemoteMicrophone,
    clearError
  }

  return { state, actions }
}

export default useCollaborativeAudio
