# Create self-signed certificate for Inferno Console
Write-Host "Creating self-signed certificate for Inferno Console..." -ForegroundColor Green

# Create certificate
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Inferno Console, O=Inferno Console Team, C=IT" -KeyUsage DigitalSignature -FriendlyName "Inferno Console Code Signing" -CertStoreLocation "Cert:\CurrentUser\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")

Write-Host "Certificate created with thumbprint: $($cert.Thumbprint)" -ForegroundColor Yellow

# Export to PFX
$password = ConvertTo-SecureString -String "inferno123" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "inferno-console.pfx" -Password $password

Write-Host "Certificate exported to inferno-console.pfx" -ForegroundColor Green
Write-Host "Password: inferno123" -ForegroundColor Yellow

# Also export to CER format
Export-Certificate -Cert $cert -FilePath "inferno-console.cer"

Write-Host "Certificate also exported to inferno-console.cer" -ForegroundColor Green
Write-Host "Certificate creation completed!" -ForegroundColor Green
