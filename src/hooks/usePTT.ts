import { useEffect, useCallback } from 'react'
import { useSettings } from '../contexts/SettingsContext'

export const usePTT = (onPTTActivate: (active: boolean) => void) => {
  const { settings } = useSettings()

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
      const mainKeyCode = keyMap[mainKey] || letterMap[mainKey] || mainKey
      isMatch = modifiersMatch && e.code === mainKeyCode
    } else {
      // Tasto singolo
      const keyCode = keyMap[configuredKey] || letterMap[configuredKey] || configuredKey
      isMatch = e.code === keyCode
    }

    if (isMatch && !e.repeat) {
      e.preventDefault()
      console.log(`🎤 PTT activated with key: ${configuredKey} (code: ${e.code})`)
      onPTTActivate(true)
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
      const mainKeyCode = keyMap[mainKey] || letterMap[mainKey] || mainKey
      isMatch = modifiersMatch && e.code === mainKeyCode
    } else {
      // Tasto singolo
      const keyCode = keyMap[configuredKey] || letterMap[configuredKey] || configuredKey
      isMatch = e.code === keyCode
    }

    if (isMatch) {
      e.preventDefault()
      console.log(`🎤 PTT deactivated with key: ${configuredKey} (code: ${e.code})`)
      onPTTActivate(false)
    }
  }, [settings.microphone.pushToTalkKey, onPTTActivate])

  useEffect(() => {
    console.log(`🎹 [PTT] Hook initialized with key: ${settings.microphone.pushToTalkKey}`)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp, settings.microphone.pushToTalkKey])
}
