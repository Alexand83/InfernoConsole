import { AudioState, AudioAction } from './AudioTypes'
import { audioLogger } from './AudioLogger'

interface SavedAudioState {
  leftDeck?: {
    volume?: number
    track?: any
  }
  rightDeck?: {
    volume?: number
    track?: any
  }
  master?: {
    volume?: number
    crossfader?: number
  }
  microphone?: {
    volume?: number
    enabled?: boolean
  }
  timestamp: number
}

class AudioPersistence {
  private readonly STORAGE_KEY = 'djconsole_audio_state'
  private readonly MAX_AGE = 30 * 60 * 1000 // 30 minuti
  
  public saveState(state: AudioState): void {
    try {
      const toSave: SavedAudioState = {
        leftDeck: {
          volume: state.leftDeck.localVolume,
          track: state.leftDeck.track
        },
        rightDeck: {
          volume: state.rightDeck.localVolume,
          track: state.rightDeck.track
        },
        master: {
          volume: state.masterVolume,
          crossfader: state.crossfader
        },
        microphone: {
          volume: state.microphone.volume,
          enabled: state.microphone.isEnabled
        },
        timestamp: Date.now()
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave))
      audioLogger.debug('PERSISTENCE', 'Audio state saved', toSave)
      
    } catch (error) {
      audioLogger.error('PERSISTENCE', 'Failed to save audio state', error)
    }
  }
  
  public loadState(dispatch: React.Dispatch<AudioAction>): boolean {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY)
      if (!saved) {
        audioLogger.info('PERSISTENCE', 'No saved state found')
        return false
      }
      
      const parsedState: SavedAudioState = JSON.parse(saved)
      
      // Controlla se lo stato è troppo vecchio
      if (Date.now() - parsedState.timestamp > this.MAX_AGE) {
        audioLogger.warn('PERSISTENCE', 'Saved state is too old, ignoring')
        return false
      }
      
      // Ripristina i volumi
      if (parsedState.leftDeck?.volume !== undefined) {
        dispatch({ type: 'SET_LEFT_DECK_LOCAL_VOLUME', payload: parsedState.leftDeck.volume })
      }
      
      if (parsedState.rightDeck?.volume !== undefined) {
        dispatch({ type: 'SET_RIGHT_DECK_LOCAL_VOLUME', payload: parsedState.rightDeck.volume })
      }
      
      if (parsedState.master?.volume !== undefined) {
        dispatch({ type: 'SET_MASTER_VOLUME', payload: parsedState.master.volume })
      }
      
      if (parsedState.master?.crossfader !== undefined) {
        dispatch({ type: 'SET_CROSSFADER', payload: parsedState.master.crossfader })
      }
      
      if (parsedState.microphone?.volume !== undefined) {
        dispatch({ 
          type: 'SET_MICROPHONE', 
          payload: { volume: parsedState.microphone.volume }
        })
      }
      
      if (parsedState.microphone?.enabled !== undefined) {
        dispatch({ 
          type: 'SET_MICROPHONE', 
          payload: { isEnabled: parsedState.microphone.enabled }
        })
      }
      
      audioLogger.info('PERSISTENCE', 'Audio state restored successfully')
      return true
      
    } catch (error) {
      audioLogger.error('PERSISTENCE', 'Failed to load audio state', error)
      return false
    }
  }
  
  public clearState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      audioLogger.info('PERSISTENCE', 'Audio state cleared')
    } catch (error) {
      audioLogger.error('PERSISTENCE', 'Failed to clear audio state', error)
    }
  }
  
  public hasValidState(): boolean {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY)
      if (!saved) return false
      
      const parsedState: SavedAudioState = JSON.parse(saved)
      return Date.now() - parsedState.timestamp <= this.MAX_AGE
      
    } catch (error) {
      return false
    }
  }
}

// Istanza singleton
export const audioPersistence = new AudioPersistence()

// Hook per React
export function useAudioPersistence() {
  return audioPersistence
}














