import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
    
    // Log dell'errore per debugging
    console.group('🚨 ErrorBoundary - Error Details')
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    console.error('Component Stack:', errorInfo.componentStack)
    console.groupEnd()
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    // Reset dell'errore e torna alla home
    this.setState({ hasError: false, error: null, errorInfo: null })
    // Dispatch evento per tornare alla home
    window.dispatchEvent(new CustomEvent('djconsole:navigate-home'))
  }

  render() {
    if (this.state.hasError) {
      // Fallback personalizzato se fornito
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Fallback di default
      return (
        <div className="min-h-screen bg-dj-primary flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-dj-secondary rounded-xl p-6 border border-dj-accent/20">
            <div className="text-center">
              {/* Icona Errore */}
              <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              
              {/* Titolo */}
              <h1 className="text-xl font-bold text-white mb-2">
                Ops! Qualcosa è andato storto
              </h1>
              
              {/* Descrizione */}
              <p className="text-dj-light/80 mb-6">
                L'applicazione ha incontrato un errore inaspettato. Non preoccuparti, i tuoi dati sono al sicuro.
              </p>
              
              {/* Dettagli Errore (solo in sviluppo) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-6 text-left">
                  <summary className="text-sm text-dj-light/60 cursor-pointer hover:text-dj-light/80 mb-2">
                    Dettagli Errore (Sviluppo)
                  </summary>
                  <div className="bg-dj-primary p-3 rounded text-xs font-mono text-red-400 overflow-auto max-h-32">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="whitespace-pre-wrap mt-1">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
              
              {/* Azioni */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleReload}
                  className="flex-1 bg-dj-highlight hover:bg-dj-accent text-white py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Ricarica App</span>
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 bg-dj-primary hover:bg-dj-secondary text-white py-3 px-4 rounded-lg transition-colors border border-dj-accent/20 flex items-center justify-center space-x-2"
                >
                  <Home className="w-4 h-4" />
                  <span>Torna alla Home</span>
                </button>
              </div>
              
              {/* Informazioni Aggiuntive */}
              <div className="mt-6 text-xs text-dj-light/60">
                <p>Se il problema persiste, prova a:</p>
                <ul className="mt-2 space-y-1">
                  <li>• Chiudere e riaprire l'applicazione</li>
                  <li>• Verificare che tutti i file audio siano validi</li>
                  <li>• Controllare che ci sia spazio sufficiente sul disco</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
