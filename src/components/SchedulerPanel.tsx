import React, { useState, useEffect } from 'react'
import { Calendar, Clock, Play, Pause, Settings, Plus, Trash2, Edit3, Repeat } from 'lucide-react'
import { PlaylistScheduler, ScheduledEvent, SchedulingRule } from '../scheduler/PlaylistScheduler'

interface SchedulerPanelProps {
  onEventStart?: (event: ScheduledEvent) => void
  onEventEnd?: (event: ScheduledEvent) => void
}

const SchedulerPanel: React.FC<SchedulerPanelProps> = ({
  onEventStart,
  onEventEnd
}) => {
  const [scheduler] = useState(() => new PlaylistScheduler())
  const [events, setEvents] = useState<ScheduledEvent[]>([])
  const [rules, setRules] = useState<SchedulingRule[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ScheduledEvent | null>(null)
  const [stats, setStats] = useState<any>(null)

  const [newEvent, setNewEvent] = useState({
    name: '',
    type: 'playlist' as const,
    startTime: new Date(),
    duration: 60,
    priority: 'normal' as const,
    isRecurring: false,
    recurringPattern: 'daily' as const,
    recurringDays: [] as number[]
  })

  useEffect(() => {
    // Set up callbacks
    scheduler.setEventStartCallback((event) => {
      onEventStart?.(event)
      console.log('Event started:', event.name)
    })

    scheduler.setEventEndCallback((event) => {
      onEventEnd?.(event)
      console.log('Event ended:', event.name)
    })

    scheduler.setScheduleUpdateCallback((events) => {
      setEvents(events)
    })

    // Load initial data
    setEvents(scheduler.getAllEvents())
    setStats(scheduler.getStats())

    // Update stats every minute
    const statsInterval = setInterval(() => {
      setStats(scheduler.getStats())
    }, 60000)

    return () => {
      clearInterval(statsInterval)
      scheduler.stop()
    }
  }, [scheduler, onEventStart, onEventEnd])

  const handleStartScheduler = () => {
    scheduler.start()
    setIsRunning(true)
  }

  const handleStopScheduler = () => {
    scheduler.stop()
    setIsRunning(false)
  }

  const handleCreateEvent = () => {
    const eventId = scheduler.addEvent({
      ...newEvent,
      startTime: new Date(newEvent.startTime),
      playlistId: `playlist_${Date.now()}`,
      tracks: []
    })

    if (eventId) {
      setShowCreateForm(false)
      setNewEvent({
        name: '',
        type: 'playlist',
        startTime: new Date(),
        duration: 60,
        priority: 'normal',
        isRecurring: false,
        recurringPattern: 'daily',
        recurringDays: []
      })
    }
  }

  const handleDeleteEvent = (eventId: string) => {
    scheduler.deleteEvent(eventId)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-dj-error'
      case 'high': return 'text-dj-warning'
      case 'normal': return 'text-dj-light'
      case 'low': return 'text-dj-light/60'
      default: return 'text-dj-light'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'playlist': return '🎵'
      case 'jingle': return '🔊'
      case 'promotion': return '📢'
      case 'live': return '🎤'
      case 'break': return '⏸️'
      default: return '📅'
    }
  }

  return (
    <div className="h-full bg-dj-primary p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-dj-highlight" />
          <h3 className="text-lg font-dj font-bold text-white">Playlist Scheduler</h3>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={isRunning ? handleStopScheduler : handleStartScheduler}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isRunning 
                ? 'bg-dj-error hover:bg-red-600 text-white' 
                : 'bg-dj-success hover:bg-green-600 text-white'
            }`}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="p-2 bg-dj-accent hover:bg-dj-highlight rounded-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-dj-secondary rounded-lg p-3 mb-4 border border-dj-accent/20">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-dj-success' : 'bg-dj-light/40'}`}></div>
              <span className="text-dj-light">
                {isRunning ? 'Scheduler Active' : 'Scheduler Stopped'}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-dj-accent" />
              <span className="text-dj-light/60">
                {stats ? `Uptime: ${Math.floor(stats.uptime / 60)}m` : 'Uptime: 0m'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-dj-light/60">
              Total Events: {stats?.totalEvents || 0}
            </span>
            <span className="text-dj-light/60">
              Active: {stats?.activeEvents || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Create Event Form */}
      {showCreateForm && (
        <div className="bg-dj-secondary rounded-lg p-4 mb-4 border border-dj-accent/20">
          <h4 className="text-sm font-medium text-white mb-3">Create New Event</h4>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Event Name</label>
              <input
                type="text"
                value={newEvent.name}
                onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
                placeholder="Event name"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Type</label>
              <select
                value={newEvent.type}
                onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
              >
                <option value="playlist">Playlist</option>
                <option value="jingle">Jingle</option>
                <option value="promotion">Promotion</option>
                <option value="live">Live</option>
                <option value="break">Break</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={newEvent.startTime.toISOString().slice(0, 16)}
                onChange={(e) => setNewEvent({ ...newEvent, startTime: new Date(e.target.value) })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={newEvent.duration}
                onChange={(e) => setNewEvent({ ...newEvent, duration: parseInt(e.target.value) })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
                min="1"
                max="1440"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Priority</label>
              <select
                value={newEvent.priority}
                onChange={(e) => setNewEvent({ ...newEvent, priority: e.target.value as any })}
                className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Recurring</label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newEvent.isRecurring}
                  onChange={(e) => setNewEvent({ ...newEvent, isRecurring: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-xs text-dj-light/60">Enable</span>
              </div>
            </div>
          </div>
          
          {newEvent.isRecurring && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-dj-light/60 mb-1">Pattern</label>
                <select
                  value={newEvent.recurringPattern}
                  onChange={(e) => setNewEvent({ ...newEvent, recurringPattern: e.target.value as any })}
                  className="w-full dj-input bg-dj-primary border-dj-accent/30 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              
              {newEvent.recurringPattern === 'weekly' && (
                <div>
                  <label className="block text-xs text-dj-light/60 mb-1">Days of Week</label>
                  <div className="flex space-x-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <button
                        key={day}
                        onClick={() => {
                          const days = newEvent.recurringDays.includes(index)
                            ? newEvent.recurringDays.filter(d => d !== index)
                            : [...newEvent.recurringDays, index]
                          setNewEvent({ ...newEvent, recurringDays: days })
                        }}
                        className={`px-2 py-1 rounded text-xs transition-all duration-200 ${
                          newEvent.recurringDays.includes(index)
                            ? 'bg-dj-highlight text-white'
                            : 'bg-dj-primary text-dj-light/60 hover:bg-dj-accent'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex space-x-2">
            <button
              onClick={handleCreateEvent}
              className="px-4 py-2 bg-dj-highlight hover:bg-dj-accent text-white rounded-lg transition-all duration-200"
            >
              Create Event
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-dj-secondary hover:bg-dj-accent text-dj-light rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white mb-3">Scheduled Events</h4>
        
        {events.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-16 h-16 text-dj-light/40 mx-auto mb-4" />
            <h5 className="text-lg font-medium text-dj-light/60 mb-2">No Events Scheduled</h5>
            <p className="text-sm text-dj-light/40">
              Create your first scheduled event to get started
            </p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="bg-dj-secondary rounded-lg p-3 border border-dj-accent/20 hover:border-dj-accent/40 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getTypeIcon(event.type)}</span>
                  <h5 className="font-medium text-white">{event.name}</h5>
                  <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(event.priority)}`}>
                    {event.priority}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {event.isRecurring && (
                    <Repeat className="w-4 h-4 text-dj-accent" />
                  )}
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="p-1 hover:bg-dj-accent rounded transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4 text-dj-light/60" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-dj-light/60">Start:</span>
                  <div className="text-white">
                    {formatTime(event.startTime)}
                  </div>
                  <div className="text-xs text-dj-light/60">
                    {formatDate(event.startTime)}
                  </div>
                </div>
                
                <div>
                  <span className="text-dj-light/60">Duration:</span>
                  <div className="text-white">{event.duration} min</div>
                </div>
                
                <div>
                  <span className="text-dj-light/60">Type:</span>
                  <div className="text-white capitalize">{event.type}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SchedulerPanel
