param(
    [switch]$Force
)

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NaivecoinDir = Join-Path $RootDir "BlackCOIN"
$BotDir = Join-Path $RootDir "verification-bot"
$LogDir = Join-Path $RootDir "logs"

function Write-Status {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

function Test-Command {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Stop-All {
    Write-Status "Deteniendo procesos..." -Color Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
            if ($cmdLine -match "BlackCOIN|verification|blackcoin|index\.js|start\.js") {
                $_.Kill()
                Write-Status "  Detenido PID $($_.Id)" -Color Gray
            }
        } catch {}
    }
}

function Install-Deps {
    param([string]$Dir, [string]$Name)
    Write-Status "Instalando dependencias: $Name..." -Color Cyan
    Push-Location $Dir
    try {
        $output = npm install 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Status "Error en npm install para $Name" -Color Red
            Write-Host $output -ForegroundColor Red
            return $false
        }
        Write-Status "${Name}: dependencias OK" -Color Green
        return $true
    } finally {
        Pop-Location
    }
}

function Start-Naivecoin {
    Write-Status "Iniciando nodo BlackCOIN..." -Color Cyan

    $distFile = Join-Path $NaivecoinDir "dist\index.js"
    if (-not (Test-Path $distFile)) {
        Write-Status "Compilando TypeScript..." -Color Yellow
        Push-Location $NaivecoinDir
        try {
            npx tsc 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Status "Error compilando TypeScript" -Color Red
                return $false
            }
            Write-Status "Compilacion OK" -Color Green
        } finally {
            Pop-Location
        }
    }

    Push-Location $NaivecoinDir
    try {
        $logFile = Join-Path $LogDir "blackcoin.log"
        $scriptBlock = {
            param($dir, $log)
            Set-Location $dir
            $env:HTTP_PORT = "3001"
            $env:P2P_PORT = "6001"
            $env:DATA_DIR = Join-Path $dir "data"
            node dist/index.js *>> $log
        }
        $Global:NaivecoinJob = Start-Job -ScriptBlock $scriptBlock -ArgumentList $NaivecoinDir, $logFile

        Start-Sleep -Seconds 3

        $nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
            $_.StartTime -gt (Get-Date).AddSeconds(-10)
        }
        if (-not $nodeProcs) {
            $jobOutput = Receive-Job -Job $Global:NaivecoinJob -Keep
            Write-Status "Nodo no arranco:" -Color Red
            Write-Host $jobOutput -ForegroundColor Red
            return $false
        }

        Write-Status "Nodo BlackCOIN corriendo (PID: $($nodeProcs[0].Id))" -Color Green
        return $true
    } finally {
        Pop-Location
    }
}

function Start-Bot {
    Write-Status "Iniciando Verification Bot..." -Color Cyan

    $envFile = Join-Path $BotDir ".env"
    if (-not (Test-Path $envFile)) {
        Write-Status "ERROR: .env no encontrado en verification-bot" -Color Red
        return $false
    }

    Push-Location $BotDir
    try {
        $logFile = Join-Path $LogDir "bot.log"
        $scriptBlock = {
            param($dir, $log)
            Set-Location $dir
            node start.js *>> $log
        }
        $Global:BotJob = Start-Job -ScriptBlock $scriptBlock -ArgumentList $BotDir, $logFile

        Start-Sleep -Seconds 4

        $botProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
            $_.StartTime -gt (Get-Date).AddSeconds(-15)
        }
        if (-not $botProcs) {
            $jobOutput = Receive-Job -Job $Global:BotJob -Keep
            if ($jobOutput -match "TokenInvalid|invalid token") {
                Write-Status "ERROR: Token de Discord invalido en .env" -Color Red
            } else {
                Write-Status "Bot no arranco:" -Color Red
                Write-Host $jobOutput -ForegroundColor Red
            }
            return $false
        }

        Write-Status "Verification Bot corriendo (PID: $($botProcs[0].Id))" -Color Green
        return $true
    } finally {
        Pop-Location
    }
}

Clear-Host
Write-Host @"

██████╗ ██╗      █████╗  ██████╗██╗  ██╗ ██████╗ ██╗███╗   ██╗
██╔══██╗██║     ██╔══██╗██╔════╝██║ ██╔╝██╔═══██╗██║████╗  ██║
██████╔╝██║     ███████║██║     █████╔╝ ██║   ██║██║██╔██╗ ██║
██╔══██╗██║     ██╔══██║██║     ██╔═██╗ ██║   ██║██║██║╚██╗██║
██████╔╝███████╗██║  ██║╚██████╗██║  ██╗╚██████╔╝██║██║ ╚████║
╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝

"@ -ForegroundColor Cyan
Write-Host "  INICIANDO TODO EL PROYECTO...`n" -ForegroundColor Yellow

if (-not (Test-Command "node")) {
    Write-Status "ERROR: Node.js no instalado" -Color Red
    exit 1
}

Write-Status "Node.js $(node --version)" -Color Gray

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

Stop-All
Start-Sleep -Seconds 1

if (-not (Test-Path (Join-Path $NaivecoinDir "node_modules\express")) -or $Force) {
    if (-not (Install-Deps -Dir $NaivecoinDir -Name "BlackCOIN")) { exit 1 }
}

if (-not (Test-Path (Join-Path $BotDir "node_modules\discord.js")) -or $Force) {
    if (-not (Install-Deps -Dir $BotDir -Name "Verification Bot")) { exit 1 }
}

$nodeOk = Start-Naivecoin
if (-not $nodeOk) { exit 1 }

$botOk = Start-Bot
$allOk = $nodeOk -and $botOk

Clear-Host
Write-Host @"
╔══════════════════════════════════════════════════════╗
║               BLACKCOIN - INICIADO                    ║
╠══════════════════════════════════════════════════════╣
║  NODO:    http://localhost:3001                       ║
║  P2P:     ws://localhost:6001                         ║
║  TERMINAL: .\terminal.ps1                             ║
║  LOGS:    $LogDir                                     ║
╚══════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

if ($nodeOk) { Write-Host "  [NODO]  BLACKCOIN - OK" -ForegroundColor Green }
if ($botOk) { Write-Host "  [BOT]   DISCORD BOT - OK" -ForegroundColor Green }
if (-not $botOk) {
    Write-Host "  [BOT]   DISCORD BOT - FALLO (revisa .env token)" -ForegroundColor Red
    Write-Host "  El nodo sigue funcionando independientemente" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Ctrl+C para detener todo`n" -ForegroundColor Yellow

try {
    while ($true) {
        $nRunning = $false
        $bRunning = $false
        Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
                if ($cmd -match "BlackCOIN|dist/index\.js") { $nRunning = $true }
                if ($cmd -match "verification|start\.js") { $bRunning = $true }
            } catch {}
        }

        if (-not $nRunning) {
            Write-Status "NODO CAIDO - Reiniciando..." -Color Red
            Start-Naivecoin
        }
        if (-not $bRunning) {
            Write-Status "BOT CAIDO - Reiniciando..." -Color Yellow
            Start-Bot
        }

        if (-not $nRunning -and -not $bRunning) {
            Write-Status "Ambos procesos caidos. Saliendo..." -Color Red
            break
        }

        Start-Sleep -Seconds 10
    }
} finally {
    Write-Status "Limpiando procesos..." -Color Yellow
    Stop-All
    if ($Global:NaivecoinJob) { Remove-Job $Global:NaivecoinJob -Force -ErrorAction SilentlyContinue }
    if ($Global:BotJob) { Remove-Job $Global:BotJob -Force -ErrorAction SilentlyContinue }
    Write-Status "Todo detenido." -Color Green
}
