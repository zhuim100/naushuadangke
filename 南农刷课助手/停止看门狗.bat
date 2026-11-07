@echo off
chcp 936 >nul
setlocal enabledelayedexpansion
set "PIDFILE=%LOCALAPPDATA%\NankaiKaoShi\logs\watchdog.pid"
if exist "%PIDFILE%" (
    set /p WPID=<"%PIDFILE%"
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Stop-Process -Id !WPID! -Force -ErrorAction SilentlyContinue"
    del "%PIDFILE%" >nul 2>&1
    echo 已停止看门狗 PID !WPID!
) else (
    echo 当前没有运行中的看门狗
)
timeout /t 3 >nul