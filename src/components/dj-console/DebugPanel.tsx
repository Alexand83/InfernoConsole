import React from 'react'

interface DebugPanelProps {
  isOpen: boolean
  onClose: () => void
  debugData: any // We can type this more specifically later
}

const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  onClose,
  debugData
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Debug Panel</h3>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
          >
            Chiudi
          </button>
        </div>
        
        <div className="bg-gray-900 rounded p-4 max-h-[60vh] overflow-y-auto">
          <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default DebugPanel














