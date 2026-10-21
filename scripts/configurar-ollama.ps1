# Autoriza a Excel Dashboard a usar los modelos locales de Ollama desde el navegador.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/configurar-ollama.ps1
$origenes = "https://excel-dashboard-beta.vercel.app,http://localhost:3000"
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", $origenes, "User")
$env:OLLAMA_ORIGINS = $origenes
Get-Process ollama* -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$app = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama app.exe"
if (Test-Path $app) { Start-Process $app } else { Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden }
Start-Sleep -Seconds 4
try {
  $r = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Headers @{ Origin = "https://excel-dashboard-beta.vercel.app" } -UseBasicParsing
  Write-Host "Ollama listo. Modelos:" ($r.Content | ConvertFrom-Json).models.name
} catch { Write-Host "Ollama no respondió todavía; abre la app y pulsa «Volver a detectar»." }
