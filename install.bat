@echo off
title Cai dat va Khoi dong Web Danh Gia Ren Luyen

echo ===================================================
echo      CAI DAT VA KHOI DONG HE THONG
echo ===================================================
echo.

:: 1. Kiem tra Node.js
echo [1/3] Kiem tra moi truong Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js!
    echo Vui long tai va cai dat Node.js tai: https://nodejs.org/
    echo Sau khi cai dat xong, hay chay lai file install.bat nay.
    echo.
    pause
    exit /b 1
)
echo =^> Node.js da duoc cai dat.
echo.

:: 2. Cai dat thu vien
echo [2/3] Dang tai va cai dat cac thu vien can thiet...
echo Vui long doi trong giay lat (1-2 phut).
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Co loi xay ra trong qua trinh cai dat thu vien (npm install).
    echo Vui long kiem tra lai mang.
    echo.
    pause
    exit /b 1
)
echo =^> Cai dat thu vien thanh cong!
echo.

:: 3. Khoi chay
echo [3/3] Dang khoi dong may chu web...
echo.
echo ===================================================
echo  HE THONG DA SAN SANG!
echo  Truy cap vao web tai: http://127.0.0.1:31851
echo  (Luu y: Giu nguyen cua so mau den nay de duy tri web)
echo ===================================================
echo.

call npm run dev

pause
