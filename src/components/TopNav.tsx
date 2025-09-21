import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from '../i18n'
import { Users } from 'lucide-react'
import CollaborationPanel from './CollaborationPanel'

const TopNav = () => {
  const { t } = useTranslation()
  const [showCollaborationPanel, setShowCollaborationPanel] = useState(false)
  
  const items = [
    { path: '/', label: t('nav.console') },
    { path: '/library', label: 'Libreria & Playlist' },
    { path: '/settings', label: t('nav.settings') },
  ]

  return (
    <header className="w-full bg-dj-primary border-b border-dj-accent/30">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="h-14 flex items-center justify-between">
          <div className="text-white font-dj font-bold">Inferno Console</div>
          <nav className="flex items-center space-x-1">
            {items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive ? 'bg-dj-accent text-white' : 'text-dj-light/80 hover:bg-dj-accent/20 hover:text-white'
                  }`
                }
              >
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
            
            {/* Pulsante Collaborazione */}
            <button
              onClick={() => setShowCollaborationPanel(!showCollaborationPanel)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                showCollaborationPanel ? 'bg-dj-accent text-white' : 'text-dj-light/80 hover:bg-dj-accent/20 hover:text-white'
              }`}
              title="Collaborazione DJ"
            >
              <Users className="w-4 h-4" />
              <span className="font-medium">🤝 Collaborazione</span>
            </button>
          </nav>
        </div>
      </div>
      
      {/* Pannello Collaborazione */}
      {showCollaborationPanel && (
        <div className="collaboration-panel-overlay">
          <div className="collaboration-panel-container">
            <CollaborationPanel onClose={() => setShowCollaborationPanel(false)} />
          </div>
        </div>
      )}
    </header>
  )
}

export default TopNav


