/**
 * 📱 QR CODE GENERATOR
 * Genera QR code per condivisione informazioni connessione
 */

export interface ConnectionQRData {
  sessionCode: string
  serverUrl: string
  publicIP: string
  port: number
  timestamp: number
  version: string
}

export class QRCodeGenerator {
  /**
   * Genera dati per QR code
   */
  static generateConnectionData(
    sessionCode: string,
    serverUrl: string,
    publicIP: string,
    port: number
  ): ConnectionQRData {
    return {
      sessionCode,
      serverUrl,
      publicIP,
      port,
      timestamp: Date.now(),
      version: '1.1.1'
    }
  }
  
  /**
   * Converte dati in stringa JSON per QR code
   */
  static toQRString(data: ConnectionQRData): string {
    return JSON.stringify(data)
  }
  
  /**
   * Parsa stringa QR code in dati
   */
  static fromQRString(qrString: string): ConnectionQRData | null {
    try {
      const data = JSON.parse(qrString)
      
      // Valida struttura dati
      if (!data.sessionCode || !data.serverUrl || !data.publicIP || !data.port) {
        throw new Error('Dati QR code non validi')
      }
      
      return data
    } catch (error) {
      console.error('❌ [QR CODE] Errore parsing QR code:', error)
      return null
    }
  }
  
  /**
   * Genera URL di connessione diretta
   */
  static generateDirectConnectionURL(data: ConnectionQRData): string {
    return `${data.serverUrl}/api/session/${data.sessionCode}`
  }
  
  /**
   * Valida se i dati QR code sono ancora validi (max 24h)
   */
  static isQRDataValid(data: ConnectionQRData): boolean {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 ore
    
    return (now - data.timestamp) < maxAge
  }
  
  /**
   * Genera testo per condivisione manuale
   */
  static generateShareText(data: ConnectionQRData): string {
    return `🎵 DJ Console - Sessione Collaborativa

📋 Codice Sessione: ${data.sessionCode}
🌐 Server: ${data.serverUrl}
🔗 IP Pubblico: ${data.publicIP}
⚡ Porta: ${data.port}

📱 ISTRUZIONI:
1. Apri DJ Console
2. Vai in "DJ Collaboratore"
3. Inserisci il codice: ${data.sessionCode}
4. Il sistema troverà automaticamente il server

🎤 Una volta connesso potrai:
- Attivare il microfono
- Partecipare al mix audio
- Interagire con il DJ titolare

Buon divertimento! 🎧`
  }
}

export default QRCodeGenerator
