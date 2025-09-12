export async function generateWaveformPeaksFromBlob(blob: Blob, numSamples = 200): Promise<number[]> {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
    const ac = new AudioCtx()
    const audioBuffer: AudioBuffer = await ac.decodeAudioData(arrayBuffer)
    // Close to free resources
    try { if ((ac as any).state !== 'closed') await ac.close() } catch {}

    const channelData = audioBuffer.getChannelData(0)
    if (!channelData || channelData.length === 0) return []

    const blockSize = Math.max(1, Math.floor(channelData.length / numSamples))
    const peaks: number[] = []
    for (let i = 0; i < numSamples; i++) {
      const start = i * blockSize
      const end = Math.min(start + blockSize, channelData.length)
      let max = 0
      for (let j = start; j < end; j++) {
        const v = Math.abs(channelData[j])
        if (v > max) max = v
      }
      peaks.push(Math.min(1, max))
    }
    return peaks
  } catch (err) {
    return []
  }
}


