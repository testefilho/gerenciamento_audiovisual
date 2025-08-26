param()
# Script de conveniência: inicia o servidor (se não estiver rodando) e abre o navegador no endereço local
Write-Output 'Iniciando servidor http-server (em background)...'
Start-Process -FilePath pwsh -ArgumentList '-NoProfile -Command "npm run serve"' -WindowStyle Hidden
Start-Sleep -Seconds 1
$uri = 'http://127.0.0.1:5500'
Write-Output "Abrindo $uri no navegador padrão..."
Start-Process $uri
