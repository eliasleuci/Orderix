# Scripts de administración — Orderix

Scripts SQL para operar la plataforma desde el **SQL Editor de Supabase**
(Dashboard → SQL Editor). No forman parte del build ni se ejecutan solos.

## Contexto

Orderix es multi-tenant: cada negocio es una fila en `tenants`, y todas las
demás tablas filtran por `tenant_id`. El acceso se define en `profiles.role`:

| Rol | Qué ve |
|---|---|
| `SUPER_ADMIN` | El panel de plataforma en `/superadmin/tenants` — todos los clientes |
| `ADMIN` | Su restaurante completo: Panel, Catálogo, Stock, Financiero, Mesas |
| `CASHIER` | POS |
| `KITCHEN` | Solo comandas |

El rol es lo único que decide el árbol de rutas (ver `client/src/App.tsx`).
No hay una app aparte para el panel de plataforma: es la misma app.

## Cuál usar

| Script | Cuándo |
|---|---|
| `crear_admin.sql` | Alta de un **cliente nuevo**: crea tenant, sucursal y su ADMIN. Deja la función `crear_usuario_admin()` instalada para reusar. |
| `panel_superadmin.sql` | Crear tu usuario `SUPER_ADMIN` y consultar clientes, facturación y usuarios por SQL. |
| `recuperar_acceso.sql` | **Perdiste el acceso** a un restaurante. Crea un ADMIN sobre el tenant que ya tiene los datos, sin generar uno vacío. |
| `fix_login_error.sql` | El login falla con *"Database error querying schema"*. |
| `limpiar_usuarios.sql` | Diagnóstico de cuentas/perfiles inconsistentes y borrado de usuarios de prueba. |
| `NOTAS-alta-cliente.txt` | Notas manuales previas sobre el alta de clientes. |

## Cosas que aprendimos por las malas

**Crear usuarios por SQL requiere tres piezas, no una.** Una fila en
`auth.users` no alcanza: hace falta también la fila en `auth.identities`
(sin ella `signInWithPassword` falla) y el `profiles` con su rol.

**Las columnas de token no pueden quedar en `NULL`.** GoTrue lee
`confirmation_token`, `recovery_token`, `email_change` y
`email_change_token_new` como texto y no tolera `NULL`: el login devuelve
*"Database error querying schema"*, un mensaje que no sugiere para nada la
causa real. Los scripts de alta ya las insertan como `''`.

**Nunca apuntar un admin a un tenant nuevo para "recuperar" acceso.**
Entra a un sistema vacío, porque todo filtra por `tenant_id`. Hay que
colgarlo del tenant que ya tiene los productos y las órdenes.

**El `SUPER_ADMIN` vive en el tenant `orderix-interno`.** No es un cliente:
existe solo porque `profiles.tenant_id` es `NOT NULL` y no conviene colgar la
cuenta de plataforma del tenant de un cliente real.

## Seguridad

- Las contraseñas de estos scripts son **provisorias**: cambialas después del
  primer ingreso.
- `datos.txt` está en `.gitignore`. Las credenciales no van al repo.
- La función `crear_usuario_admin()` es `SECURITY DEFINER` y tiene el
  `EXECUTE` revocado a `anon` y `authenticated`. Sin ese `REVOKE`, cualquier
  visitante de la app podría crearse un admin.
