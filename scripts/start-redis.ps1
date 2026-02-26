# Script para iniciar Redis localmente (Windows)
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\start-redis.ps1

$RedisPath = ".\redis-new\redis-server.exe"
$ConfigFile = ".\redis-new\redis6380.conf"

Write-Host "🚀 Iniciando Redis Server..." -ForegroundColor Green

if (-not (Test-Path $RedisPath)) {
    Write-Host "❌ Erro: redis-server.exe não encontrado em $RedisPath" -ForegroundColor Red
    Write-Host "     Verifique se a pasta redis-new existe e contém os executáveis." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $ConfigFile)) {
    Write-Host "⚠️  Arquivo de configuração não encontrado: $ConfigFile" -ForegroundColor Yellow
    Write-Host "    Iniciando Redis com configuração padrão..." -ForegroundColor Yellow
    & $RedisPath
} else {
    & $RedisPath $ConfigFile
}

Write-Host ""
Write-Host "✅ Redis iniciado com sucesso!" -ForegroundColor Green
Write-Host "   Escutando em: localhost:6380" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para testar a conexão, execute em outro terminal:" -ForegroundColor Yellow
Write-Host "   .\redis-new\redis-cli.exe -p 6380 ping" -ForegroundColor Cyan
Write-Host ""
