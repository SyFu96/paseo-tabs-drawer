param(
    [string]$AppDist = ""
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$source = Join-Path $PSScriptRoot "agent-drawer-tabs"
$targetVersion = "0.17.4"
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
    throw "找不到 Paseo 的 app-dist 目录。请用 -AppDist 指定，例如：`n  .\apply.ps1 -AppDist `"C:\Users\<you>\AppData\Local\Programs\Paseo\resources\app-dist`""
}

$index = Join-Path $AppDist "index.html"
$backup = "$index.agent-drawer.bak"
$target = Join-Path $AppDist "agent-drawer-tabs"

# 版本提示：不阻止安装，只是提醒
$installRoot = Split-Path (Split-Path $AppDist -Parent) -Parent
$exe = Join-Path $installRoot "Paseo.exe"
if (Test-Path $exe) {
    $ver = (Get-Item $exe).VersionInfo.ProductVersion
    if ($ver -and ($ver -notlike "$targetVersion*")) {
        Write-Warning "此补丁按 Paseo $targetVersion 编写，当前为 $ver；若界面没变化，说明 DOM 结构变了。"
    }
}

if (-not (Test-Path $source)) { throw "缺少 agent-drawer-tabs 目录，请保持压缩包结构完整。" }

if (Test-Path $target) { Remove-Item -Recurse -Force $target }
Copy-Item -Recurse -Force $source $target

# 未注入说明是全新安装或 Paseo 升级后的干净文件，此时重新备份
$html = [IO.File]::ReadAllText($index)
if ($html -notmatch [regex]::Escape($marker)) {
    Copy-Item $index $backup -Force

    $snippet = @"
    <!-- agent-drawer-tabs -->
    <link rel="stylesheet" href="/agent-drawer-tabs/patch.css" />
    <script src="/agent-drawer-tabs/patch.js" defer></script>
"@
    if ($html -notmatch "</body>") { throw "index.html 里没有 </body>，注入点不对。" }
    $html = $html -replace "</body>", "$snippet`r`n  </body>"
    [IO.File]::WriteAllText($index, $html, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "已注入：$index"
} else {
    Write-Host "index.html 已注入过，保留现有备份"
}

Write-Host "完成（目标：$AppDist）。回到 Paseo 按 Ctrl+Shift+R，或重启应用。"
