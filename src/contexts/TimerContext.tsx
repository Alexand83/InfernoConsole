import React, { createContext, useContext, useRef, useEffect, useState } from 'react'

interface TimerState {
  leftDeck: {
    currentTime: number
    duration: number
  }
  rightDeck: {
    currentTime: number
    duration: number
  }
}

interface TimerContextType {
  state: TimerState
  updateLeftDeckTime: (time: number) => void
  updateRightDeckTime: (time: number) => void
  updateLeftDeckDuration: (duration: number) => void
  updateRightDeckDuration: (duration: number) => void
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

export const useTimer = () => {
  const context = useContext(TimerContext)
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return context
}

interface TimerProviderProps {
  children: React.ReactNode
}

export const TimerProvider: React.FC<TimerProviderProps> = ({ children }) => {
  const [state, setState] = useState<TimerState>({
    leftDeck: { currentTime: 0, duration: 0 },
    rightDeck: { currentTime: 0, duration: 0 }
  })

  const updateLeftDeckTime = (time: number) => {
    setState(prev => ({
      ...prev,
      leftDeck: { ...prev.leftDeck, currentTime: time }
    }))
  }

  const updateRightDeckTime = (time: number) => {
    setState(prev => ({
      ...prev,
      rightDeck: { ...prev.rightDeck, currentTime: time }
    }))
  }

  const updateLeftDeckDuration = (duration: number) => {
    setState(prev => ({
      ...prev,
      leftDeck: { ...prev.leftDeck, duration }
    }))
  }

  const updateRightDeckDuration = (duration: number) => {
    setState(prev => ({
      ...prev,
      rightDeck: { ...prev.rightDeck, duration }
    }))
  }

  return (
    <TimerContext.Provider value={{
      state,
      updateLeftDeckTime,
      updateRightDeckTime,
      updateLeftDeckDuration,
      updateRightDeckDuration
    }}>
      {children}
    </TimerContext.Provider>
  )
}
