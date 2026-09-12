import { MenuRepository } from './repository';
import { AppError } from '../../common/exceptions/AppError';
import { getContext } from '../../common/utils/context';

const menuRepository = new MenuRepository();

export class MenuService {
  /**
   * Carta pública de un local. No hay usuario detrás de esta llamada, así que
   * el tenant se resuelve por slug y se deja en el contexto: a partir de ahí el
   * filtro por tenantId de Prisma actúa igual que en el resto de la app y ningún
   * dato de otro local puede colarse en la respuesta.
   */
  async getPublicMenu(slug: string, branchId?: string) {
    const tenant = await menuRepository.findTenantBySlug(slug);
    if (!tenant) throw new AppError('Carta no encontrada', 404);

    const store = getContext();
    if (store) store.tenantId = tenant.id;

    const branches = await menuRepository.findActiveBranches(tenant.id);
    if (branches.length === 0) throw new AppError('El local no tiene sucursales activas', 404);

    // Una sucursal pedida que no sea de este local no se busca en la base: se
    // ignora y se cae en la primera, para no filtrar si ese id existe o no.
    const branch = branches.find((b) => b.id === branchId) ?? branches[0]!;

    const products = await menuRepository.findMenuProducts(branch.id);

    const categorias = new Map<string, { id: string; nombre: string; productos: unknown[] }>();
    const sinCategoria: unknown[] = [];

    for (const p of products) {
      const producto = {
        id: p.id,
        nombre: p.name,
        precio: Number(p.price),
        imagen: p.image,
      };

      if (!p.category) {
        sinCategoria.push(producto);
        continue;
      }

      const actual = categorias.get(p.category.id);
      if (actual) {
        actual.productos.push(producto);
      } else {
        categorias.set(p.category.id, {
          id: p.category.id,
          nombre: p.category.name,
          productos: [producto],
        });
      }
    }

    if (sinCategoria.length > 0) {
      categorias.set('sin-categoria', { id: 'sin-categoria', nombre: 'Otros', productos: sinCategoria });
    }

    return {
      local: { nombre: tenant.name, slug: tenant.slug },
      sucursalActual: {
        id: branch.id,
        nombre: branch.name,
        direccion: branch.location,
        telefono: branch.phone,
      },
      sucursales: branches.map((b) => ({ id: b.id, nombre: b.name })),
      categorias: [...categorias.values()],
    };
  }

  /** Datos para armar el link y el QR desde el panel. Requiere sesión. */
  async getShareLink(tenantId: string | undefined) {
    if (!tenantId) throw new AppError('El usuario no tiene un local asignado', 400);

    const tenant = await menuRepository.findTenantById(tenantId);
    if (!tenant) throw new AppError('Local no encontrado', 404);

    const sucursales = await menuRepository.findActiveBranches(tenant.id);

    return {
      slug: tenant.slug,
      nombre: tenant.name,
      sucursales: sucursales.map((b) => ({ id: b.id, nombre: b.name })),
    };
  }
}
