export interface ScheduledEvent {
  id: string
  name: string
  type: 'playlist' | 'jingle' | 'promotion' | 'live' | 'break'
  startTime: Date
  endTime?: Date
  duration: number // in minutes
  priority: 'low' | 'normal' | 'high' | 'urgent'
  playlistId?: string
  tracks?: string[]
  isRecurring: boolean
  recurringPattern?: 'daily' | 'weekly' | 'monthly'
  recurringDays?: number[] // 0-6 for days of week
  isActive: boolean
}

export interface SchedulingRule {
  id: string
  name: string
  type: 'rotation' | 'separation' | 'genre' | 'energy' | 'time'
  conditions: {
    minTimeBetween?: number // minutes
    maxPlaysPerHour?: number
    genre?: string
    energy?: 'low' | 'medium' | 'high'
    timeOfDay?: {
      start: string // HH:MM
      end: string // HH:MM
    }
  }
  actions: {
    action: 'play' | 'skip' | 'delay' | 'replace'
    value?: any
  }
  priority: number
  isActive: boolean
}

export interface SchedulerStats {
  totalEvents: number
  activeEvents: number
  totalPlaytime: number
  uptime: number
  lastEventTime: Date
  nextEventTime: Date
}

export class PlaylistScheduler {
  private events: ScheduledEvent[] = []
  private rules: SchedulingRule[] = []
  private currentEvent: ScheduledEvent | null = null
  private nextEvent: ScheduledEvent | null = null
  private isRunning = false
  private timer: NodeJS.Timeout | null = null
  private startTime: Date = new Date()
  
  private onEventStart: ((event: ScheduledEvent) => void) | null = null
  private onEventEnd: ((event: ScheduledEvent) => void) | null = null
  private onScheduleUpdate: ((events: ScheduledEvent[]) => void) | null = null

  constructor() {
    this.loadDefaultRules()
  }

  private loadDefaultRules() {
    // Default rotation rules
    this.rules = [
      {
        id: 'rotation_1',
        name: 'Artist Separation',
        type: 'separation',
        conditions: {
          minTimeBetween: 60 // 1 hour between same artist
        },
        actions: {
          action: 'skip'
        },
        priority: 1,
        isActive: true
      },
      {
        id: 'rotation_2',
        name: 'Genre Balance',
        type: 'genre',
        conditions: {
          maxPlaysPerHour: 3
        },
        actions: {
          action: 'delay',
          value: 15 // 15 minutes delay
        },
        priority: 2,
        isActive: true
      },
      {
        id: 'rotation_3',
        name: 'Energy Flow',
        type: 'energy',
        conditions: {
          energy: 'high'
        },
        actions: {
          action: 'play'
        },
        priority: 3,
        isActive: true
      }
    ]
  }

  addEvent(event: Omit<ScheduledEvent, 'id'>): string {
    const id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newEvent: ScheduledEvent = {
      ...event,
      id,
      isActive: true
    }

    this.events.push(newEvent)
    this.sortEvents()
    this.onScheduleUpdate?.(this.events)
    
    return id
  }

  updateEvent(id: string, updates: Partial<ScheduledEvent>): boolean {
    const eventIndex = this.events.findIndex(e => e.id === id)
    if (eventIndex === -1) return false

    this.events[eventIndex] = { ...this.events[eventIndex], ...updates }
    this.sortEvents()
    this.onScheduleUpdate?.(this.events)
    
    return true
  }

  deleteEvent(id: string): boolean {
    const eventIndex = this.events.findIndex(e => e.id === id)
    if (eventIndex === -1) return false

    this.events.splice(eventIndex, 1)
    this.onScheduleUpdate?.(this.events)
    
    return true
  }

  addRule(rule: Omit<SchedulingRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newRule: SchedulingRule = {
      ...rule,
      id,
      isActive: true
    }

    this.rules.push(newRule)
    this.sortRules()
    
    return id
  }

  private sortEvents() {
    this.events.sort((a, b) => {
      // Sort by priority first, then by start time
      const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      
      if (priorityDiff !== 0) return priorityDiff
      return a.startTime.getTime() - b.startTime.getTime()
    })
  }

