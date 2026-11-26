param(
    [string]$AppDist = ""
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$marker = "agent-drawer-tabs/patch.js"

function Find-AppDist {
    $candidates = @()
    if ($env:PASEO_APP_DIST) { $candidates += $env:PASEO_APP_DIST }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA "Programs\Paseo\resources\app-dist") }
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles "Paseo\resources\app-dist") }
    if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} "Paseo\resources\app-dist") }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path (Join-Path $candidate "index.html"))) { return $candidate }
    }
    return $null
}

if (-not $AppDist) { $AppDist = Find-AppDist }
if (-not $AppDist -or -not (Test-Path (Join-Path $AppDist "index.html"))) {
    throw "找不到 Paseo 的 app-dist 目录。请用 -AppDist 指定。"
}

$index = Join-Path $AppDist "index.html"
$backup = "$index.agent-drawer.bak"
$target = Join-Path $AppDist "agent-drawer-tabs"

$html = [IO.File]::ReadAllText($index)
if (($html -match [regex]::Escape($marker)) -and (Test-Path $backup)) {
    Move-Item -Force $backup $index
    Write-Host "已还原 index.html"
} else {
    # Paseo 升级后 index.html 可能已是干净的新版本，不能用旧备份覆盖
    Write-Host "index.html 未处于注入状态，跳过还原"
    if (Test-Path $backup) { Remove-Item -Force $backup }
}

if (Test-Path $target) {
    Remove-Item -Recurse -Force $target
    Write-Host "已删除注入目录"
}

Write-Host "完成。按 Ctrl+Shift+R 重载界面，或重启 Paseo。"
