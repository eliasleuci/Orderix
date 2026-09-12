export type Rol = 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER' | 'KITCHEN';

/**
 * Qué pantalla puede abrir cada rol.
 *
 * Única fuente de verdad: la usan el menú de escritorio, la barra del celular
 * y el ruteo. Antes no existía y todo usuario con sesión recibía las 10 rutas,
 * así que un cajero entraba al Financiero escribiendo la dirección.
 *
 * SUPER_ADMIN no figura acá: tiene su propio árbol de rutas en /superadmin.
 */
export const RUTAS_POR_ROL: Record<'ADMIN' | 'CASHIER' | 'KITCHEN', string[]> = {
  ADMIN: ['/pos', '/kitchen', '/tables', '/catalog', '/stock', '/dashboard', '/financial', '/cash', '/delivery', '/pedidos-web'],
  CASHIER: ['/pos', '/tables', '/kitchen', '/cash', '/pedidos-web'],
  KITCHEN: ['/kitchen', '/stock'],
};

/** Dónde cae cada rol al entrar, y a dónde se lo manda si pide algo que no le toca. */
export const INICIO_POR_ROL: Record<'ADMIN' | 'CASHIER' | 'KITCHEN', string> = {
  ADMIN: '/pos',
  CASHIER: '/pos',
  KITCHEN: '/kitchen',
};

const esRolConocido = (rol: string | null | undefined): rol is 'ADMIN' | 'CASHIER' | 'KITCHEN' =>
  rol === 'ADMIN' || rol === 'CASHIER' || rol === 'KITCHEN';

/**
 * Sin rol reconocido no se abre nada.
 *
 * Es a propósito: el rol se lee del perfil al iniciar sesión y queda guardado
 * en el navegador. Si llegara vacío o con un valor raro, negar es más seguro
 * que asumir permisos.
 */
export const rutasPermitidas = (rol: string | null | undefined): string[] =>
  esRolConocido(rol) ? RUTAS_POR_ROL[rol] : [];

export const rutaInicial = (rol: string | null | undefined): string =>
  esRolConocido(rol) ? INICIO_POR_ROL[rol] : '/login';

export const puedeVer = (rol: string | null | undefined, path: string): boolean =>
  rutasPermitidas(rol).includes(path);

/** Alta, edición y baja de productos e ingredientes: sólo el dueño del negocio. */
export const puedeGestionarCatalogo = (rol: string | null | undefined): boolean => rol === 'ADMIN';

/** Ajustar cantidades de stock: también cocina, para registrar mermas y consumos. */
export const puedeAjustarStock = (rol: string | null | undefined): boolean =>
  rol === 'ADMIN' || rol === 'KITCHEN';
