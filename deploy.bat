@echo off
cd /d "c:\Users\tungc\OneDrive\Máy tính\app xưởng"

REM Tu dong tang phien ban cache trong sw.js (v20 -> v21 -> ...) truoc khi deploy
for /f "delims=" %%i in ('powershell -NoProfile -Command "$p=(Resolve-Path sw.js).Path; $c=Get-Content $p -Raw; $m=[regex]::Match($c,'xuong-sx-v(\d+)'); $n=[int]$m.Groups[1].Value+1; $c=[regex]::Replace($c,'xuong-sx-v\d+',('xuong-sx-v'+$n)); [System.IO.File]::WriteAllText($p,$c); ('xuong-sx-v'+$n)"') do set VERSION=%%i

echo.
echo ================================
echo   Dang deploy phien ban: %VERSION%
echo ================================
echo.

git add .
git commit -m "Deploy %VERSION%"
git push

echo.
echo === Da deploy %VERSION% thanh cong! ===
pause
