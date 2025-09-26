# 🌐 DJ Console Remote - Tunnel Setup

## 🎯 CONNESSIONE DA RETE REMOTA

### 📋 **PREREQUISITI**:
- ✅ ngrok installato e configurato
- ✅ Account ngrok attivo 
- ✅ Authtoken configurato

### 🚀 **AVVIO TUNNEL**:

#### **Windows (Batch)**:
```cmd
start-tunnel.bat
```

#### **Windows (PowerShell)**:
```powershell
.\start-tunnel.ps1
```

#### **Manuale**:
```cmd
ngrok http 8081 --region=eu
```

### 🔗 **OTTENERE URL PUBBLICO**:

1. **Avvia tunnel** (uno degli script sopra)
2. **Cerca nel output**:
   ```
   Forwarding  https://abc123.ngrok-free.app -> http://localhost:8081
   ```
3. **Copia URL**: `https://abc123.ngrok-free.app`

### 🎮 **CONNESSIONE CLIENT REMOTO**:

1. **Nel client remoto**: Inserisci come Host IP:
   ```
   b086f1ed5a43.ngrok-free.app
   ```
   ⚠️ **SENZA** `https://` o `wss://` (viene aggiunto automaticamente)

2. **Clicca CONNETTI** → Dovrebbe funzionare da qualsiasi rete!

### 🔍 **TROUBLESHOOTING**:

#### ❌ **Errore "tunnel not found"**:
- Riavvia il tunnel
- Controlla che la porta 8081 sia libera

#### ❌ **Client non si connette**:
- Verifica URL tunnel (cambia ad ogni riavvio)
- Controlla firewall Windows
- Testa con: `telnet abc123.ngrok-free.app 443`

#### ❌ **WebRTC non funziona**:
- STUN server automatico gestisce NAT
- Se fallisce → Aggiungere TURN server

### 🎯 **URL ATTUALE**:
```
🌐 PUBBLICO: https://b086f1ed5a43.ngrok-free.app
🔄 WebSocket: wss://b086f1ed5a43.ngrok-free.app  
📍 Host IP per client: b086f1ed5a43.ngrok-free.app
```