  private sortRules() {
    this.rules.sort((a, b) => b.priority - a.priority)
  }

  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.startTime = new Date()
    this.processSchedule()
    
    // Check schedule every minute
    this.timer = setInterval(() => {
      this.processSchedule()
    }, 60000) // 1 minute

    console.log('Playlist Scheduler started')
  }

  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    console.log('Playlist Scheduler stopped')
  }

  private processSchedule(): void {
    const now = new Date()
    
    // Check if current event should end
    if (this.currentEvent && this.shouldEndEvent(this.currentEvent, now)) {
      this.endCurrentEvent()
    }

    // Check if we should start a new event
    if (!this.currentEvent || this.currentEvent.endTime) {
      this.startNextEvent(now)
    }

    // Process recurring events
    this.processRecurringEvents(now)
  }

  private shouldEndEvent(event: ScheduledEvent, now: Date): boolean {
    if (!event.endTime) return false
    
    const endTime = new Date(event.endTime)
    return now >= endTime
  }

  private startNextEvent(now: Date): void {
    const nextEvent = this.getNextEvent(now)
    if (!nextEvent) return

    // Apply scheduling rules
    if (this.shouldSkipEvent(nextEvent, now)) {
      console.log(`Skipping event: ${nextEvent.name} due to scheduling rules`)
      return
    }

    this.currentEvent = nextEvent
    this.currentEvent.startTime = now
    
    // Calculate end time
    if (this.currentEvent.duration > 0) {
      this.currentEvent.endTime = new Date(now.getTime() + this.currentEvent.duration * 60000)
    }

    this.onEventStart?.(this.currentEvent)
    console.log(`Started event: ${this.currentEvent.name}`)
  }

  private endCurrentEvent(): void {
    if (!this.currentEvent) return

    this.onEventEnd?.(this.currentEvent)
    console.log(`Ended event: ${this.currentEvent.name}`)
    
    this.currentEvent = null
  }

  private getNextEvent(now: Date): ScheduledEvent | null {
    return this.events.find(event => 
      event.isActive && 
      event.startTime >= now &&
      !this.shouldSkipEvent(event, now)
    ) || null
  }

  private shouldSkipEvent(event: ScheduledEvent, now: Date): boolean {
    for (const rule of this.rules) {
      if (!rule.isActive) continue

      if (this.ruleApplies(rule, event, now)) {
        return rule.actions.action === 'skip'
      }
    }
    return false
  }

  private ruleApplies(rule: SchedulingRule, event: ScheduledEvent, now: Date): boolean {
    switch (rule.type) {
      case 'rotation':
        return this.checkRotationRule(rule, event, now)
      case 'separation':
        return this.checkSeparationRule(rule, event, now)
      case 'genre':
        return this.checkGenreRule(rule, event, now)
      case 'energy':
        return this.checkEnergyRule(rule, event, now)
      case 'time':
        return this.checkTimeRule(rule, event, now)
      default:
        return false
    }
  }

  private checkRotationRule(rule: SchedulingRule, event: ScheduledEvent, now: Date): boolean {
    // Check if event was played recently
    const recentEvents = this.events.filter(e => 
      e.id === event.id && 
      e.startTime < now && 
      e.startTime > new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
    )
    
    return recentEvents.length >= (rule.conditions.maxPlaysPerHour || 1)
  }

  private checkSeparationRule(rule: SchedulingRule, event: ScheduledEvent, now: Date): boolean {
    if (!rule.conditions.minTimeBetween) return false
    
    const lastEvent = this.events
      .filter(e => e.id === event.id && e.startTime < now)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0]
    
    if (!lastEvent) return false
    
    const timeDiff = now.getTime() - lastEvent.startTime.getTime()
    return timeDiff < rule.conditions.minTimeBetween * 60000
  }

  private checkGenreRule(rule: SchedulingRule, event: ScheduledEvent, now: Date): boolean {
    // This would check the genre of tracks in the event
    // For now, return false as we don't have genre data in events
    return false
  }

  private checkEnergyRule(rule: SchedulingRule, event: ScheduledEvent, now: Date): boolean {
    // This would check the energy level of tracks in the event
    // For now, return false as we don't have energy data in events
    return false
  }

  private checkTimeRule(rule: SchedulingRule, event: ScheduledEvent, now: Date): boolean {
    if (!rule.conditions.timeOfDay) return false
    
    const currentTime = now.toTimeString().substr(0, 5) // HH:MM
    const startTime = rule.conditions.timeOfDay.start
    const endTime = rule.conditions.timeOfDay.end
    
    return currentTime >= startTime && currentTime <= endTime
  }

  private processRecurringEvents(now: Date): void {
    this.events.forEach(event => {
      if (!event.isRecurring || !event.recurringPattern) return
      
      if (this.shouldCreateRecurringEvent(event, now)) {
        this.createRecurringEvent(event, now)
      }
    })
  }

  private shouldCreateRecurringEvent(event: ScheduledEvent, now: Date): boolean {
    if (!event.isRecurring) return false
    
    switch (event.recurringPattern) {
      case 'daily':
        return this.shouldCreateDailyEvent(event, now)
      case 'weekly':
        return this.shouldCreateWeeklyEvent(event, now)
      case 'monthly':
        return this.shouldCreateMonthlyEvent(event, now)
      default:
        return false
    }
  }

  private shouldCreateDailyEvent(event: ScheduledEvent, now: Date): boolean {
    const lastEvent = this.events
      .filter(e => e.id === event.id && e.startTime < now)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0]
    
    if (!lastEvent) return true
    
    const lastEventDate = new Date(lastEvent.startTime)
    const today = new Date(now)
    
    return lastEventDate.getDate() !== today.getDate() ||
           lastEventDate.getMonth() !== today.getMonth() ||
           lastEventDate.getFullYear() !== today.getFullYear()
  }

  private shouldCreateWeeklyEvent(event: ScheduledEvent, now: Date): boolean {
    if (!event.recurringDays) return false
    
    const dayOfWeek = now.getDay()
    return event.recurringDays.includes(dayOfWeek)
  }

  private shouldCreateMonthlyEvent(event: ScheduledEvent, now: Date): boolean {
    const lastEvent = this.events
      .filter(e => e.id === event.id && e.startTime < now)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0]
    
    if (!lastEvent) return true
    
    const lastEventDate = new Date(lastEvent.startTime)
    const today = new Date(now)
    
    return lastEventDate.getMonth() !== today.getMonth() ||
           lastEventDate.getFullYear() !== today.getFullYear()
  }

  private createRecurringEvent(originalEvent: ScheduledEvent, now: Date): void {
    const newEvent: ScheduledEvent = {
      ...originalEvent,
      id: `recurring_${originalEvent.id}_${now.getTime()}`,
      startTime: new Date(now),
      isRecurring: false // Don't make the copy recurring
    }
    
    this.events.push(newEvent)
    this.sortEvents()
    this.onScheduleUpdate?.(this.events)
  }

  getCurrentEvent(): ScheduledEvent | null {
    return this.currentEvent
  }

  getNextEvent(): ScheduledEvent | null {
    return this.nextEvent
  }

  getAllEvents(): ScheduledEvent[] {
    return [...this.events]
  }

  getActiveEvents(): ScheduledEvent[] {
    return this.events.filter(e => e.isActive)
  }

  getStats(): SchedulerStats {
    const now = new Date()
    const activeEvents = this.getActiveEvents()
    const nextEvent = this.getNextEvent(now)
    
    return {
      totalEvents: this.events.length,
      activeEvents: activeEvents.length,
      totalPlaytime: this.events.reduce((total, e) => total + e.duration, 0),
      uptime: this.isRunning ? (now.getTime() - this.startTime.getTime()) / 1000 : 0,
      lastEventTime: this.currentEvent?.startTime || now,
      nextEventTime: nextEvent?.startTime || now
    }
  }

  setEventStartCallback(callback: (event: ScheduledEvent) => void) {
    this.onEventStart = callback
  }

  setEventEndCallback(callback: (event: ScheduledEvent) => void) {
    this.onEventEnd = callback
  }

  setScheduleUpdateCallback(callback: (events: ScheduledEvent[]) => void) {
    this.onScheduleUpdate = callback
  }
}
