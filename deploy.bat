@echo off
cd /d "c:\Users\tungc\OneDrive\Máy tính\app xưởng"

REM Tu dong tang phien ban cache (sw.js) + splash (index.html) bang Node — doc/ghi UTF-8 chuan, khong lam hong tieng Viet
for /f "delims=" %%i in ('node deploy-bump.js') do set VERSION=%%i

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
