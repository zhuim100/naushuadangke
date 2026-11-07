@echo off
chcp 936 >nul
setlocal
set "DIR=%~dp0"
set "DST=%LOCALAPPDATA%\NankaiKaoShi\extension"

echo ============================================
echo   南农入党培训 - 刷课助手  安装
echo ============================================
echo.

if not exist "%DIR%extension\manifest.json" (
    echo [错误] 找不到 extension 文件夹，请把整个压缩包解压后再运行。
    pause
    exit /b 1
)

if not exist "%LOCALAPPDATA%\NankaiKaoShi" mkdir "%LOCALAPPDATA%\NankaiKaoShi"
if not exist "%DST%" mkdir "%DST%"
xcopy "%DIR%extension" "%DST%" /E /Y /I >nul
echo [1/3] 扩展文件已复制到：
echo       %DST%
echo.

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

echo [2/3] 正在打开 Edge ...
if exist "%EDGE%" (
    start "" "%EDGE%" "https://wsdx.njau.edu.cn/cjjy/lesson?stg=26"
) else (
    start "" "https://wsdx.njau.edu.cn/cjjy/lesson?stg=26"
)

echo.
echo [3/3] 请在弹出的 Edge 里完成 (只需一次)：
echo       1. 地址栏输入  edge://extensions  回车
echo       2. 打开左下角「开发人员模式」
echo       3. 点「加载解压缩的扩展」
echo       4. 选择这个文件夹：
echo          %DST%
echo.
echo 装好后回到课程中心，右下角会出现「刷课助手」面板。
echo 以后每次刷课：双击「开始刷课.bat」。
echo.
pause
