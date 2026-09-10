import React, { useEffect, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Field, { inputClass } from './Field';
import type { SuperAdminBranch, SuperAdminUser, AssignableRole } from '../../../types/superadmin';
import { ROLE_LABELS } from '../../../types/superadmin';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  branches: SuperAdminBranch[];
  user?: SuperAdminUser | null;
  isLoading?: boolean;
}

const ROLES: AssignableRole[] = ['ADMIN', 'CASHIER', 'KITCHEN'];

const DESCRIPCION_ROL: Record<AssignableRole, string> = {
  ADMIN: 'Ve todo su negocio: panel, catálogo, stock, financiero y mesas',
  CASHIER: 'Sólo el punto de venta',
  KITCHEN: 'Sólo la pantalla de comandas',
};

const UserFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, branches, user, isLoading }) => {
  const editando = Boolean(user);
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'CASHIER' as AssignableRole,
    branchId: '',
    name: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      setForm({
        email: user.email ?? '',
        password: '',
        role: (user.role as AssignableRole) ?? 'CASHIER',
        branchId: user.branchId ?? '',
        name: user.name ?? '',
      });
    } else {
      const activa = branches.find((b) => b.isActive !== false);
      setForm({
        email: '',
        password: '',
        role: 'CASHIER',
        branchId: activa?.id ?? branches[0]?.id ?? '',
        name: '',
      });
    }
  }, [isOpen, user, branches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editando) {
      await onSubmit({ role: form.role, branchId: form.branchId || null, name: form.name });
    } else {
      await onSubmit({
        email: form.email,
        password: form.password,
        role: form.role,
        branchId: form.branchId || null,
        name: form.name,
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editando ? `Editar ${user?.email ?? 'usuario'}` : 'Nuevo usuario'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!editando && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Email" hint="Con este email inicia sesión">
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="cajero@negocio.com"
                required
                autoFocus
              />
            </Field>
            <Field label="Contraseña" hint="Mínimo 8 caracteres">
              <input
                type="text"
                className={inputClass}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                minLength={8}
                required
              />
            </Field>
          </div>
        )}

        <Field label="Nombre">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Opcional"
          />
        </Field>

        <Field label="Rol" hint={DESCRIPCION_ROL[form.role]}>
          <select
            className={inputClass}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AssignableRole }))}
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="bg-[#121214]">
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sucursal" hint="Sin sucursal asignada el usuario no puede operar">
          <select
            className={inputClass}
            value={form.branchId}
            onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#121214]">
                {b.name}
                {b.isActive === false ? ' (inactiva)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {editando ? 'Guardar' : 'Crear usuario'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default UserFormModal;
