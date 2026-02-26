#!/usr/bin/env powershell
# Script para parar Redis
# Uso: npm run redis:stop

Write-Host "🛑 Parando Redis..." -ForegroundColor Yellow
Write-Host ""

try {
    # Kill redis-server process
    Get-Process redis-server -ErrorAction SilentlyContinue | Stop-Process -Force
    
    Write-Host "✅ Redis parado com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Redis não estava rodando" -ForegroundColor Yellow
}

Write-Host ""
