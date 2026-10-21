@echo off
title XP - verificare activare + sincronizare ora
echo ============================================
echo   1) Verificare activare Windows XP
echo ============================================
set ACT=
for /f "skip=1 tokens=1" %%a in ('wmic path Win32_WindowsProductActivation get ActivationRequired 2^>nul') do if not defined ACT set ACT=%%a
if "%ACT%"=="0" (
  echo   Windows XP este ACTIVAT.
) else if "%ACT%"=="1" (
  echo   Windows XP NU este activat.
  wmic path Win32_WindowsProductActivation get RemainingGracePeriod
) else (
  echo   Nu am putut citi starea. Deschid fereastra de activare...
  start "" "%SystemRoot%\system32\oobe\msoobe.exe" /a
)
echo.
echo ============================================
echo   2) Configurare sincronizare ora (NTP)
echo ============================================
net stop w32time >nul 2>&1
sc config w32time start= auto >nul
reg add "HKLM\SYSTEM\CurrentControlSet\Services\W32Time\Parameters" /v Type /t REG_SZ /d NTP /f >nul
reg add "HKLM\SYSTEM\CurrentControlSet\Services\W32Time\Parameters" /v NtpServer /t REG_SZ /d "pool.ntp.org,0x9 time.windows.com,0x9 ro.pool.ntp.org,0x9" /f >nul
reg add "HKLM\SYSTEM\CurrentControlSet\Services\W32Time\Config" /v MaxPosPhaseCorrection /t REG_DWORD /d 0xFFFFFFFF /f >nul
reg add "HKLM\SYSTEM\CurrentControlSet\Services\W32Time\Config" /v MaxNegPhaseCorrection /t REG_DWORD /d 0xFFFFFFFF /f >nul
reg add "HKLM\SYSTEM\CurrentControlSet\Services\W32Time\TimeProviders\NtpClient" /v SpecialPollInterval /t REG_DWORD /d 3600 /f >nul
net start w32time >nul 2>&1
w32tm /config /update >nul 2>&1

echo   Creez scriptul de sincronizare la pornire...
set TS=%SystemRoot%\xp_timesync.bat
> "%TS%" echo @echo off
>>"%TS%" echo rem asteapta reteaua (max ~2 min) si sincronizeaza ora
>>"%TS%" echo net start w32time ^>nul 2^>^&1
>>"%TS%" echo set N=0
>>"%TS%" echo :retry
>>"%TS%" echo set /a N+=1
>>"%TS%" echo ping -n 1 -w 2000 8.8.8.8 ^>nul 2^>^&1 ^&^& goto sync
>>"%TS%" echo if %%N%% GEQ 12 goto sync
>>"%TS%" echo ping -n 11 127.0.0.1 ^>nul
>>"%TS%" echo goto retry
>>"%TS%" echo :sync
>>"%TS%" echo w32tm /resync /rediscover ^>nul 2^>^&1
>>"%TS%" echo ping -n 6 127.0.0.1 ^>nul
>>"%TS%" echo w32tm /resync ^>nul 2^>^&1

schtasks /delete /tn "XP TimeSync" /f >nul 2>&1
schtasks /delete /tn "XP TimeSync Logon" /f >nul 2>&1
schtasks /create /tn "XP TimeSync" /tr "%SystemRoot%\xp_timesync.bat" /sc onstart /ru "System" >nul
schtasks /create /tn "XP TimeSync Logon" /tr "%SystemRoot%\xp_timesync.bat" /sc onlogon /ru "System" >nul
echo   Taskuri programate: "XP TimeSync" (la pornire) si "XP TimeSync Logon" (la logare).
echo.
echo   Sincronizez acum...
call "%SystemRoot%\xp_timesync.bat"
echo.
echo   Ora acum: %date% %time%
w32tm /resync
echo.
echo Gata. Apasa o tasta pentru inchidere.
pause >nul
