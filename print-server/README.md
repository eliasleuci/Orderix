# Servidor de impresión — Orderix

Imprime la comanda de cocina y el ticket del cliente en una impresora térmica,
automáticamente al confirmar un pedido en el POS.

Corre **en la computadora de la caja**, no en el servidor de Orderix: la
impresora está conectada ahí. El navegador le habla por `http://localhost:3001`.

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

## Si algo no imprime

**No sale nada y el POS no avisa.** Revisar que la ventana del servidor siga
abierta. Se cierra al apagar la computadora: hay que volver a levantarlo.

**"No responde. Revisá que esté encendida y en red."** La impresora está apagada,
sin papel, o cambió de IP. Probar `ping 192.168.0.100` con la IP configurada.

**Sale con caracteres raros en vez de acentos.** Cambiar `PC858_EURO` por
`PC850_MULTILINGUAL` o `WPC1252` en `printer.js`, según el modelo.

**Imprime pero no corta el papel.** Hay modelos sin guillotina automática. No se
puede resolver por software.

## Una aclaración sobre seguridad

El sistema se sirve por HTTPS y este servidor por HTTP. Los navegadores tratan
`localhost` como origen seguro, así que la llamada no queda bloqueada. Esto
funciona **sólo si el servidor corre en la misma máquina que el navegador**: si
se lo quiere poner en otra computadora de la red, hay que apuntarlo con
`VITE_PRINT_SERVER_URL` y esa conexión sí la bloquearía el navegador por no ser
segura.
