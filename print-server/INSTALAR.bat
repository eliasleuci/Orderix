@echo off
REM Doble clic en este archivo instala todo: Node.js, la carpeta en su
REM ubicacion final, las dependencias, la impresora y el arranque automatico.
REM Va a pedir permiso de administrador (es normal, hace falta para el
REM servicio de Windows).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-todo.ps1"
