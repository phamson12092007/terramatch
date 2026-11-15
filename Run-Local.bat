@echo off
setlocal
set "PROJECT_DIR=%~dp0"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"
set "DIST_DIR=%FRONTEND_DIR%\dist"
set "SERVER_SCRIPT=%FRONTEND_DIR%\serve-dist.mjs"
set "API_SCRIPT=%FRONTEND_DIR%\local-api.mjs"
set "NODE_EXE="
set "PORT="

if not exist "%DIST_DIR%\index.html" (
  echo The prebuilt website files are missing: frontend\dist\index.html
  echo Rebuild the frontend with: cd frontend ^&^& npm ci ^&^& npm run build
  pause
  exit /b 1
)

REM Reuse the local Node installation, or the bundled Codex runtime on this computer.
where node.exe >nul 2>nul
if not errorlevel 1 set "NODE_EXE=node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not defined NODE_EXE (
  echo Node.js is required to run this local preview.
  echo Install Node.js 20.19 or newer from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

if not exist "%API_SCRIPT%" (
  echo The bundled local data API is missing: frontend\local-api.mjs
  pause
  exit /b 1
)

echo Starting TerraMatch local API with the source-backed lunar and Earth records.
start "TerraMatch Local Data API" "%NODE_EXE%" "%API_SCRIPT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "for ($i=0; $i -lt 30; $i++) { try { $r=Invoke-RestMethod -TimeoutSec 1 'http://127.0.0.1:8000/api/health'; if ($r.data_mode -eq 'REAL_ONLY_LOCAL_SNAPSHOT') { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo The local data API did not start. Port 8000 may already be in use.
  echo Close the other server window or check whether Node.js is blocked, then try again.
  pause
  exit /b 1
)

REM Ask Windows for an unused loopback port so another app cannot block startup.
for /f %%P in ('powershell -NoProfile -Command "$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0); $listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop(); Write-Output $port"') do set "PORT=%%P"
if not defined PORT (
  echo Could not find an available local port.
  pause
  exit /b 1
)

echo Starting the prebuilt TerraMatch preview at http://127.0.0.1:%PORT%/
start "TerraMatch Local Server" "%NODE_EXE%" "%SERVER_SCRIPT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "for ($i=0; $i -lt 20; $i++) { try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:%PORT%/'; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo The local preview did not start. Check whether port %PORT% is already in use.
  echo You can close the server window and try again.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:%PORT%/"
echo TerraMatch is open in your browser.
echo To stop the local server, close its TerraMatch Local Server window.
timeout /t 3 >nul
endlocal
