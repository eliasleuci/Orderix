# ============================================================
# Instalador todo-en-uno — Servidor de impresión Orderix
# ============================================================
# Hace todo lo que antes había que hacer a mano:
#   1. Instala Node.js si no está
#   2. Copia esta carpeta a la ubicación fija C:\Orderix\print-server
#   3. Instala las dependencias (npm install)
#   4. Configura la impresora (preguntando, o dejando modo simulación)
#   5. Lo deja arrancando solo con Windows (servicio; si no hay permisos
#      de administrador, usa la carpeta de Inicio como alternativa)
#   6. Verifica que haya quedado funcionando
#
# Uso: doble clic en INSTALAR.bat (este script se auto-eleva a admin solo).
# Se puede correr desde un pendrive, el Escritorio, Descargas, donde sea.
# Volver a ejecutarlo no rompe nada: detecta lo que ya está hecho.
# ============================================================

$ErrorActionPreference = 'Stop'
$CarpetaDestino = 'C:\Orderix\print-server'

function Titulo($texto) {
    Write-Host ''
    Write-Host "== $texto ==" -ForegroundColor Cyan
}
function Ok($texto) { Write-Host "  [OK] $texto" -ForegroundColor Green }
function Info($texto) { Write-Host "  $texto" }
function Advertencia($texto) { Write-Host "  [!] $texto" -ForegroundColor Yellow }
function Falla($texto) { Write-Host "  [ERROR] $texto" -ForegroundColor Red }

# ------------------------------------------------------------
# 0. Auto-elevar a administrador si hace falta
# ------------------------------------------------------------
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
    Write-Host 'Este instalador necesita permisos de administrador. Reabriendo...' -ForegroundColor Yellow
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    Start-Process powershell -ArgumentList $args -Verb RunAs
    exit
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '   Instalador del servidor de impresion - Orderix' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan

# ------------------------------------------------------------
# 1. Copiar la carpeta a la ubicación fija, si hace falta
# ------------------------------------------------------------
Titulo 'Ubicando los archivos'
$CarpetaOrigen = $PSScriptRoot

if ($CarpetaOrigen -ieq $CarpetaDestino) {
    Ok "Ya está corriendo desde $CarpetaDestino"
} else {
    Info "Copiando de `"$CarpetaOrigen`" a `"$CarpetaDestino`"..."
    New-Item -ItemType Directory -Force -Path $CarpetaDestino | Out-Null
    # robocopy en vez de Copy-Item: no falla si algún archivo está en uso,
    # y de paso evita arrastrar node_modules viejo (se reinstala limpio).
    robocopy $CarpetaOrigen $CarpetaDestino /E /XD node_modules tickets /XF .env /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    Ok "Archivos copiados a $CarpetaDestino"
}

Set-Location $CarpetaDestino

# ------------------------------------------------------------
# 2. Node.js
# ------------------------------------------------------------
Titulo 'Node.js'

function Actualizar-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

