import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  Home, 
  ListMusic, 
  Library, 
  Settings, 
  Mic, 
  Headphones,
  Radio,
  Clock,
  Star,
  Volume2,
  Database
} from 'lucide-react'

const Sidebar = () => {
  const menuItems = [
    { path: '/', icon: Home, label: 'Console', description: 'Main DJ Console' },
    { path: '/playlists', icon: ListMusic, label: 'Playlists', description: 'Manage Playlists' },
    { path: '/library', icon: Library, label: 'Library', description: 'Music Library' },
    { path: '/settings', icon: Settings, label: 'Settings', description: 'App Settings' },
    { path: '/test', icon: Database, label: 'Test Suite', description: 'Test All Features' },
  ]

  const quickActions = [
    { icon: Mic, label: 'Microphone', action: 'toggleMic' },
    { icon: Headphones, label: 'Headphones', action: 'toggleHeadphones' },
    { icon: Radio, label: 'Live Mode', action: 'toggleLive' },
    { icon: Clock, label: 'Schedule', action: 'openSchedule' },
    { icon: Star, label: 'Favorites', action: 'showFavorites' },
    { icon: Volume2, label: 'Master Volume', action: 'adjustVolume' },
  ]

  return (
    <div className="w-64 bg-dj-primary border-r border-dj-accent/30 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-dj-accent/20">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-dj-highlight to-dj-accent rounded-lg flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-dj font-bold text-white">DJ Console Pro</h1>
            <p className="text-xs text-dj-light/60">RadioBoss Style</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-dj-accent text-white shadow-lg'
                    : 'text-dj-light/70 hover:bg-dj-accent/20 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <div className="flex-1">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs opacity-60">{item.description}</div>
              </div>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Quick Actions */}
      <div className="p-4 border-t border-dj-accent/20">
        <h3 className="text-sm font-medium text-dj-light/60 mb-3 uppercase tracking-wider">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.action}
              className="flex flex-col items-center p-3 rounded-lg bg-dj-secondary hover:bg-dj-accent/20 transition-all duration-200 group"
              onClick={() => console.log(action.action)}
            >
              <action.icon className="w-5 h-5 text-dj-light/70 group-hover:text-dj-highlight mb-1" />
              <span className="text-xs text-dj-light/60 group-hover:text-white">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="p-4 border-t border-dj-accent/20">
        <div className="flex items-center justify-between text-xs text-dj-light/50">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-dj-success rounded-full animate-pulse"></div>
            <span>Online</span>
          </div>
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
