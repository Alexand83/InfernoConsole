@echo off
echo ========================================
echo INFERNO CONSOLE INSTALLER
echo ========================================

set INSTALL_DIR=%1
if "%INSTALL_DIR%"=="" set INSTALL_DIR=%USERPROFILE%\Desktop\InfernoConsole

echo Installing to: %INSTALL_DIR%

echo Creating directory...
mkdir "%INSTALL_DIR%" 2>nul

echo Downloading application...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/Alexand83/InfernoConsole/releases/latest/download/Inferno-Console-win.exe' -OutFile '%INSTALL_DIR%\Inferno Console.exe'"

echo Creating desktop shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\Inferno Console.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\Inferno Console.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Description = 'Inferno Console'; $Shortcut.Save()"

echo Installation completed!
echo.
echo Press any key to launch Inferno Console...
pause >nul

echo Launching application...
start "" "%INSTALL_DIR%\Inferno Console.exe"
exit
