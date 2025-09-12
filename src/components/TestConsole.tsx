import React, { useState, useEffect } from 'react'
import { localDatabase } from '../database/LocalDatabase'
import { useAudio } from '../contexts/AudioContext'
import { usePlaylist } from '../contexts/PlaylistContext'
import TestAudioControls from './TestAudioControls'

function createSilentWavBlob(durationSeconds: number = 1, sampleRate: number = 48000): Blob {  // ✅ FIX: Opus supporta 48000Hz
  const numChannels = 1
  const bitsPerSample = 16
  const numFrames = durationSeconds * sampleRate
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = numFrames * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size
  view.setUint16(20, 1, true) // AudioFormat PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // Data (silence)
  // Already zeroed by ArrayBuffer initialization

  return new Blob([buffer], { type: 'audio/wav' })
}

const TestConsole = () => {
  const [testResults, setTestResults] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const { playTrack } = useAudio()
  const { state: playlistState, createPlaylist } = usePlaylist()

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  const runTests = async () => {
    setIsRunning(true)
    setTestResults([])
    
    try {
      // Test 1: Database initialization
      addTestResult('Testing database initialization...')
      await localDatabase.waitForInitialization()
      addTestResult('✅ Database initialized successfully')
      
      // Test 2: Add test track
      addTestResult('Testing track addition...')
      const silentBlob = createSilentWavBlob(1)
      const objectUrl = URL.createObjectURL(silentBlob)
      const trackId = await localDatabase.addTrack({
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album',
        genre: 'Test',
        duration: 1,
        url: objectUrl,
        bpm: 128,
        key: 'C',
        energy: 'medium'
      })
      addTestResult(`✅ Track added with ID: ${trackId}`)
      
      // Test 3: Retrieve track
      addTestResult('Testing track retrieval...')
      const track = await localDatabase.getTrack(trackId)
      if (track) {
        addTestResult(`✅ Track retrieved: ${track.title} by ${track.artist}`)
      } else {
        addTestResult('❌ Failed to retrieve track')
      }
      
      // Test 4: Create playlist
      addTestResult('Testing playlist creation...')
      const playlistId = await localDatabase.createPlaylist({
        name: 'Test Playlist',
        description: 'A test playlist',
        tracks: [trackId],
        isAutoPlaylist: false
      })
      addTestResult(`✅ Playlist created with ID: ${playlistId}`)
      
      // Test 5: Get all tracks
      addTestResult('Testing get all tracks...')
      const allTracks = await localDatabase.getAllTracks()
      addTestResult(`✅ Retrieved ${allTracks.length} tracks`)
      
      // Test 6: Get all playlists
      addTestResult('Testing get all playlists...')
      const allPlaylists = await localDatabase.getAllPlaylists()
      addTestResult(`✅ Retrieved ${allPlaylists.length} playlists`)
      
      // Test 7: Search tracks
      addTestResult('Testing track search...')
      const searchResults = await localDatabase.searchTracks('Test')
      addTestResult(`✅ Search found ${searchResults.length} tracks`)
      
      // Test 8: Settings
      addTestResult('Testing settings...')
      await localDatabase.updateSettings({
        audio: { sampleRate: 48000, bitDepth: 24, bufferSize: 1024, latency: 20 }  // ✅ FIX: Opus supporta 48000Hz
      })
      const settings = await localDatabase.getSettings()
      addTestResult(`✅ Settings updated: ${settings.audio.sampleRate}Hz`)
      
      // Test 9: Statistics
      addTestResult('Testing statistics...')
      const stats = await localDatabase.getStats()
      addTestResult(`✅ Stats: ${stats.totalTracks} tracks, ${stats.totalPlaylists} playlists`)
      
      addTestResult('🎉 All tests completed successfully!')
      
    } catch (error) {
      addTestResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunning(false)
    }
  }

  const clearResults = () => {
    setTestResults([])
  }

  const testPlayTrack = () => {
    if (playlistState.library.tracks.length > 0) {
      const track = playlistState.library.tracks[0]
      playTrack({
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        url: track.url
      })
      addTestResult(`🎵 Playing track: ${track.title}`)
    } else {
      addTestResult('❌ No tracks available to play')
    }
  }

  const testCreatePlaylist = async () => {
    try {
      await createPlaylist('Test Playlist from Context', 'Created via context test')
      addTestResult('✅ Playlist created via context')
    } catch (error) {
      addTestResult(`❌ Failed to create playlist via context: ${error}`)
    }
  }

  return (
    <div className="h-full bg-dj-dark text-white p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-dj font-bold text-white mb-6">DJ Console Test Suite</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Test Controls */}
          <div className="bg-dj-secondary rounded-xl p-6 border border-dj-accent/20">
            <h2 className="text-xl font-dj font-bold text-white mb-4">Test Controls</h2>
            
            <div className="space-y-3">
              <button
                onClick={runTests}
                disabled={isRunning}
                className="w-full dj-button"
              >
                {isRunning ? 'Running Tests...' : 'Run All Tests'}
              </button>
              
              <button
                onClick={testPlayTrack}
                className="w-full dj-button-secondary"
              >
                Test Play Track
              </button>
              
              <button
                onClick={testCreatePlaylist}
                className="w-full dj-button-secondary"
              >
                Test Create Playlist
              </button>
              
              <button
                onClick={clearResults}
                className="w-full bg-dj-error hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
              >
                Clear Results
              </button>
            </div>
          </div>
          
          {/* Database Status */}
          <div className="bg-dj-secondary rounded-xl p-6 border border-dj-accent/20">
            <h2 className="text-xl font-dj font-bold text-white mb-4">Database Status</h2>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dj-light/60">Tracks:</span>
                <span className="text-white">{playlistState.library.tracks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dj-light/60">Playlists:</span>
                <span className="text-white">{playlistState.library.playlists.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dj-light/60">Genres:</span>
                <span className="text-white">{playlistState.library.genres.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dj-light/60">Artists:</span>
                <span className="text-white">{playlistState.library.artists.length}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Test Results */}
        <div className="bg-dj-secondary rounded-xl p-6 border border-dj-accent/20">
          <h2 className="text-xl font-dj font-bold text-white mb-4">Test Results</h2>
          
          {testResults.length === 0 ? (
            <p className="text-dj-light/60 text-center py-8">No tests run yet. Click "Run All Tests" to start.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono bg-dj-primary rounded p-2">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Audio Controls Test */}
        <div className="bg-dj-secondary rounded-xl p-6 border border-dj-accent/20 mt-6">
          <h2 className="text-xl font-dj font-bold text-white mb-4">🎵 Test Controlli Audio</h2>
          <TestAudioControls />
        </div>
      </div>
    </div>
  )
}

export default TestConsole
