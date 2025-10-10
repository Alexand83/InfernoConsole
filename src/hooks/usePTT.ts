import { useEffect, useCallback, useRef } from 'react'
import { useSettings } from '../contexts/SettingsContext'

export const usePTT = (onPTTActivate: (active: boolean) => void) => {
  const { settings } = useSettings()
  const isActiveRef = useRef(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Solo se non stiamo digitando in un input
    if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return
    if (e.target && (e.target as HTMLElement).tagName === 'TEXTAREA') return
    
    const configuredKey = settings.microphone.pushToTalkKey
    if (!configuredKey) return

    // Mappa i nomi dei tasti alle loro rappresentazioni
    const keyMap: { [key: string]: string } = {
      'Space': 'Space',
      'Ctrl': 'Control',
      'Alt': 'Alt',
      'Shift': 'Shift',
      'Cmd': 'Meta',
      'Tab': 'Tab',
      'Enter': 'Enter',
      'Escape': 'Escape',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      '↑': 'ArrowUp',
      '↓': 'ArrowDown',
      '←': 'ArrowLeft',
      '→': 'ArrowRight',
      'F1': 'F1',
      'F2': 'F2',
      'F3': 'F3',
      'F4': 'F4',
      'F5': 'F5',
      'F6': 'F6',
      'F7': 'F7',
      'F8': 'F8',
      'F9': 'F9',
      'F10': 'F10',
      'F11': 'F11',
      'F12': 'F12'
    }

    // Mappa lettere singole
    const letterMap: { [key: string]: string } = {
      'A': 'KeyA', 'B': 'KeyB', 'C': 'KeyC', 'D': 'KeyD', 'E': 'KeyE',
      'F': 'KeyF', 'G': 'KeyG', 'H': 'KeyH', 'I': 'KeyI', 'J': 'KeyJ',
      'K': 'KeyK', 'L': 'KeyL', 'M': 'KeyM', 'N': 'KeyN', 'O': 'KeyO',
      'P': 'KeyP', 'Q': 'KeyQ', 'R': 'KeyR', 'S': 'KeyS', 'T': 'KeyT',
      'U': 'KeyU', 'V': 'KeyV', 'W': 'KeyW', 'X': 'KeyX', 'Y': 'KeyY',
      'Z': 'KeyZ'
    }

    let isMatch = false

    // Controlla se è una combinazione di tasti
    if (configuredKey.includes('+')) {
      const parts = configuredKey.split('+')
      const mainKey = parts[parts.length - 1]
      const modifiers = parts.slice(0, -1)

      // Controlla i modificatori
      const modifiersMatch = modifiers.every(mod => {
        switch (mod) {
          case 'Ctrl': return e.ctrlKey
          case 'Alt': return e.altKey
          case 'Shift': return e.shiftKey
          case 'Cmd': return e.metaKey
          default: return false
        }
      })

      // Controlla il tasto principale
      const mainKeyCode = keyMap[mainKey] || letterMap[mainKey.toUpperCase()] || mainKey
      // Match by code OR by key (case-insensitive) to be resilient to layout/name differences
      const keyMatches = e.code === mainKeyCode || (e.key && e.key.toUpperCase() === mainKey.toUpperCase())
      isMatch = modifiersMatch && keyMatches
    } else {
      // Tasto singolo
      const keyCode = keyMap[configuredKey] || letterMap[configuredKey.toUpperCase()] || configuredKey
      isMatch = e.code === keyCode || (e.key && e.key.toUpperCase() === configuredKey.toUpperCase())
    }

    if (isMatch && !e.repeat && !isActiveRef.current) {
      e.preventDefault()
      console.log(`🎤 PTT activated with key: ${configuredKey} (code: ${e.code})`)
      onPTTActivate(true)
      isActiveRef.current = true
    }
  }, [settings.microphone.pushToTalkKey, onPTTActivate])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    // Solo se non stiamo digitando in un input
    if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return
    if (e.target && (e.target as HTMLElement).tagName === 'TEXTAREA') return
    
    const configuredKey = settings.microphone.pushToTalkKey
    if (!configuredKey) return

    // Mappa i nomi dei tasti alle loro rappresentazioni
    const keyMap: { [key: string]: string } = {
      'Space': 'Space',
      'Ctrl': 'Control',
      'Alt': 'Alt',
      'Shift': 'Shift',
      'Cmd': 'Meta',
      'Tab': 'Tab',
      'Enter': 'Enter',
      'Escape': 'Escape',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      '↑': 'ArrowUp',
      '↓': 'ArrowDown',
      '←': 'ArrowLeft',
      '→': 'ArrowRight',
      'F1': 'F1',
      'F2': 'F2',
      'F3': 'F3',
      'F4': 'F4',
      'F5': 'F5',
      'F6': 'F6',
      'F7': 'F7',
      'F8': 'F8',
      'F9': 'F9',
      'F10': 'F10',
      'F11': 'F11',
      'F12': 'F12'
    }

    // Mappa lettere singole
    const letterMap: { [key: string]: string } = {
      'A': 'KeyA', 'B': 'KeyB', 'C': 'KeyC', 'D': 'KeyD', 'E': 'KeyE',
      'F': 'KeyF', 'G': 'KeyG', 'H': 'KeyH', 'I': 'KeyI', 'J': 'KeyJ',
      'K': 'KeyK', 'L': 'KeyL', 'M': 'KeyM', 'N': 'KeyN', 'O': 'KeyO',
      'P': 'KeyP', 'Q': 'KeyQ', 'R': 'KeyR', 'S': 'KeyS', 'T': 'KeyT',
      'U': 'KeyU', 'V': 'KeyV', 'W': 'KeyW', 'X': 'KeyX', 'Y': 'KeyY',
      'Z': 'KeyZ'
    }

    let isMatch = false

    // Controlla se è una combinazione di tasti
    if (configuredKey.includes('+')) {
      const parts = configuredKey.split('+')
      const mainKey = parts[parts.length - 1]
      const modifiers = parts.slice(0, -1)

      // Controlla i modificatori
      const modifiersMatch = modifiers.every(mod => {
        switch (mod) {
          case 'Ctrl': return e.ctrlKey
          case 'Alt': return e.altKey
          case 'Shift': return e.shiftKey
          case 'Cmd': return e.metaKey
          default: return false
        }
      })

      // Controlla il tasto principale
      const mainKeyCode = keyMap[mainKey] || letterMap[mainKey.toUpperCase()] || mainKey
      const keyMatches = e.code === mainKeyCode || (e.key && e.key.toUpperCase() === mainKey.toUpperCase())
      isMatch = modifiersMatch && keyMatches
    } else {
      // Tasto singolo
      const keyCode = keyMap[configuredKey] || letterMap[configuredKey.toUpperCase()] || configuredKey
      isMatch = e.code === keyCode || (e.key && e.key.toUpperCase() === configuredKey.toUpperCase())
    }

    // Deattiva se: match esplicito OPPURE PTT è attivo e viene rilasciata QUALSIASI parte della combinazione
    let comboPartReleased = false
    if (configuredKey.includes('+')) {
      const parts = configuredKey.split('+')
      const mainKey = parts[parts.length - 1]
      const modifiers = parts.slice(0, -1)
      const releasedIsMain = (e.key && e.key.toUpperCase() === mainKey.toUpperCase()) || (e.code === (keyMap[mainKey] || letterMap[mainKey.toUpperCase()] || mainKey))
      const releasedIsModifier = modifiers.some(mod => {
        const map = { Ctrl: 'Control', Alt: 'Alt', Shift: 'Shift', Cmd: 'Meta' } as Record<string, string>
        return (e.key && e.key === map[mod]) || (e.code === map[mod])
      })
      comboPartReleased = releasedIsMain || releasedIsModifier
    }

    if (isMatch || (isActiveRef.current && comboPartReleased)) {
      e.preventDefault()
      console.log(`🎤 PTT deactivated with key: ${configuredKey} (code: ${e.code})`)
      onPTTActivate(false)
      isActiveRef.current = false
    }
  }, [settings.microphone.pushToTalkKey, onPTTActivate])

  useEffect(() => {
    // console.log(`🎹 [PTT] Hook initialized with key: ${settings.microphone.pushToTalkKey}`)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp, settings.microphone.pushToTalkKey])
}
