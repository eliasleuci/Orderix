# Servidor de impresión — Orderix

Imprime la comanda de cocina y el ticket del cliente en una impresora térmica,
automáticamente al confirmar un pedido en el POS.

Corre **en la computadora de la caja**, no en el servidor de Orderix: la
impresora está conectada ahí. El navegador le habla por `http://localhost:3001`.

## Instalar en la computadora del cliente

Esto se hace una sola vez, en la máquina donde va a estar la impresora.

1. **Instalar Node.js.** Bajarlo de [nodejs.org](https://nodejs.org) (la versión
   LTS) e instalarlo con las opciones por defecto.

2. **Copiar la carpeta `print-server`** a esa computadora, por ejemplo a
   `C:\Orderix\print-server`. Se puede llevar en un pendrive: no hace falta
   copiar todo el sistema, sólo esta carpeta.

3. **Instalar las dependencias.** Abrir la carpeta, clic derecho en un espacio
   vacío → *Abrir en Terminal*, y ejecutar:

   ```
   npm install
   ```

4. **Configurar la impresora** (ver la sección más abajo) y dejarlo arrancando
   solo con Windows.

Después de eso, el POS en `https://www.orderix.store` va a encontrar la
impresora sin ninguna configuración extra del lado del sistema.

## Poner en marcha

```bash
cd print-server
npm install
npm start
```

Queda escuchando en `http://localhost:3001`. **Tiene que estar abierto mientras
se usa el POS**: si se cierra, la venta se registra igual pero no sale el ticket.

## Probarlo sin tener la impresora

Viene configurado en modo **simulación**. En vez de imprimir, guarda cada ticket
como archivo de texto en `tickets/` y lo muestra en la consola, con el formato
exacto que va a salir en papel. Sirve para validar todo el circuito antes de
tener el equipo.

```bash
curl -X POST http://localhost:3001/print/test
```

## Configurar la impresora real

Copiar `.env.example` a `.env` y elegir el modo.

### Opción A — Impresora de red (recomendada)

Es la más confiable: no necesita instalar drivers.

```
PRINTER_TYPE=red
PRINTER_HOST=192.168.0.100
PRINTER_PORT=9100
```

La IP se saca del menú de configuración de la impresora, o imprimiendo su hoja
de autotest (suele ser mantener apretado el botón de avance al encenderla). El
puerto 9100 es el estándar de las térmicas; casi nunca hay que cambiarlo.

**Conviene fijarle la IP en el router**, para que no cambie al reiniciarse y deje
de imprimir.

### Opción B — Impresora USB en Windows

Instalar primero el driver del fabricante y confirmar que imprime una página de
prueba desde Windows. Después:

```
PRINTER_TYPE=windows
PRINTER_NAME=EPSON TM-T20III Receipt
```

`PRINTER_NAME` tiene que ser el nombre **exacto** que figura en *Configuración →
Bluetooth y dispositivos → Impresoras y escáneres*.

Este modo necesita además un paquete nativo:

```bash
npm install printer
```

Si ese paquete no compila (pasa seguido en Windows), usar la opción de red.

## Qué se imprime al confirmar un pedido

```
PRINT_ON_ORDER=both      comanda de cocina + ticket del cliente
PRINT_ON_ORDER=kitchen   sólo la comanda de cocina
PRINT_ON_ORDER=customer  sólo el ticket del cliente
PRINT_ON_ORDER=none      nada automático, sólo con los botones del POS
```

Lo decide este servidor, no la aplicación: se cambia acá y tiene efecto al
reiniciarlo, sin tocar ni volver a publicar el sistema.

## Verificar que está todo bien

```bash
curl http://localhost:3001/status
```

- `"status":"ready"` — lista para imprimir
- `"status":"disconnected"` — el campo `detalle` dice por qué

## Que arranque solo con Windows

Sin esto, hay que abrir una ventana y ejecutar `npm start` cada vez que se
prende la computadora. Si nadie se acuerda, la venta se registra igual pero no
sale el ticket.

Hay dos formas. **Probá primero la primera.**

### Opción 1 — Servicio de Windows (recomendada)

Arranca al prender la máquina, antes incluso de que alguien inicie sesión, y
Windows lo vuelve a levantar solo si se cae.

1. Buscar **PowerShell** en el menú de inicio
2. Clic derecho → **Ejecutar como administrador**
3. Ir a la carpeta y ejecutar:

```powershell
cd C:\Orderix\print-server
npm run servicio:instalar
```

Queda listo. Para comprobarlo, abrir `http://localhost:3001/status` en el
navegador: tiene que responder.

Se administra desde Windows como cualquier servicio: tecla `Windows + R`,
escribir `services.msc`, y buscar **Orderix Print Server**. Desde ahí se puede
detener, reiniciar o ver si está corriendo.

Para sacarlo, también como administrador:

```powershell
npm run servicio:desinstalar
```

### Opción 2 — Carpeta de Inicio (sin permisos de administrador)

Si en esa computadora no se puede usar la cuenta de administrador:

```powershell
powershell -ExecutionPolicy Bypass -File instalar-inicio-simple.ps1
```

Deja un acceso directo en la carpeta de Inicio, y el servidor se levanta sin
ventana visible cada vez que el usuario inicia sesión.

Es más simple, pero tiene dos límites: arranca recién al iniciar sesión (no al
prender la máquina), y si el proceso se cae no se vuelve a levantar solo.

Para sacarlo: `Windows + R`, escribir `shell:startup`, y borrar el acceso
directo *"Orderix - Servidor de impresion"*.

### Comprobar que quedó andando

Reiniciar la computadora y, sin abrir nada, entrar a:

```
http://localhost:3001/status
```

Si responde, está funcionando. Si no, revisar en `services.msc` que el servicio
esté iniciado.

## Si algo no imprime

**No sale nada y el POS no avisa.** Entrar a `http://localhost:3001/status`. Si
no responde, el servidor no está corriendo: si lo dejaste como servicio,
revisalo en `services.msc`; si lo levantás a mano, la ventana se cierra al
apagar la computadora y hay que volver a abrirla.

**"No responde. Revisá que esté encendida y en red."** La impresora está apagada,
sin papel, o cambió de IP. Probar `ping 192.168.0.100` con la IP configurada.

**Sale con caracteres raros en vez de acentos.** Cambiar `PC858_EURO` por
`PC850_MULTILINGUAL` o `WPC1252` en `printer.js`, según el modelo.

**Imprime pero no corta el papel.** Hay modelos sin guillotina automática. No se
puede resolver por software.

## Si Chrome pide permiso para acceder a la red local

Cuando el POS (que corre en `https://www.orderix.store`) llama a la impresora
en `localhost`, Chrome lo detecta como un acceso a la red local y en algunas
versiones muestra un cartel pidiendo permiso.

**Hay que aceptarlo**, y conviene marcar que lo recuerde. Si se rechaza por
error, se vuelve a habilitar desde el candado de la barra de direcciones →
*Configuración de sitios*.

Este servidor ya manda la cabecera que Chrome exige para permitir ese acceso
(`Access-Control-Allow-Private-Network`), así que con aceptar el cartel alcanza.

## Una aclaración sobre seguridad

El sistema se sirve por HTTPS y este servidor por HTTP. Los navegadores tratan
`localhost` como origen seguro, así que la llamada no queda bloqueada. Esto
funciona **sólo si el servidor corre en la misma máquina que el navegador**: si
se lo quiere poner en otra computadora de la red, hay que apuntarlo con
`VITE_PRINT_SERVER_URL` y esa conexión sí la bloquearía el navegador por no ser
segura.
