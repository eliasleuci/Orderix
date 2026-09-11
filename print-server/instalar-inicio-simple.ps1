# ============================================================
# Arranque automático simple (sin permisos de administrador)
# ============================================================
# Deja un acceso directo en la carpeta de Inicio de Windows, así el servidor
# de impresión se levanta solo -y sin ventana visible- cada vez que el usuario
# inicia sesión.
#
# Es la alternativa al servicio de Windows. Más simple, pero:
#   - arranca recién cuando alguien inicia sesión, no al prender la máquina
#   - si el proceso se cae, no se vuelve a levantar solo
#
# Uso:  powershell -ExecutionPolicy Bypass -File instalar-inicio-simple.ps1
# ============================================================

$carpeta = Split-Path -Parent $MyInvocation.MyCommand.Path
$lanzador = Join-Path $carpeta "iniciar-oculto.vbs"
$inicio = [Environment]::GetFolderPath('Startup')
$acceso = Join-Path $inicio "Orderix - Servidor de impresion.lnk"

if (-not (Test-Path $lanzador)) {
    Write-Host "  No se encontro iniciar-oculto.vbs en esta carpeta." -ForegroundColor Red
    exit 1
}

$ws = New-Object -ComObject WScript.Shell
$acc = $ws.CreateShortcut($acceso)
$acc.TargetPath = "wscript.exe"
$acc.Arguments = "`"$lanzador`""
$acc.WorkingDirectory = $carpeta
$acc.Description = "Servidor de impresion de Orderix"
$acc.Save()

Write-Host ""
Write-Host "  LISTO. El servidor de impresion va a arrancar solo" -ForegroundColor Green
Write-Host "  cada vez que se inicie sesion en esta computadora."
Write-Host ""
Write-Host "  Acceso directo creado en:"
Write-Host "  $acceso"
Write-Host ""
Write-Host "  Para probarlo ahora sin reiniciar:"
Write-Host "     wscript iniciar-oculto.vbs"
Write-Host "  y despues abrir http://localhost:3001/status"
Write-Host ""
Write-Host "  Para sacarlo, borrar ese acceso directo."
Write-Host "  (tecla Windows + R, escribir shell:startup)"
Write-Host ""
