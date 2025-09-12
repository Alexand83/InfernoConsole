/**
 * Streaming Diagnostic Tool
 * Tests the Icecast server connection and identifies potential issues
 */

console.log('🔍 [STREAMING DIAGNOSTIC] Starting diagnostic tests...')

// Test configuration
const testConfig = {
  host: '82.145.63.6',
  port: 5040,
  mount: '/stream',
  username: 'source',
  password: '811126864dj',
  useSSL: false
}

async function runDiagnosticTests() {
  console.log('🔍 [DIAGNOSTIC] Test configuration:', {
    ...testConfig,
    password: '[HIDDEN]'
  })

  // Test 1: Basic HTTP connectivity
  console.log('🧪 [TEST 1] Testing basic HTTP connectivity...')
  try {
    const response = await fetch(`http://${testConfig.host}:${testConfig.port}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    console.log('✅ [TEST 1] HTTP connection successful:', response.status, response.statusText)
  } catch (error) {
    console.log('❌ [TEST 1] HTTP connection failed:', error.message)
  }

  // Test 2: Icecast mount point accessibility
  console.log('🧪 [TEST 2] Testing Icecast mount point...')
  try {
    const mountUrl = `http://${testConfig.host}:${testConfig.port}${testConfig.mount}`
    const response = await fetch(mountUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    })
    console.log('✅ [TEST 2] Mount point accessible:', response.status, response.statusText)
    
    // Check headers
    console.log('📊 [TEST 2] Response headers:')
    for (const [key, value] of response.headers.entries()) {
      console.log(`   ${key}: ${value}`)
    }
  } catch (error) {
    console.log('❌ [TEST 2] Mount point test failed:', error.message)
  }

  // Test 3: Authentication test
  console.log('🧪 [TEST 3] Testing authentication...')
  try {
    const authUrl = `http://${testConfig.host}:${testConfig.port}${testConfig.mount}`
    const authString = btoa(`${testConfig.username}:${testConfig.password}`)
    
    const response = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`
      },
      signal: AbortSignal.timeout(5000)
    })
    console.log('✅ [TEST 3] Authentication test:', response.status, response.statusText)
  } catch (error) {
    console.log('❌ [TEST 3] Authentication test failed:', error.message)
  }

  // Test 4: FFmpeg command simulation
  console.log('🧪 [TEST 4] Simulating FFmpeg command...')
  const ffmpegCommand = [
    'ffmpeg',
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'webm',
    '-i', 'pipe:0',
    '-fflags', '+flush_packets',
    '-avoid_negative_ts', 'make_zero',
    '-max_muxing_queue_size', '64',
    '-max_delay', '0',
    '-probesize', '32',
    '-analyzeduration', '0',
    '-vn', '-map', 'a',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-q:a', '2',
    '-content_type', 'audio/mpeg',
    '-ice_name', 'DJ Console',
    '-ice_description', 'Live',
    '-ice_genre', 'Various',
    '-ice_public', '1',
    '-legacy_icecast', '1',
    '-f', 'mp3',
    `icecast://${testConfig.username}:${testConfig.password}@${testConfig.host}:${testConfig.port}${testConfig.mount}`
  ]
  
  console.log('📋 [TEST 4] FFmpeg command:')
  console.log(ffmpegCommand.join(' ').replace(testConfig.password, '[HIDDEN]'))

  // Test 5: Network connectivity
  console.log('🧪 [TEST 5] Testing network connectivity...')
  try {
    const startTime = Date.now()
    const response = await fetch(`http://${testConfig.host}:${testConfig.port}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    })
    const endTime = Date.now()
    const latency = endTime - startTime
    
    console.log('✅ [TEST 5] Network connectivity OK')
    console.log(`📊 [TEST 5] Latency: ${latency}ms`)
    console.log(`📊 [TEST 5] Response time: ${response.status} ${response.statusText}`)
  } catch (error) {
    console.log('❌ [TEST 5] Network connectivity failed:', error.message)
  }

  // Test 6: Check if server supports the required features
  console.log('🧪 [TEST 6] Checking server capabilities...')
  try {
    const response = await fetch(`http://${testConfig.host}:${testConfig.port}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    
    const serverHeader = response.headers.get('server')
    const contentType = response.headers.get('content-type')
    
    console.log('📊 [TEST 6] Server info:')
    console.log(`   Server: ${serverHeader || 'Unknown'}`)
    console.log(`   Content-Type: ${contentType || 'Unknown'}`)
    
    if (serverHeader && serverHeader.toLowerCase().includes('icecast')) {
      console.log('✅ [TEST 6] Icecast server detected')
    } else {
      console.log('⚠️ [TEST 6] Server type unclear - may not be Icecast')
    }
  } catch (error) {
    console.log('❌ [TEST 6] Server capability check failed:', error.message)
  }

  console.log('🔍 [STREAMING DIAGNOSTIC] Diagnostic tests completed.')
  console.log('💡 [SUGGESTIONS] If tests failed:')
  console.log('   1. Check if the Icecast server is running')
  console.log('   2. Verify the host, port, and mount point')
  console.log('   3. Check username and password credentials')
  console.log('   4. Ensure the server accepts the audio format (MP3)')
  console.log('   5. Check firewall settings')
  console.log('   6. Verify the server supports the required Icecast protocol version')
}

// Run the diagnostic tests
runDiagnosticTests().catch(console.error)
