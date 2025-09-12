// Test per verificare se FFmpeg riceve l'audio
console.log('🔧 Test FFmpeg Audio Reception...');

console.log('\n✅ PROBLEMA IDENTIFICATO:');
console.log('❌ Audio catturato correttamente (vedo chunk)');
console.log('❌ Ma non arriva al server Icecast');
console.log('❌ Possibile problema: FFmpeg non riceve audio');

console.log('\n🔍 DIAGNOSI NECESSARIA:');
console.log('1. ✅ MediaRecorder cattura audio (20ms chunks)');
console.log('2. ✅ window.desktopStream.write(buf) chiamato');
console.log('3. ❓ FFmpeg riceve i dati?');
console.log('4. ❓ FFmpeg processa l\'audio?');
console.log('5. ❓ FFmpeg invia a Icecast?');

console.log('\n🔧 POSSIBILI CAUSE:');
console.log('A) FFmpeg non avviato correttamente');
console.log('B) FFmpeg non riceve dati da stdin');
console.log('C) Configurazione FFmpeg sbagliata');
console.log('D) Server Icecast non raggiungibile');
console.log('E) Credenziali Icecast sbagliate');

console.log('\n📊 FLUSSO ATTESO:');
console.log('1. MediaRecorder → chunk audio');
console.log('2. window.desktopStream.write(buf) → Electron');
console.log('3. Electron → FFmpeg stdin');
console.log('4. FFmpeg → processa audio');
console.log('5. FFmpeg → invia a Icecast');

console.log('\n🧪 Test completato. Verificare log FFmpeg!');