$tieneNode = Get-Command node -ErrorAction SilentlyContinue
if ($tieneNode) {
    Ok "Ya está instalado ($(node --version))"
} else {
    Info 'No está instalado. Instalando la versión LTS...'
    $wingetOk = Get-Command winget -ErrorAction SilentlyContinue
    $instalado = $false

    if ($wingetOk) {
        try {
            winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
            $instalado = $true
        } catch {
            Advertencia 'winget falló, se intenta descargando el instalador directo.'
        }
    }

    if (-not $instalado) {
        Info 'Descargando el instalador de nodejs.org...'
        $indice = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'
        $ultimaLts = $indice | Where-Object { $_.lts -ne $false } | Select-Object -First 1
        $version = $ultimaLts.version
        $urlMsi = "https://nodejs.org/dist/$version/node-$version-x64.msi"
        $msiTmp = Join-Path $env:TEMP 'node-lts.msi'
        Invoke-WebRequest -Uri $urlMsi -OutFile $msiTmp
        Info "Instalando Node $version..."
        Start-Process msiexec.exe -ArgumentList "/i `"$msiTmp`" /qn /norestart" -Wait
        Remove-Item $msiTmp -ErrorAction SilentlyContinue
    }

    Actualizar-Path
    $tieneNode = Get-Command node -ErrorAction SilentlyContinue
    if (-not $tieneNode) {
        Falla 'No se pudo instalar Node.js. Instalalo a mano desde https://nodejs.org y volvé a correr este script.'
        Read-Host 'Presioná Enter para salir'
        exit 1
    }
    Ok "Instalado ($(node --version))"
}

# ------------------------------------------------------------
# 3. Dependencias
# ------------------------------------------------------------
Titulo 'Instalando dependencias'
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) {
    Falla 'npm install falló. Revisá el mensaje de arriba.'
    Read-Host 'Presioná Enter para salir'
    exit 1
}
Ok 'Dependencias instaladas'

# ------------------------------------------------------------
# 4. Configuración de la impresora (.env)
# ------------------------------------------------------------
Titulo 'Configuración de la impresora'
$archivoEnv = Join-Path $CarpetaDestino '.env'
$yaConfigurado = Test-Path $archivoEnv

if ($yaConfigurado) {
    Ok 'Ya existe un .env, se deja como está.'
    Info "(para reconfigurar la impresora, editar $archivoEnv a mano)"
} else {
    Copy-Item (Join-Path $CarpetaDestino '.env.example') $archivoEnv

    Write-Host ''
    Write-Host '  ¿Cómo está conectada la impresora?'
    Write-Host '    1) De red (cable o WiFi, con IP) - la más confiable'
    Write-Host '    2) USB, instalada con su driver en Windows'
    Write-Host '    3) Todavía no la tengo - dejar en modo simulación'
    $opcion = Read-Host '  Elegí 1, 2 o 3'

    switch ($opcion) {
        '1' {
            $ip = Read-Host '  IP de la impresora (ej: 192.168.0.100)'
            $puerto = Read-Host '  Puerto (Enter para dejar el estándar 9100)'
            if ([string]::IsNullOrWhiteSpace($puerto)) { $puerto = '9100' }
            (Get-Content $archivoEnv) `
                -replace '^PRINTER_TYPE=.*', 'PRINTER_TYPE=red' `
                -replace '^PRINTER_HOST=.*', "PRINTER_HOST=$ip" `
                -replace '^PRINTER_PORT=.*', "PRINTER_PORT=$puerto" |
                Set-Content $archivoEnv
            Ok "Configurada como impresora de red ($ip`:$puerto)"
        }
        '2' {
            $nombre = Read-Host '  Nombre EXACTO en Configuración > Impresoras y escáneres'
            (Get-Content $archivoEnv) `
                -replace '^PRINTER_TYPE=.*', 'PRINTER_TYPE=windows' `
                -replace '^PRINTER_NAME=.*', "PRINTER_NAME=$nombre" |
                Set-Content $archivoEnv
            Info 'Instalando el paquete nativo para imprimir por USB...'
            try {
                npm install printer --no-fund --no-audit
                Ok "Configurada como impresora USB ($nombre)"
            } catch {
                Advertencia 'El paquete nativo "printer" no compiló (pasa seguido en Windows).'
                Advertencia 'Si falla al imprimir, lo más simple es usar una impresora de red (opción 1).'
            }
        }
        default {
            Info 'Queda en modo simulación: guarda los tickets como texto en tickets/ en vez de imprimir.'
            Info "Para configurar la impresora real más adelante, editar $archivoEnv"
        }
    }
}

# ------------------------------------------------------------
# 5. Arranque automático con Windows
# ------------------------------------------------------------
Titulo 'Dejándolo arrancando solo con Windows'
try {
    node servicio-instalar.js
    Ok 'Instalado como servicio de Windows (arranca solo, incluso sin iniciar sesión).'
} catch {
    Advertencia 'No se pudo instalar como servicio. Usando la alternativa de la carpeta de Inicio...'
    powershell -ExecutionPolicy Bypass -File (Join-Path $CarpetaDestino 'instalar-inicio-simple.ps1')
}

# ------------------------------------------------------------
# 6. Verificación final
# ------------------------------------------------------------
Titulo 'Verificando'
Start-Sleep -Seconds 3
try {
    $resp = Invoke-RestMethod -Uri 'http://localhost:3001/status' -TimeoutSec 5
    Ok "El servidor está corriendo. Estado: $($resp.status)"
} catch {
    Advertencia 'Todavía no responde en http://localhost:3001/status.'
    Advertencia 'Puede tardar unos segundos más en levantar, o hace falta reiniciar la PC.'
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '  LISTO' -ForegroundColor Green
Write-Host "  Carpeta: $CarpetaDestino"
Write-Host '  Estado:  http://localhost:3001/status'
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Presioná Enter para cerrar'
