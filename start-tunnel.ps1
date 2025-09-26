# 🚀 Script PowerShell per avviare tunnel NGROK
Write-Host "🚀 Avvio Tunnel NGROK per DJ Console Remote..." -ForegroundColor Green
Write-Host "🌐 Porta: 8081 (WebSocket Server)" -ForegroundColor Cyan
Write-Host "📍 Regione: EU (Europa)" -ForegroundColor Yellow
Write-Host ""

# Avvia ngrok
try {
    & ngrok http 8081 --region=eu --log=stdout
} catch {
    Write-Host "❌ Errore avvio tunnel: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "❌ Tunnel chiuso!" -ForegroundColor Red
Read-Host "Premi ENTER per uscire"
