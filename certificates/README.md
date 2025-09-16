# Certificati Self-Signed per Inferno Console

Questi certificati permettono di firmare l'applicazione Inferno Console senza problemi di sicurezza su Windows e macOS.

## File Creati

### Windows
- `inferno-console.pfx` - Certificato per Windows (password: inferno123)
- `inferno-console.cer` - Certificato in formato CER

### macOS
- `inferno-console-macos.p12` - Certificato per macOS (password: inferno123)
- `inferno-console-macos.pem` - Certificato in formato PEM

## Installazione Certificato Windows

1. **Installa il certificato nel sistema:**
   ```powershell
   Import-PfxCertificate -FilePath "inferno-console.pfx" -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher" -Password (ConvertTo-SecureString -String "inferno123" -Force -AsPlainText)
   ```

2. **Installa anche in Trusted Root:**
   ```powershell
   Import-PfxCertificate -FilePath "inferno-console.pfx" -CertStoreLocation "Cert:\LocalMachine\Root" -Password (ConvertTo-SecureString -String "inferno123" -Force -AsPlainText)
   ```

## Installazione Certificato macOS

1. **Installa il certificato:**
   ```bash
   security import inferno-console-macos.p12 -k ~/Library/Keychains/login.keychain -P inferno123
   ```

2. **Imposta come certificato di fiducia:**
   ```bash
   security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain inferno-console-macos.pem
   ```

## Configurazione Electron-Builder

Il certificato è già configurato in `build/electron-builder-multi.yml`:

```yaml
win:
  signAndEditExecutable: true
  cscLink: certificates/inferno-console.pfx
  cscKeyPassword: inferno123

mac:
  identity: "Inferno Console"
```

## Note di Sicurezza

- Questi sono certificati self-signed per sviluppo e distribuzione interna
- Per distribuzione pubblica, considera l'acquisto di un certificato commerciale
- I certificati sono validi per 365 giorni
- Password del certificato: `inferno123`

## Rigenerazione Certificati

Per rigenerare i certificati, esegui:

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File create-certificate.ps1
```

**macOS:**
```bash
chmod +x create-macos-certificate.sh
./create-macos-certificate.sh
```
