#!/usr/bin/env powershell
# Script para iniciar Redis e API em paralelo (Windows native Redis)
# Uso: npm run dev:redis

Write-Host "🚀 Iniciando Redis + API..." -ForegroundColor Cyan
Write-Host ""

$RedisExe = ".\redis-new\redis-server.exe"
$RedisConfig = ".\redis-new\redis6380.conf"

# Verificar se Redis existe
if (-not (Test-Path $RedisExe)) {
    Write-Host "❌ Redis não encontrado em $RedisExe" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Por favor, configure Redis manualmente:" -ForegroundColor Yellow
    Write-Host "   1. Coloque o redis-server.exe em ./redis-new/" -ForegroundColor Yellow
    Write-Host "   2. Configure a porta 6380 em ./redis-new/redis6380.conf" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Ou inicie Redis manualmente em outro terminal e execute:" -ForegroundColor Cyan
    Write-Host "   npm run dev" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Verificar se Redis já está rodando
Write-Host "🔍 Verificando se Redis está rodando na porta 6380..." -ForegroundColor Yellow
$redisRunning = $false
try {
    $netstat = netstat -ano | Select-String "6380"
    if ($netstat) {
        $redisRunning = $true
        Write-Host "✅ Redis já está rodando!" -ForegroundColor Green
    }
} catch {
    $redisRunning = $false
}

if (-not $redisRunning) {
    Write-Host "🚀 Iniciando Redis servidor..." -ForegroundColor Green
    
    if (Test-Path $RedisConfig) {
        Start-Process -FilePath $RedisExe -ArgumentList $RedisConfig -NoNewWindow -PassThru | Out-Null
    } else {
        Start-Process -FilePath $RedisExe -ArgumentList "--port", "6380" -NoNewWindow -PassThru | Out-Null
    }
    
    Write-Host "   Aguardando Redis inicializar..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    # Verificar se iniciou com sucesso
    $retries = 0
    while ($retries -lt 5) {
        try {
            $test = netstat -ano | Select-String "6380"
            if ($test) {
                Write-Host "✅ Redis iniciado com sucesso!" -ForegroundColor Green
                break
            }
        } catch {
            $retries++
            Write-Host "   Tentando novamente... ($retries/5)" -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }
}

Write-Host ""
Write-Host "🚀 Iniciando API em modo desenvolvimento..." -ForegroundColor Green
Write-Host ""

# Inicia a API
npm run dev

Write-Host ""
Write-Host "⚠️  Para parar Redis, execute em outro terminal:" -ForegroundColor Yellow
Write-Host "   npm run redis:stop" -ForegroundColor Cyan
Write-Host ""
