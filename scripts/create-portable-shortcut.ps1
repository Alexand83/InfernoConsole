# Script PowerShell per creare shortcut per app portabili
param(
    [string]$ExePath,
    [string]$DesktopPath,
    [string]$AppName = "Inferno Console"
)

try {
    Write-Host "🔗 [SHORTCUT] Creazione shortcut portabile per: $AppName"
    Write-Host "🔗 [SHORTCUT] Target: $ExePath"
    Write-Host "🔗 [SHORTCUT] Desktop: $DesktopPath"
    
    # Crea lo shortcut usando WScript.Shell
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($DesktopPath)
    $Shortcut.TargetPath = $ExePath
    $Shortcut.WorkingDirectory = Split-Path $ExePath -Parent
    $Shortcut.Description = "$AppName - DJ Software"
    $Shortcut.Save()
    
    Write-Host "✅ [SHORTCUT] Shortcut portabile creato con successo!"
    return $true
} catch {
    Write-Error "❌ [SHORTCUT] Errore creazione shortcut: $($_.Exception.Message)"
    return $false
}
