Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private -ErrorAction SilentlyContinue
netsh advfirewall firewall add rule name="CINTRA Backend 8000" dir=in action=allow protocol=TCP localport=8000 profile=any
netsh advfirewall firewall add rule name="CINTRA Backend 8001" dir=in action=allow protocol=TCP localport=8001 profile=any
netsh advfirewall firewall add rule name="CINTRA Expo 8081" dir=in action=allow protocol=TCP localport=8081 profile=any
Write-Host "====================================================" -ForegroundColor Green
Write-Host " SUCCESS: Wi-Fi Firewall & Network set to Private! " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Pause
