#!/usr/bin/env node

/**
 * Test script per verificare il mix audio
 * Questo script testa la creazione di un MediaStream mixato
 * per identificare problemi nel sistema di streaming
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎵 Test Audio Mix - Verifica sistema di streaming\n');

// ✅ CRITICAL FIX: Definisci la funzione globalmente
let createMockMix;

// Test 1: Verifica supporto Web Audio API
console.log('1️⃣ Test supporto Web Audio API...');
try {
  // Simula un ambiente browser
  global.window = {
    AudioContext: class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
      }
      createMediaStreamDestination() {
        return {
          stream: {
            active: true,
            getTracks: () => [{ kind: 'audio', enabled: true, readyState: 'live' }]
          }
        };
      }
      createGain() {
        return {
          gain: { value: 1.0 },
          connect: () => {},
          disconnect: () => {}
        };
      }
      createOscillator() {
        return {
          frequency: { setValueAtTime: () => {} },
          connect: () => {},
          start: () => {},
          stop: () => {}
        };
      }
      createMediaElementSource() {
        return {
          connect: () => {},
          disconnect: () => {}
        };
      }
      createMediaStreamSource() {
        return {
          connect: () => {},
          disconnect: () => {}
        };
      }
      resume() {}
    },
    webkitAudioContext: null
  };
  
  global.MediaRecorder = class MockMediaRecorder {
    constructor(stream, options) {
      this.stream = stream;
      this.options = options;
      this.state = 'inactive';
      this.mimeType = options.mimeType;
      this.audioBitsPerSecond = options.audioBitsPerSecond;
    }
    
    start(timeslice) {
      this.state = 'recording';
      console.log(`   ✅ MediaRecorder started with ${timeslice}ms timeslice`);
      console.log(`   📡 Stream active: ${this.stream.active}`);
      console.log(`   📡 Stream tracks: ${this.stream.getTracks().length}`);
    }
    
    stop() {
      this.state = 'inactive';
      console.log('   ✅ MediaRecorder stopped');
    }
  };
  
  global.navigator = {
    mediaDevices: {
      getUserMedia: async (constraints) => {
        console.log('   🎤 getUserMedia called with constraints:', constraints);
        return {
          active: true,
          getTracks: () => [{ kind: 'audio', enabled: true, readyState: 'live' }]
        };
      }
    }
  };
  
  console.log('   ✅ Mock environment created successfully');
} catch (error) {
  console.error('   ❌ Failed to create mock environment:', error.message);
  process.exit(1);
}

// Test 2: Test creazione mix audio
console.log('\n2️⃣ Test creazione mix audio...');
try {
  // ✅ CRITICAL FIX: Definisci la funzione createMockMix
  createMockMix = () => {
    console.log('   🎤 Creating mock mixed stream...');
    
    // Crea un AudioContext mock
    const mixContext = new window.AudioContext();
    const destination = mixContext.createMediaStreamDestination();
    const mixerGain = mixContext.createGain();
    
    console.log('   ✅ AudioContext created, state:', mixContext.state);
    
    // Simula deck sinistro
    try {
      const leftOsc = mixContext.createOscillator();
      const leftGain = mixContext.createGain();
      leftGain.gain.value = 0.5;
      leftOsc.connect(leftGain);
      leftGain.connect(mixerGain);
      leftOsc.start();
      console.log('   🎵 Left deck oscillator added');
    } catch (error) {
      console.warn('   ⚠️ Could not add left deck:', error.message);
    }
    
    // Simula deck destro
    try {
      const rightOsc = mixContext.createOscillator();
      const rightGain = mixContext.createGain();
      rightGain.gain.value = 0.5;
      rightOsc.connect(rightGain);
      rightGain.connect(mixerGain);
      rightOsc.start();
      console.log('   🎵 Right deck oscillator added');
    } catch (error) {
      console.warn('   ⚠️ Could not add right deck:', error.message);
    }
    
    // Simula microfono
    try {
      const micGain = mixContext.createGain();
      micGain.gain.value = 0.3;
      micGain.connect(mixerGain);
      console.log('   🎤 Microphone added to mix');
    } catch (error) {
      console.warn('   ⚠️ Could not add microphone:', error.message);
    }
    
    // Connessione finale
    mixerGain.connect(destination);
    
    console.log('   ✅ Mix created successfully');
    console.log('   📡 Final stream tracks:', destination.stream.getTracks().length);
    
    return destination.stream;
  };
  
  const mixedStream = createMockMix();
  
  if (mixedStream && mixedStream.active && mixedStream.getTracks().length > 0) {
    console.log('   ✅ Mixed stream is valid and active');
  } else {
    console.error('   ❌ Mixed stream is invalid or inactive');
    process.exit(1);
  }
  
} catch (error) {
  console.error('   ❌ Failed to create mock mix:', error.message);
  process.exit(1);
}

// Test 3: Test MediaRecorder con il mix
console.log('\n3️⃣ Test MediaRecorder con mix audio...');
try {
  const mixedStream = createMockMix();
  
  // Crea MediaRecorder
  const mediaRecorder = new MediaRecorder(mixedStream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 128000
  });
  
  console.log('   📡 MediaRecorder created:', {
    state: mediaRecorder.state,
    mimeType: mediaRecorder.mimeType,
    audioBitsPerSecond: mediaRecorder.audioBitsPerSecond
  });
  
  // Test eventi
  let dataReceived = false;
  let started = false;
  let stopped = false;
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      dataReceived = true;
      console.log(`   📡 Audio data received: ${event.data.size} bytes`);
    } else {
      console.warn('   ⚠️ Empty audio data received');
    }
  };
  
  mediaRecorder.onstart = () => {
    started = true;
    console.log('   ✅ MediaRecorder started');
  };
  
  mediaRecorder.onstop = () => {
    stopped = true;
    console.log('   ✅ MediaRecorder stopped');
  };
  
  mediaRecorder.onerror = (event) => {
    console.error('   ❌ MediaRecorder error:', event.error?.message || 'Unknown error');
  };
  
  // Avvia registrazione
  mediaRecorder.start(100);
  
  // Simula registrazione per 500ms
  setTimeout(() => {
    mediaRecorder.stop();
    
    // Verifica risultati
    setTimeout(() => {
      console.log('\n📊 Risultati test:');
      console.log(`   Data received: ${dataReceived ? '✅' : '❌'}`);
      console.log(`   Started: ${started ? '✅' : '❌'}`);
      console.log(`   Stopped: ${stopped ? '✅' : '❌'}`);
      
      if (dataReceived && started && stopped) {
        console.log('\n🎉 Test completato con successo! Il mix audio dovrebbe funzionare.');
      } else {
        console.log('\n⚠️ Test completato con problemi. Potrebbero esserci problemi nel mix audio.');
      }
    }, 100);
  }, 500);
  
} catch (error) {
  console.error('   ❌ Failed to test MediaRecorder:', error.message);
  process.exit(1);
}

// Test 4: Verifica configurazione Icecast
console.log('\n4️⃣ Test configurazione Icecast...');
try {
  const testConfig = {
    host: 'localhost',
    port: 8000,
    mountpoint: '/live',
    username: 'source',
    password: 'hackme',
    useSSL: false
  };
  
  console.log('   📡 Test Icecast config:', {
    host: testConfig.host,
    port: testConfig.port,
    mountpoint: testConfig.mountpoint,
    username: testConfig.username,
    password: testConfig.password ? `[${testConfig.password.length} caratteri]` : '[VUOTA]',
    useSSL: testConfig.useSSL
  });
  
  // Verifica che i parametri siano validi
  if (testConfig.host && testConfig.port > 0 && testConfig.mountpoint) {
    console.log('   ✅ Configurazione Icecast valida');
  } else {
    console.error('   ❌ Configurazione Icecast non valida');
  }
  
} catch (error) {
  console.error('   ❌ Failed to test Icecast config:', error.message);
}

console.log('\n🎯 Test completati!');
console.log('\n💡 Suggerimenti per risolvere il problema del silenzio:');
console.log('   1. Verifica che i deck abbiano audio attivo');
console.log('   2. Controlla che il microfono sia abilitato e funzionante');
console.log('   3. Verifica che il MediaRecorder riceva dati audio');
console.log('   4. Controlla i log della console per errori specifici');
console.log('   5. Verifica che il server Icecast sia raggiungibile');
console.log('   6. Controlla che le credenziali Icecast siano corrette');
console.log('\n🔧 Per debug avanzato, controlla i log della console del browser.');
