@echo off
echo Creating self-signed certificate for Inferno Console...

REM Create private key
openssl genrsa -out inferno-console.key 2048

REM Create certificate signing request
openssl req -new -key inferno-console.key -out inferno-console.csr -subj "/C=IT/ST=Italy/L=Rome/O=Inferno Console Team/OU=Development/CN=Inferno Console"

REM Create self-signed certificate
openssl x509 -req -days 365 -in inferno-console.csr -signkey inferno-console.key -out inferno-console.crt

REM Convert to PFX format for Windows
openssl pkcs12 -export -out inferno-console.pfx -inkey inferno-console.key -in inferno-console.crt -password pass:inferno123

REM Create PEM format for macOS
openssl x509 -outform PEM -in inferno-console.crt -out inferno-console.pem

echo Certificate created successfully!
echo Files created:
echo - inferno-console.pfx (Windows)
echo - inferno-console.pem (macOS)
echo - inferno-console.key (Private key)
echo - inferno-console.crt (Certificate)
echo - inferno-console.csr (Certificate request)

pause
