import { it, type TranslationKeys } from './it'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { de } from './de'

export type Language = 'it' | 'en' | 'es' | 'fr' | 'de'

const translations: Record<Language, TranslationKeys> = {
  it,
  en,
  es,
  fr,
  de
}

let currentLanguage: Language = 'it'

// Funzione per ottenere la traduzione
export function t(key: string, language?: Language): string {
  const lang = language || currentLanguage
  const keys = key.split('.')
  
  let value: any = translations[lang] || translations.it
  
  for (const k of keys) {
    value = value?.[k]
    if (value === undefined) {
      // Fallback all'italiano se la chiave non esiste
      value = translations.it
      for (const fallbackKey of keys) {
        value = value?.[fallbackKey]
        if (value === undefined) {
          console.warn(`Translation key not found: ${key}`)
          return key
        }
      }
      break
    }
  }
  
  return typeof value === 'string' ? value : key
}

// Funzione per cambiare lingua
export function setLanguage(language: Language) {
  if (translations[language]) {
    currentLanguage = language
    // Emetti evento per aggiornare i componenti
    window.dispatchEvent(new CustomEvent('language-changed', { detail: language }))
  }
}

// Funzione per ottenere la lingua corrente
export function getCurrentLanguage(): Language {
  return currentLanguage
}

// Funzione per ottenere tutte le lingue disponibili
export function getAvailableLanguages(): Language[] {
  return Object.keys(translations) as Language[]
}

// Hook React per le traduzioni
import { useState, useEffect } from 'react'

export function useTranslation() {
  const [, forceUpdate] = useState({})
  
  useEffect(() => {
    const handleLanguageChange = () => {
      forceUpdate({})
    }
    
    window.addEventListener('language-changed', handleLanguageChange)
    return () => window.removeEventListener('language-changed', handleLanguageChange)
  }, [])
  
  return {
    t: (key: string) => t(key),
    language: currentLanguage,
    setLanguage
  }
}

export { type TranslationKeys }
