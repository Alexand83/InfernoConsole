import React from 'react'
import { ExternalLink, Code, Shield, Calendar } from 'lucide-react'

interface Library {
  name: string
  version: string
  license: string
  description: string
  url?: string
  licenseUrl?: string
}

const LibrariesInfo: React.FC = () => {
  // Lista delle librerie utilizzate nel progetto
  const libraries: Library[] = [
    {
      name: 'React',
      version: '18.2.0',
      license: 'MIT',
      description: 'Libreria per la costruzione di interfacce utente',
      url: 'https://reactjs.org/',
      licenseUrl: 'https://github.com/facebook/react/blob/main/LICENSE'
    },
    {
      name: 'TypeScript',
      version: '5.0.0',
      license: 'Apache-2.0',
      description: 'Linguaggio di programmazione tipizzato per JavaScript',
      url: 'https://www.typescriptlang.org/',
      licenseUrl: 'https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt'
    },
    {
      name: 'Vite',
      version: '4.4.0',
      license: 'MIT',
      description: 'Build tool e dev server veloce per applicazioni web moderne',
      url: 'https://vitejs.dev/',
      licenseUrl: 'https://github.com/vitejs/vite/blob/main/LICENSE'
    },
    {
      name: 'Lucide React',
      version: '0.263.1',
      license: 'ISC',
      description: 'Icone SVG ottimizzate per React',
      url: 'https://lucide.dev/',
      licenseUrl: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE'
    },
    {
      name: 'Tailwind CSS',
      version: '3.3.0',
      license: 'MIT',
      description: 'Framework CSS utility-first per styling rapido',
      url: 'https://tailwindcss.com/',
      licenseUrl: 'https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE'
    },
    {
      name: 'Web Audio API',
      version: 'N/A',
      license: 'W3C',
      description: 'API del browser per l\'elaborazione audio in tempo reale',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API',
      licenseUrl: 'https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document'
    },
    {
      name: 'IndexedDB',
      version: 'N/A',
      license: 'W3C',
      description: 'Database NoSQL del browser per storage locale',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
      licenseUrl: 'https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document'
    },
    {
      name: 'File API',
      version: 'N/A',
      license: 'W3C',
      description: 'API del browser per la gestione dei file',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/File_API',
      licenseUrl: 'https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document'
    },
    {
      name: 'MediaDevices API',
      version: 'N/A',
      license: 'W3C',
      description: 'API del browser per accesso a microfoni e dispositivi audio',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices',
      licenseUrl: 'https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document'
    },
  ]

  const getLicenseColor = (license: string) => {
    switch (license) {
      case 'MIT':
        return 'text-green-400 bg-green-500/20'
      case 'Apache-2.0':
        return 'text-blue-400 bg-blue-500/20'
      case 'ISC':
        return 'text-purple-400 bg-purple-500/20'
      case 'W3C':
        return 'text-orange-400 bg-orange-500/20'
      default:
        return 'text-gray-400 bg-gray-500/20'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <Code className="w-5 h-5 text-dj-accent" />
        <h3 className="text-lg font-medium text-white">Librerie Utilizzate</h3>
      </div>

      <div className="grid gap-4">
        {libraries.map((library, index) => (
          <div
            key={index}
            className="bg-dj-secondary rounded-lg p-4 border border-dj-accent/20 hover:border-dj-accent/40 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-white font-medium mb-1">{library.name}</h4>
                <p className="text-sm text-dj-light/60 mb-2">{library.description}</p>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getLicenseColor(library.license)}`}>
                  {library.license}
                </span>
                {library.url && (
                  <a
                    href={library.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dj-accent hover:text-dj-accent/80 transition-colors"
                    title="Visita sito web"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1 text-dj-light/60">
                  <Calendar className="w-3 h-3" />
                  <span>v{library.version}</span>
                </div>
                
                {library.licenseUrl && (
                  <a
                    href={library.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-dj-accent hover:text-dj-accent/80 transition-colors"
                  >
                    <Shield className="w-3 h-3" />
                    <span>Licenza</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Note legali */}
      <div className="mt-6 p-4 bg-dj-primary/50 rounded-lg border border-dj-accent/20">
        <div className="flex items-start space-x-2">
          <Shield className="w-5 h-5 text-dj-accent mt-0.5" />
          <div className="text-sm text-dj-light/80">
            <p className="font-medium text-white mb-2">Note Legali</p>
            <p className="mb-2">
              Questo software utilizza librerie open source. Tutte le licenze sono rispettate e 
              i file di licenza completi sono disponibili nei link sopra.
            </p>
            <p>
              Per informazioni dettagliate sui termini di licenza, consulta i repository 
              ufficiali delle rispettive librerie.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LibrariesInfo
