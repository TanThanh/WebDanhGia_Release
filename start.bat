@echo off
title Khoi dong Web Danh Gia Ren Luyen

echo ===================================================
echo      DANG KHOI DONG HE THONG...
echo ===================================================
echo.
echo He thong dang khoi dong va se tu dong mo trinh duyet sau 5 giay...
echo Neu trinh duyet khong tu mo, vui long vao thu cong:
echo =^> http://127.0.0.1:31851
echo.
echo (Luu y: KHONG TAT cua so mau den nay trong suot qua trinh lam viec)
echo ===================================================
echo.

start /min cmd /c "timeout /t 5 >nul && start http://127.0.0.1:31851"

call npm run dev

pause
