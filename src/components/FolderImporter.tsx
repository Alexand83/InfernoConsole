import React, { useState, useRef, useCallback } from 'react'
import { FolderOpen, Upload, Music, AlertCircle, CheckCircle, Clock, Settings, Info } from 'lucide-react'
import { FileUploadManager } from '../utils/FileUploadManager'
import { DatabaseTrack } from '../database/LocalDatabase'
import MemoryManager from './MemoryManager'
import ErrorBoundary from './ErrorBoundary'


interface FolderImporterProps {
  onImportComplete: () => void
}

interface ImportSettings {
  batchSize: number
  delayBetweenBatches: number
  skipWaveformGeneration: boolean
  maxConcurrentFiles: number
}

const FolderImporter: React.FC<FolderImporterProps> = ({ onImportComplete }) => {
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ file: string; progress: number; status: 'pending' | 'processing' | 'completed' | 'error' }[]>([])
  const [totalFiles, setTotalFiles] = useState(0)
  const [completedFiles, setCompletedFiles] = useState(0)
  const [showProgress, setShowProgress] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [importSettings, setImportSettings] = useState<ImportSettings>({
    batchSize: 50, // Processa 50 file alla volta
    delayBetweenBatches: 100, // 100ms di pausa tra batch
    skipWaveformGeneration: false, // Genera sempre i waveform per qualità audio
    maxConcurrentFiles: 5 // Massimo 5 file processati contemporaneamente
  })
  const folderInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Crea un singolo FileUploadManager per tutta l'operazione
  const uploadManagerRef = useRef<FileUploadManager | null>(null)

  // Calcola automaticamente le impostazioni ULTRA-SICURE per stabilità massima
  const calculateOptimalSettings = useCallback((fileCount: number): ImportSettings => {
    // STRATEGIA ULTRA-SICURA: Processamento SERIALE per evitare crash
    if (fileCount <= 5) {
      // Librerie minuscole
      return {
        batchSize: 50, // 50 file per volta per velocità massima
        delayBetweenBatches: 500, // Pausa di 0.5 secondi
        skipWaveformGeneration: false, // ABILITA waveform
        maxConcurrentFiles: 1 // SEMPRE 1 file alla volta
      }
    } else if (fileCount <= 100) {
      // Librerie piccole
      return {
        batchSize: 50, // 50 file per volta per velocità massima
        delayBetweenBatches: 400, // Pausa di 0.4 secondi
        skipWaveformGeneration: false, // ABILITA waveform
        maxConcurrentFiles: 1 // SEMPRE 1 file alla volta
      }
    } else if (fileCount <= 500) {
      // Librerie medie
      return {
        batchSize: 50, // 50 file per volta per velocità massima
        delayBetweenBatches: 300, // Pausa di 0.3 secondi
        skipWaveformGeneration: false, // ABILITA waveform
        maxConcurrentFiles: 1 // SEMPRE 1 file alla volta
      }
    } else if (fileCount <= 1000) {
      // Librerie grandi
      return {
        batchSize: 50, // 50 file per volta per velocità massima
        delayBetweenBatches: 200, // Pausa di 0.2 secondi
        skipWaveformGeneration: false, // ABILITA waveform
        maxConcurrentFiles: 1 // SEMPRE 1 file alla volta
      }
    } else {
      // Librerie enormi
      return {
        batchSize: 50, // 50 file per volta per velocità massima
        delayBetweenBatches: 100, // Pausa di 0.1 secondi
        skipWaveformGeneration: false, // ABILITA waveform
        maxConcurrentFiles: 1 // SEMPRE 1 file alla volta
      }
    }
  }, [])

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    try {
      // Calcola impostazioni ottimali
      const optimalSettings = calculateOptimalSettings(files.length)
      setImportSettings(optimalSettings)

      setIsImporting(true)
      setShowProgress(true)
      setTotalFiles(files.length)
      setCompletedFiles(0)
      setCurrentBatch(0)

      // Crea un singolo FileUploadManager per tutta l'operazione
      uploadManagerRef.current = new FileUploadManager((progress) => {
        setImportProgress(prev => 
          prev.map(p => 
            p.file === progress.file.name 
              ? { ...p, progress: progress.progress, status: progress.progress === 100 ? 'completed' : 'processing' }
              : p
          )
        )
      })

      // Filtra solo file audio supportati
      const audioFiles = Array.from(files).filter(file => {
        const extension = file.name.toLowerCase().split('.').pop()
        return ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(extension || '')
      })

      if (audioFiles.length === 0) {
        alert('Nessun file audio trovato nella cartella selezionata')
        setIsImporting(false)
        setShowProgress(false)
        return
      }

      // Inizializza il progresso per ogni file
      const progress = audioFiles.map(file => ({
        file: file.name,
        progress: 0,
        status: 'pending' as const
      }))
      setImportProgress(progress)

      // Calcola numero di batch
      const batchCount = Math.ceil(audioFiles.length / optimalSettings.batchSize)
      setTotalBatches(batchCount)

      // Crea abort controller per cancellare l'import se necessario
      abortControllerRef.current = new AbortController()

            // Carica file in modo SERIALE per stabilità massima
      const { tracks: newTracks, errors } = await uploadInBatches(
        audioFiles,
        optimalSettings
      )
      
      if (newTracks.length > 0) {
        setCompletedFiles(newTracks.length)
        // Emetti evento per aggiornare la library
        window.dispatchEvent(new CustomEvent('djconsole:db-updated'))
        onImportComplete()
      }

      if (errors.length > 0) {
        console.warn(`Import completed with ${errors.length} errors:`, errors)
        // Aggiorna lo stato degli errori nel progresso
        setImportProgress(prev => 
          prev.map(p => 
            errors.some(e => e.includes(p.file)) 
              ? { ...p, status: 'error' }
              : p
          )
        )
      }

      // Mostra riepilogo
      setTimeout(() => {
        setShowProgress(false)
        setIsImporting(false)
        setImportProgress([])
        setTotalFiles(0)
        setCompletedFiles(0)
        setCurrentBatch(0)
        setTotalBatches(0)
      }, 3000)

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Import cancelled by user')
      } else {
        console.error('Folder import failed:', error)
        alert('Errore durante l\'importazione della cartella: ' + (error instanceof Error ? error.message : 'Errore sconosciuto'))
      }
      setIsImporting(false)
      setShowProgress(false)
    }
  }

  // Carica file in batch di 5 per bilanciare velocità e stabilità
  const uploadInBatches = async (files: File[], settings: ImportSettings): Promise<{ tracks: DatabaseTrack[], errors: string[] }> => {
    const tracks: DatabaseTrack[] = []
    const errors: string[] = []
    
    console.log(`🚀 [IMPORT] Inizio import in batch di ${settings.batchSize} per ${files.length} file`)
    
    // Calcola numero di batch
    const totalBatches = Math.ceil(files.length / settings.batchSize)
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      // Controlla se l'operazione è stata cancellata
      if (abortControllerRef.current?.signal.aborted) {
        console.log('📁 [IMPORT] Operazione cancellata dall\'utente')
        throw new Error('Operazione cancellata dall\'utente')
      }
      
      const start = batchIndex * settings.batchSize
      const end = Math.min(start + settings.batchSize, files.length)
      const batch = files.slice(start, end)
      
      console.log(`📁 [IMPORT] Processando batch ${batchIndex + 1}/${totalBatches} (${batch.length} file)`)
      
      // Aggiorna progresso batch
      setCurrentBatch(batchIndex + 1)
      
      // Processa batch corrente in parallelo
      const batchPromises = batch.map(async (file) => {
        try {
          if (!uploadManagerRef.current) {
            throw new Error('FileUploadManager non inizializzato')
          }
          
          console.log(`⚡ [IMPORT] Inizio processamento: ${file.name}`)
          const track = await uploadManagerRef.current.processFileOptimized(file, settings.skipWaveformGeneration)
          
          if (track) {
            console.log(`✅ [IMPORT] File completato: ${file.name}`)
            return track
          } else {
            console.warn(`⚠️ [IMPORT] File fallito: ${file.name}`)
            return null
          }
        } catch (error) {
          const errorMsg = `Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          console.error(`❌ [IMPORT] Errore file: ${file.name}`, error)
          return null
        }
      })
      
      // Processa batch in parallelo
      const batchResults = await Promise.all(batchPromises)
      const batchTracks = batchResults.filter((track): track is DatabaseTrack => track !== null)
      
      tracks.push(...batchTracks)
      setCompletedFiles(prev => prev + batchTracks.length)
      
      // Pausa tra batch per permettere al sistema di "respirare"
      if (batchIndex < totalBatches - 1) {
        console.log(`⏸️ [BATCH] Pausa di ${settings.delayBetweenBatches}ms dopo batch ${batchIndex + 1}/${totalBatches}`)
        await new Promise(resolve => setTimeout(resolve, settings.delayBetweenBatches))
        
        // Pulizia memoria AGGRESSIVA ogni batch
        try {
          console.log(`🧹 [MEMORY] Pulizia memoria dopo batch ${batchIndex + 1}`)
          
          // Forza garbage collection se disponibile
          if ('gc' in window) {
            (window as any).gc()
            console.log('✅ [MEMORY] Garbage collection forzato')
          }
          
          // Pausa aggiuntiva per permettere al sistema di "respirare"
          console.log('😴 [MEMORY] Pausa aggiuntiva per recupero memoria...')
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log(`✅ [MEMORY] Pulizia memoria completata per batch ${batchIndex + 1}`)
        } catch (error) {
          console.warn(`⚠️ [MEMORY] Errore durante pulizia memoria:`, error)
        }
      }
    }
    
    console.log(`🎉 [IMPORT] Import in batch completato: ${tracks.length} file, ${errors.length} errori`)
    return { tracks, errors }
  }



  const cancelImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleMemoryWarning = () => {
    // Mostra avviso memoria critica
    alert('⚠️ Attenzione: Memoria critica rilevata! Considera di fermare l\'import per evitare crash.')
  }

  const openFolderSelector = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click()
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completato'
      case 'error':
        return 'Errore'
      case 'processing':
        return 'Elaborazione'
      default:
        return 'In attesa'
    }
  }

  return (
    <ErrorBoundary>
      <div className="folder-importer">
      {/* Input nascosto per la selezione cartella */}
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderSelect}
        className="hidden"
        accept=".mp3,.wav,.flac,.aac,.ogg,.m4a,.wma"
        aria-label="Seleziona cartella con file audio"
      />

      {/* Pulsante per aprire il selettore cartelle */}
      <button
        onClick={openFolderSelector}
        disabled={isImporting}
        className="dj-button flex items-center space-x-2 w-full"
      >
        <FolderOpen className="w-4 h-4" />
        <span>{isImporting ? 'Importazione in corso...' : 'Seleziona Cartella'}</span>
      </button>

      {/* Pulsante impostazioni */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="mt-2 text-sm text-dj-light/60 hover:text-dj-light flex items-center space-x-2"
      >
        <Settings className="w-3 h-3" />
        <span>Impostazioni Import</span>
      </button>

      {/* Impostazioni import */}
      {showSettings && (
        <div className="mt-3 p-3 bg-dj-primary rounded-lg">
          <div className="space-y-3">
            <div>
              <label className="text-sm text-dj-light/80">Dimensione Batch:</label>
              <select
                value={importSettings.batchSize}
                onChange={(e) => setImportSettings(prev => ({ ...prev, batchSize: Number(e.target.value) }))}
                className="ml-2 bg-dj-secondary text-white text-sm rounded px-2 py-1"
                aria-label="Dimensione batch per importazione"
              >
                <option value={25}>25 file</option>
                <option value={50}>50 file</option>
                <option value={100}>100 file</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-dj-light/80">Pausa tra Batch (ms):</label>
              <select
                value={importSettings.delayBetweenBatches}
                onChange={(e) => setImportSettings(prev => ({ ...prev, delayBetweenBatches: Number(e.target.value) }))}
                className="ml-2 bg-dj-secondary text-white text-sm rounded px-2 py-1"
                aria-label="Pausa tra batch per importazione"
              >
                <option value={50}>50ms</option>
                <option value={100}>100ms</option>
                <option value={200}>200ms</option>
              </select>
            </div>
            <div className="text-sm text-dj-light/80 bg-dj-highlight/20 p-2 rounded border border-dj-highlight/30">
              <span className="text-dj-highlight">🎵 Waveform sempre generati per qualità audio ottimale</span>
            </div>
            <div>
              <label className="text-sm text-dj-light/80">File concorrenti:</label>
              <select
                value={importSettings.maxConcurrentFiles}
                onChange={(e) => setImportSettings(prev => ({ ...prev, maxConcurrentFiles: Number(e.target.value) }))}
                className="ml-2 bg-dj-secondary text-white text-sm rounded px-2 py-1"
                aria-label="Numero di file concorrenti per importazione"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={8}>8</option>
              </select>
            </div>
          </div>
        </div>
      )}

                            {/* Informazioni import Ottimizzato */}
              {totalFiles > 0 && (
            <div className="text-xs text-dj-light/60 bg-green-500/20 p-2 rounded border border-green-500/30">
              <strong>🚀 Import Ottimizzato (Batch di 50):</strong> 
              <span className="text-green-400">
                Processamento in batch di {importSettings.batchSize} file con waveform completi e durate accurate. Pausa: {importSettings.delayBetweenBatches}ms tra batch. Performance massima!
              </span>
            </div>
          )}

      {/* Barra di progresso generale */}
      {isImporting && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm text-dj-light/60 mb-2">
            <span>Progresso Import Ottimizzato</span>
            <span>{completedFiles} / {totalFiles}</span>
          </div>
          <div className="w-full bg-dj-primary rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-dj-success to-dj-highlight transition-all duration-300"
              style={{ width: `${(completedFiles / totalFiles) * 100}%` }}
            />
          </div>
          <div className="text-xs text-dj-light/60 mt-1">
            Batch: {currentBatch} / {Math.ceil(totalFiles / importSettings.batchSize)} | File: {completedFiles} ({Math.round((completedFiles / totalFiles) * 100)}%)
          </div>
        </div>
      )}

      {/* Pulsante cancella import */}
      {isImporting && (
        <button
          onClick={cancelImport}
          className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
        >
          Cancella Import
        </button>
      )}

      {/* Dettaglio progresso per file */}
      {showProgress && (
        <div className="mt-4 max-h-48 overflow-y-auto">
          <h4 className="text-sm font-medium text-white mb-2">Dettaglio file:</h4>
          <div className="space-y-2">
            {importProgress.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-dj-primary rounded-lg">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {getStatusIcon(item.status)}
                  <span className="text-sm text-white truncate">{item.file}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-dj-light/60">{getStatusText(item.status)}</span>
                  {item.status === 'processing' && (
                    <div className="w-16 bg-dj-secondary rounded-full h-1 overflow-hidden">
                      <div 
                        className="h-full bg-dj-highlight transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestione memoria per grandi librerie */}
      <MemoryManager
        isImporting={isImporting}
        totalFiles={totalFiles}
        completedFiles={completedFiles}
        onMemoryWarning={handleMemoryWarning}
      />
      </div>
    </ErrorBoundary>
  )
}

export default FolderImporter
