@echo off
chcp 936 >nul
setlocal
set "DIR=%~dp0"
set "LOG=%LOCALAPPDATA%\NankaiKaoShi\logs"

if not exist "%LOG%" mkdir "%LOG%"

echo ============================================
echo   南农入党培训 - 刷课助手  启动
echo ============================================
echo.

if not exist "%DIR%watchdog\watchdog.ps1" (
    echo [错误] 找不到 watchdog\watchdog.ps1
    pause
    exit /b 1
)

start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%DIR%watchdog\watchdog.ps1" -LogDir "%LOG%"
echo [1/2] 防挂机看门狗已启动（后台，负责点掉「继续」弹窗）
echo       日志：%LOG%\watchdog.log
echo.

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

echo [2/2] 正在打开课程中心 ...
if exist "%EDGE%" (
    start "" "%EDGE%" "https://wsdx.njau.edu.cn/cjjy/lesson?stg=26"
) else (
    start "" "https://wsdx.njau.edu.cn/cjjy/lesson?stg=26"
)

echo.
echo 接下来：
echo   1. 确认已登录
echo   2. 在网页右下角红色面板点「开始连续刷课」
echo   3. 浏览器如果提示自动播放被拦截，在页面上随便点一下
echo.
echo 刷课期间：不要关标签页，电脑别睡眠，Edge 提示开发人员模式扩展时选「保留」。
echo.
timeout /t 8 >nul
