' Arranca el servidor de impresión sin mostrar la ventana negra.
'
' Alternativa al servicio de Windows, para cuando no se tienen permisos de
' administrador. Es más simple, pero si el proceso se cae no se levanta solo
' y sólo arranca cuando el usuario inicia sesión.
'
' Se usa junto con instalar-inicio-simple.ps1

Dim shell, carpeta
Set shell = CreateObject("WScript.Shell")
carpeta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

shell.CurrentDirectory = carpeta
' El 0 es lo que oculta la ventana; el False hace que no espere a que termine.
shell.Run "node server.js", 0, False
