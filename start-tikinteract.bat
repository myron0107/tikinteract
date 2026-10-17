@echo off
setlocal
cd /d "%~dp0"

echo Verific Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo Node.js nu este instalat sau nu este disponibil in PATH.
    echo Instaleaza Node.js si redeschide acest fisier.
    pause
    exit /b 1
)

if not exist "node_modules\tiktok-live-connector\package.json" (
    echo Instalez componentele TikInteract...
    call npm.cmd install
    if errorlevel 1 (
        echo Instalarea a esuat. Verifica conexiunea la internet si incearca din nou.
        pause
        exit /b 1
    )
)

echo.
echo Pornesc TikInteract...
echo Dupa ce apare mesajul "TikInteract is ready", deschide:
echo http://127.0.0.1:3000
echo.
echo Lasa aceasta fereastra deschisa cat timp folosesti aplicatia.
echo Pentru oprire, apasa Ctrl+C.
echo.
call npm.cmd start

if errorlevel 1 (
    echo.
    echo Serverul s-a oprit din cauza unei erori.
    pause
)

endlocal
