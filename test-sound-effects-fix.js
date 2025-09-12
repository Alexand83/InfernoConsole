/**
 * Test script to verify sound effects are working properly
 * This script tests the AudioContext sharing between main audio system and sound effects
 */

console.log('🧪 [TEST] Testing Sound Effects AudioContext Fix...')

// Test 1: Check if ensureMainAudioContext is available
console.log('🧪 [TEST 1] Checking ensureMainAudioContext availability...')
if (typeof window.ensureMainAudioContext === 'function') {
  console.log('✅ [TEST 1] ensureMainAudioContext is available')
  
  // Test 2: Create main AudioContext
  console.log('🧪 [TEST 2] Creating main AudioContext...')
  const mainContext = window.ensureMainAudioContext()
  if (mainContext) {
    console.log('✅ [TEST 2] Main AudioContext created successfully')
    console.log('📊 [TEST 2] AudioContext state:', mainContext.state)
    console.log('📊 [TEST 2] AudioContext sample rate:', mainContext.sampleRate)
    
    // Test 3: Check if globalAudioContext is exposed
    console.log('🧪 [TEST 3] Checking globalAudioContext exposure...')
    if (window.globalAudioContext) {
      console.log('✅ [TEST 3] globalAudioContext is exposed globally')
      console.log('📊 [TEST 3] globalAudioContext === mainContext:', window.globalAudioContext === mainContext)
    } else {
      console.log('❌ [TEST 3] globalAudioContext is NOT exposed globally')
    }
    
    // Test 4: Test sound effects manager initialization
    console.log('🧪 [TEST 4] Testing SoundEffectsManager initialization...')
    if (window.SoundEffectsManager) {
      console.log('✅ [TEST 4] SoundEffectsManager class is available')
      
      // Create a test instance
      const testManager = new window.SoundEffectsManager()
      testManager.setCallbacks({
        onDebug: (msg) => console.log('🎵 [SOUND EFFECTS]', msg),
        onError: (err) => console.error('❌ [SOUND EFFECTS]', err)
      })
      
      // Wait a bit for initialization
      setTimeout(() => {
        if (testManager.isReady()) {
          console.log('✅ [TEST 4] SoundEffectsManager initialized successfully')
          
          // Test 5: Test sound effect playback
          console.log('🧪 [TEST 5] Testing sound effect playback...')
          testManager.playSoundEffect('beep', 0.5).then((success) => {
            if (success) {
              console.log('✅ [TEST 5] Sound effect played successfully!')
              console.log('🎉 [TEST] All tests passed! Sound effects should now work properly.')
            } else {
              console.log('❌ [TEST 5] Sound effect playback failed')
            }
          })
        } else {
          console.log('❌ [TEST 4] SoundEffectsManager failed to initialize')
        }
      }, 2000)
      
    } else {
      console.log('❌ [TEST 4] SoundEffectsManager class is NOT available')
    }
    
  } else {
    console.log('❌ [TEST 2] Failed to create main AudioContext')
  }
} else {
  console.log('❌ [TEST 1] ensureMainAudioContext is NOT available')
}

console.log('🧪 [TEST] Test script completed. Check console for results.')
