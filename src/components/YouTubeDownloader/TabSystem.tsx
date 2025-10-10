import React, { useState } from 'react'

interface Tab {
  id: string
  label: string
  icon: string
  content: React.ReactNode
  badge?: number
}

interface TabSystemProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
}

const TabSystem: React.FC<TabSystemProps> = ({ tabs, defaultTab, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '')

  const activeTabData = tabs.find(tab => tab.id === activeTab)

  return (
    <div className={`bg-gray-800 rounded-lg ${className}`}>
      {/* Tab Headers */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                  {tab.badge}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTabData?.content}
      </div>
    </div>
  )
}

export default TabSystem
