param(
  [string]$LogDir = "$PSScriptRoot"
)
$ErrorActionPreference = 'SilentlyContinue'

# 单实例：重复双击不会开出第二个
$mutex = New-Object System.Threading.Mutex($false, 'Local\NankaiKaoShiWatchdog')
if (-not $mutex.WaitOne(0)) { exit }

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$log = Join-Path $LogDir 'watchdog.log'
$pidFile = Join-Path $LogDir 'watchdog.pid'
Set-Content -Path $pidFile -Value $PID -Encoding ascii
$CONT = ([char]0x7EE7).ToString() + ([char]0x7EED).ToString()

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Log([string]$s) {
  [System.IO.File]::AppendAllText($log, ((Get-Date).ToString('HH:mm:ss') + '  ' + $s + "`r`n"), $utf8)
}

function Get-Url($win) {
  try {
    $all = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'view_1017')))
    foreach ($e in $all) {
      $v = $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value
      if ($v -and $v -match '^https?://') { return $v }
    }
  } catch {}
  return ''
}

Log '=== watchdog start ==='
while ($true) {
  try {
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $kids = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($k in $kids) {
      $procId = $k.Current.ProcessId
      if (-not $procId) { continue }
      $pname = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
      if ($pname -ne 'msedge') { continue }
      $url = Get-Url $k
      if ($url -notmatch 'wsdx\.njau\.edu\.cn') { continue }
      $all = $k.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
      foreach ($e in $all) {
        if ($e.Current.Name -eq $CONT -and $e.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and -not $e.Current.IsOffscreen) {
          try {
            $e.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
            Log ('clicked continue on ' + $url)
          } catch {
            Log ('invoke error: ' + $_.Exception.Message)
          }
          Start-Sleep -Milliseconds 500
        }
      }
    }
  } catch {
    Log ('loop error: ' + $_.Exception.Message)
  }
  Start-Sleep -Milliseconds 1200
}
