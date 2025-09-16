# Create self-signed certificate for macOS using PowerShell
Write-Host "Creating self-signed certificate for macOS..." -ForegroundColor Green

# Create certificate for macOS
$macCert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Inferno Console, O=Inferno Console Team, C=IT" -KeyUsage DigitalSignature -FriendlyName "Inferno Console macOS Code Signing" -CertStoreLocation "Cert:\CurrentUser\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")

Write-Host "macOS Certificate created with thumbprint: $($macCert.Thumbprint)" -ForegroundColor Yellow

# Export to PFX format (compatible with macOS)
$password = ConvertTo-SecureString -String "inferno123" -Force -AsPlainText
Export-PfxCertificate -Cert $macCert -FilePath "inferno-console-macos.pfx" -Password $password

# Also export to CER format
Export-Certificate -Cert $macCert -FilePath "inferno-console-macos.cer"

Write-Host "macOS Certificate exported to:" -ForegroundColor Green
Write-Host "- inferno-console-macos.pfx (for macOS)" -ForegroundColor Yellow
Write-Host "- inferno-console-macos.cer (certificate only)" -ForegroundColor Yellow
Write-Host "Password: inferno123" -ForegroundColor Yellow

Write-Host "macOS certificate creation completed!" -ForegroundColor Green
