@echo off
echo 🚀 Avvio Tunnel NGROK per DJ Console Remote...
echo 🌐 Porta: 8081 (WebSocket Server)
echo 📍 Regione: EU (Europa)
echo.

ngrok http 8081 --region=eu --log=stdout

echo.
echo ❌ Tunnel chiuso!
pause
