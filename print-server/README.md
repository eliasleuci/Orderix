# Print Server - Prime Burgers

Servidor local para impresión de tickets en impresoras térmicas USB de 80mm.

## Instalación

```bash
cd print-server
npm install
```

## Uso

```bash
npm run print-server
```

## Requisitos

- Node.js 18+
- Impresora térmica USB
- Cable USB conectado

## Endpoints Disponibles

- `GET /status` - Estado de la impresora
- `POST /print/kitchen` - Ticket cocina
- `POST /print/customer` - Ticket cliente
- `POST /print/both` - Ambos tickets
- `POST /print/test` - Test

## Troubleshooting

1. **"No se encontraron impresoras USB"**: Verificá conexión USB y que la impresora esté encendida
2. **"No se pudo conectar"**: Verificá que el servidor esté corriendo en puerto 3001
3. **No imprime**: Verificá papel, drivers y configuración de Windows
