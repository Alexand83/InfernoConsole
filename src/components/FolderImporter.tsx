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
  preset: 'ultra-light' | 'light' | 'balanced' | 'performance' | 'custom'
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
    batchSize: 1,
    delayBetweenBatches: 500, // più reattivo
    skipWaveformGeneration: false, // ✅ Abilita waveform
    maxConcurrentFiles: 1,
    preset: 'balanced'
  })
  const folderInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastSelectedFilesRef = useRef<File[] | null>(null)
  
  // Crea un singolo FileUploadManager per tutta l'operazione
  const uploadManagerRef = useRef<FileUploadManager | null>(null)

  // ✅ PRESET: Configurazioni predefinite per diversi tipi di PC
  const importPresets = {
    'ultra-light': {
      name: 'PC Vecchissimi (4GB RAM)',
      description: 'Massima stabilità, 1 file alla volta, zero waveform',
      settings: {
        batchSize: 1,
        delayBetweenBatches: 2000,
        skipWaveformGeneration: true,
        maxConcurrentFiles: 1
      }
    },
    'light': {
      name: 'PC Vecchi (8GB RAM)',
      description: 'Stabilità alta, 2 file alla volta, waveform opzionali',
      settings: {
        batchSize: 2,
        delayBetweenBatches: 1000,
        skipWaveformGeneration: true,
        maxConcurrentFiles: 1
      }
    },
    'balanced': {
      name: 'PC Medi (16GB RAM)',
      description: 'Bilanciato, 5 file alla volta, waveform completi',
      settings: {
        batchSize: 5,
        delayBetweenBatches: 500,
        skipWaveformGeneration: false,
        maxConcurrentFiles: 2
      }
    },
    'performance': {
      name: 'PC Potenti (32GB+ RAM)',
      description: 'Massima velocità, 10 file alla volta, waveform completi',
      settings: {
        batchSize: 10,
        delayBetweenBatches: 200,
        skipWaveformGeneration: false,
        maxConcurrentFiles: 3
      }
    }
  }

  // ✅ PRESET HANDLERS: Gestione preset e impostazioni personalizzate
  const applyPreset = useCallback((presetKey: keyof typeof importPresets) => {
    const preset = importPresets[presetKey]
    console.log(`🎛️ [PRESET] Applicando preset: ${presetKey}`, preset.settings)
    setImportSettings({
      batchSize: preset.settings.batchSize,
      delayBetweenBatches: preset.settings.delayBetweenBatches,
      skipWaveformGeneration: preset.settings.skipWaveformGeneration,
      maxConcurrentFiles: preset.settings.maxConcurrentFiles,
      preset: presetKey
    })
  }, [])

  const updateCustomSettings = useCallback((updates: Partial<ImportSettings>) => {
    setImportSettings(prev => ({
      ...prev,
      ...updates,
      preset: 'custom'
    }))
  }, [])

  // ✅ ULTRA-LEGGERO: Calcola impostazioni per PC VECCHISSIMI (DEPRECATED - ora usiamo preset)
  const calculateOptimalSettings = useCallback((fileCount: number): ImportSettings => {
    // STRATEGIA ULTRA-LEGGERA: Processamento SERIALE per PC con 4GB RAM
    if (fileCount <= 10) {
      // Librerie minuscole - 1 file alla volta
      return {
        batchSize: 1, // ✅ ULTRA-LEGGERO: Solo 1 file alla volta
        delayBetweenBatches: 1000, // Pausa di 1 secondo
        skipWaveformGeneration: true, // ✅ ULTRA-LEGGERO: ZERO waveform
        maxConcurrentFiles: 1 // ✅ ULTRA-LEGGERO: SEMPRE 1 file alla volta
      }
    } else if (fileCount <= 50) {
      // Librerie piccole - 1 file alla volta con pause più lunghe
      return {
        batchSize: 1, // ✅ ULTRA-LEGGERO: Solo 1 file alla volta
        delayBetweenBatches: 2000, // Pausa di 2 secondi
        skipWaveformGeneration: true, // ✅ ULTRA-LEGGERO: ZERO waveform
        maxConcurrentFiles: 1 // ✅ ULTRA-LEGGERO: SEMPRE 1 file alla volta
      }
    } else if (fileCount <= 200) {
      // Librerie medie - 1 file alla volta con pause molto lunghe
      return {
        batchSize: 1, // ✅ ULTRA-LEGGERO: Solo 1 file alla volta
        delayBetweenBatches: 3000, // Pausa di 3 secondi
        skipWaveformGeneration: true, // ✅ ULTRA-LEGGERO: ZERO waveform
        maxConcurrentFiles: 1 // ✅ ULTRA-LEGGERO: SEMPRE 1 file alla volta
      }
    } else {
      // Librerie grandi - MASSIMA SICUREZZA per PC vecchissimi
      return {
        batchSize: 1, // ✅ ULTRA-LEGGERO: Solo 1 file alla volta
        delayBetweenBatches: 5000, // Pausa di 5 secondi per PC vecchissimi
        skipWaveformGeneration: true, // ✅ ULTRA-LEGGERO: ZERO waveform
        maxConcurrentFiles: 1 // ✅ ULTRA-LEGGERO: SEMPRE 1 file alla volta
      }
    }
  }, [])

  const runImportWithFiles = async (filesArray: File[]) => {
    try {
      console.log(`📁 [IMPORT] Usando preset: ${importSettings.preset}`)
      console.log(`📁 [IMPORT] Impostazioni:`, importSettings)
      console.log(`📁 [IMPORT] Batch Size: ${importSettings.batchSize}, Delay: ${importSettings.delayBetweenBatches}ms`)

      setIsImporting(true)
      setShowProgress(true)
      setTotalFiles(filesArray.length)
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

      const audioFiles = filesArray.filter(file => {
        const extension = file.name.toLowerCase().split('.').pop()
        return ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(extension || '')
      })

      if (audioFiles.length === 0) {
        alert('Nessun file audio trovato nella cartella selezionata')
        setIsImporting(false)
        setShowProgress(false)
        return
      }

      const progress = audioFiles.map(file => ({
        file: file.name,
        progress: 0,
        status: 'pending' as const
      }))
      setImportProgress(progress)

      const batchCount = Math.ceil(audioFiles.length / importSettings.batchSize)
      setTotalBatches(batchCount)

      // Nuovo abort controller (resettato ogni import)
      abortControllerRef.current = new AbortController()

      const { tracks: newTracks, errors } = await uploadInBatches(
        audioFiles,
        importSettings
      )
      
      if (newTracks.length > 0) {
        console.log(`🎉 [IMPORT] Import completato con ${newTracks.length} tracce`)
        setCompletedFiles(newTracks.length)
        
        // Notifica a tutta l'app che il database è cambiato
        console.log('📡 [IMPORT] Invio eventi di aggiornamento...')
        window.dispatchEvent(new CustomEvent('djconsole:db-updated'))
        window.dispatchEvent(new CustomEvent('djconsole:library-updated'))
        window.dispatchEvent(new CustomEvent('djconsole:playlist-updated'))
        window.dispatchEvent(new CustomEvent('djconsole:force-library-reload'))
        
        // Se disponibile, invoca un hook globale di refresh
        try { 
          (window as any).refreshLibrary?.() 
          console.log('✅ [IMPORT] refreshLibrary() chiamato')
        } catch (e) { console.warn('⚠️ [IMPORT] refreshLibrary() non disponibile:', e) }
        
        try { 
          (window as any).refreshPlaylists?.() 
          console.log('✅ [IMPORT] refreshPlaylists() chiamato')
        } catch (e) { console.warn('⚠️ [IMPORT] refreshPlaylists() non disponibile:', e) }
        
        onImportComplete()
      }

      if (errors.length > 0) {
        console.warn(`Import completed with ${errors.length} errors:`, errors)
        setImportProgress(prev => 
          prev.map(p => 
            errors.some(e => e.includes(p.file)) 
              ? { ...p, status: 'error' }
              : p
          )
        )
      }

      setTimeout(() => {
        setShowProgress(false)
        setIsImporting(false)
        setImportProgress([])
        setTotalFiles(0)
        setCompletedFiles(0)
        setCurrentBatch(0)
        setTotalBatches(0)
        // Dispatch finale per assicurare sync UI anche se in idle
        window.dispatchEvent(new CustomEvent('djconsole:db-updated'))
        window.dispatchEvent(new CustomEvent('djconsole:force-library-reload'))
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

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Memorizza ultimi file selezionati e resetta il value per consentire re-selezione stessa cartella
    lastSelectedFilesRef.current = Array.from(files)
    try { if (folderInputRef.current) folderInputRef.current.value = '' } catch {}

    await runImportWithFiles(lastSelectedFilesRef.current)
  }

  // Carica file in batch usando le impostazioni correnti (preset/custom)
  const uploadInBatches = async (files: File[], settings: ImportSettings): Promise<{ tracks: DatabaseTrack[], errors: string[] }> => {
    const tracks: DatabaseTrack[] = []
    const errors: string[] = []
    
    // Usa i parametri dal preset/setting selezionato
    const batchSize = Math.max(1, settings.batchSize)
    const delayBetweenBatches = Math.max(0, settings.delayBetweenBatches)
    const maxConcurrent = Math.max(1, settings.maxConcurrentFiles)
    const useUltraLight = settings.skipWaveformGeneration === true
    console.log(`🚀 [IMPORT] Config: batchSize=${batchSize}, delay=${delayBetweenBatches}ms, concurrent=${maxConcurrent}, ultraLight=${useUltraLight}`)
    
    // Calcola numero di batch
    const totalBatches = Math.ceil(files.length / batchSize)
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      // Controlla se l'operazione è stata cancellata
      if (abortControllerRef.current?.signal.aborted) {
        console.log('📁 [IMPORT] Operazione cancellata dall\'utente')
        throw new Error('Operazione cancellata dall\'utente')
      }
      
      const start = batchIndex * batchSize
      const end = Math.min(start + batchSize, files.length)
      const batch = files.slice(start, end)
      
      console.log(`📁 [IMPORT] Processando batch ${batchIndex + 1}/${totalBatches} (${batch.length} file)`)
      
      // Aggiorna progresso batch
      setCurrentBatch(batchIndex + 1)
      
      // Processa il batch rispettando il limite di concorrenza
      const batchResults: Array<DatabaseTrack | null> = []
      for (let i = 0; i < batch.length; i += maxConcurrent) {
        const group = batch.slice(i, i + maxConcurrent)
        const groupPromises = group.map(async (file) => {
          try {
            if (!uploadManagerRef.current) {
              throw new Error('FileUploadManager non inizializzato')
            }
            const method = useUltraLight ? 'processFileUltraLight' : 'processFileWithWaveform'
            console.log(`⚡ [IMPORT] ${method} → ${file.name}`)
            const track = useUltraLight
              ? await uploadManagerRef.current.processFileUltraLight(file, true)
              : await uploadManagerRef.current.processFileWithWaveform(file)
            if (track) {
              console.log(`✅ [IMPORT] File completato: ${file.name}`)
              return track as DatabaseTrack
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
        const groupResults = await Promise.all(groupPromises)
        batchResults.push(...groupResults)
      }
      const batchTracks = batchResults.filter((track): track is DatabaseTrack => track !== null)
      
      tracks.push(...batchTracks)
      setCompletedFiles(prev => prev + batchTracks.length)
      
      // Pausa tra i batch secondo impostazioni correnti
      if (batchIndex < totalBatches - 1) {
        console.log(`⏸️ [IMPORT] Pausa di ${delayBetweenBatches}ms tra batch`)
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
        
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
    // Reset stato UI per permettere re-import immediato
    setIsImporting(false)
    setShowProgress(false)
    setCurrentBatch(0)
    setTotalBatches(0)
    setCompletedFiles(0)
    // Mantieni lastSelectedFilesRef per re-import
    abortControllerRef.current = null
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

      {/* ✅ IMPOSTAZIONI IMPORT CON PRESET */}
      {showSettings && (
        <div className="mt-3 p-4 bg-dj-primary rounded-lg border border-dj-accent/20">
          <h3 className="text-lg font-semibold text-dj-light mb-4 flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Impostazioni Import
          </h3>
          
          {/* ✅ PRESET SELECTOR */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-dj-light/80 mb-2 block">Preset PC:</label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(importPresets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key as keyof typeof importPresets)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      importSettings.preset === key
                        ? 'border-green-500 bg-green-500/20 text-green-400 shadow-lg shadow-green-500/20'
                        : 'border-dj-secondary/50 bg-dj-secondary/10 text-dj-light/80 hover:border-green-400/50 hover:bg-green-500/10'
                    }`}
                  >
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="text-xs text-dj-light/60 mt-1">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* ✅ IMPOSTAZIONI PERSONALIZZATE */}
            {importSettings.preset === 'custom' && (
              <div className="space-y-3 pt-3 border-t border-dj-secondary/30">
                <div className="text-sm font-medium text-dj-light/80">Impostazioni Personalizzate:</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-dj-light/60">Batch Size:</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={importSettings.batchSize}
                      onChange={(e) => updateCustomSettings({ batchSize: Number(e.target.value) })}
                      className="w-full mt-1 bg-dj-secondary text-white text-sm rounded px-2 py-1"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-dj-light/60">Delay (ms):</label>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      step="100"
                      value={importSettings.delayBetweenBatches}
                      onChange={(e) => updateCustomSettings({ delayBetweenBatches: Number(e.target.value) })}
                      className="w-full mt-1 bg-dj-secondary text-white text-sm rounded px-2 py-1"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-dj-light/60">Concurrent Files:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={importSettings.maxConcurrentFiles}
                      onChange={(e) => updateCustomSettings({ maxConcurrentFiles: Number(e.target.value) })}
                      className="w-full mt-1 bg-dj-secondary text-white text-sm rounded px-2 py-1"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <label className="text-xs text-dj-light/60 flex items-center">
                      <input
                        type="checkbox"
                        checked={importSettings.skipWaveformGeneration}
                        onChange={(e) => updateCustomSettings({ skipWaveformGeneration: e.target.checked })}
                        className="mr-2"
                      />
                      Skip Waveform
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ INFO CURRENT SETTINGS */}
            <div className="text-xs text-dj-light/60 bg-green-500/10 p-3 rounded border border-green-500/30">
              <div className="font-medium mb-2 text-green-400 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" />
                Preset Attivo: {importPresets[importSettings.preset]?.name || 'Custom'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Batch: <span className="text-green-400 font-medium">{importSettings.batchSize}</span></div>
                <div>Delay: <span className="text-green-400 font-medium">{importSettings.delayBetweenBatches}ms</span></div>
                <div>Concurrent: <span className="text-green-400 font-medium">{importSettings.maxConcurrentFiles}</span></div>
                <div>Waveform: <span className="text-green-400 font-medium">{importSettings.skipWaveformGeneration ? '❌' : '✅'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* ✅ INFO IMPORT CORRENTE - COLORI CHIARI E LEGGIBILI */}
            {totalFiles > 0 && (
              <div className="text-sm text-white bg-gradient-to-r from-cyan-600/30 to-blue-600/30 p-4 rounded-lg border border-cyan-400/50 shadow-lg">
                <div className="flex items-center mb-3">
                  <div className="w-3 h-3 bg-cyan-400 rounded-full mr-3 animate-pulse"></div>
                  <strong className="text-cyan-200 text-lg">
                    🚀 Import {importSettings.preset === 'ultra-light' ? 'Ultra-Leggero' : 'Configurato'}
                  </strong>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center">
                    <span className="text-white/80 mr-2 font-medium">Preset:</span>
                    <span className="text-cyan-200 font-bold">{importPresets[importSettings.preset]?.name || 'Custom'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-white/80 mr-2 font-medium">Batch:</span>
                    <span className="text-cyan-200 font-bold">{importSettings.batchSize} file</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-white/80 mr-2 font-medium">Delay:</span>
                    <span className="text-cyan-200 font-bold">{importSettings.delayBetweenBatches}ms</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-white/80 mr-2 font-medium">Waveform:</span>
                    <span className="text-cyan-200 font-bold">{importSettings.skipWaveformGeneration ? '❌' : '✅'}</span>
                  </div>
                </div>
              </div>
            )}

      {/* ✅ BARRA DI PROGRESSO MIGLIORATA - COLORI CHIARI */}
      {isImporting && (
        <div className="mt-4 p-4 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 rounded-lg border border-emerald-400/40 shadow-lg">
          <div className="flex items-center justify-between text-base text-white mb-3">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-emerald-400 rounded-full mr-3 animate-pulse"></div>
              <span className="font-bold text-emerald-200">Progresso Import ({importPresets[importSettings.preset]?.name || 'Custom'})</span>
            </div>
            <span className="text-emerald-300 font-bold text-xl">{completedFiles} / {totalFiles}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500 shadow-lg"
              style={{ width: `${(completedFiles / totalFiles) * 100}%` }}
            />
          </div>
          <div className="text-sm text-white/90 mt-4 grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <span className="text-white/70 mr-2 font-medium">Batch:</span>
              <span className="text-emerald-300 font-bold">{currentBatch} / {Math.ceil(totalFiles / importSettings.batchSize)}</span>
            </div>
            <div className="flex items-center">
              <span className="text-white/70 mr-2 font-medium">Completato:</span>
              <span className="text-emerald-300 font-bold">{Math.round((completedFiles / totalFiles) * 100)}%</span>
            </div>
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
