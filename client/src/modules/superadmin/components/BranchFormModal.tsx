import React, { useEffect, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Field, { inputClass } from './Field';
import type { SuperAdminBranch, BranchPayload } from '../../../types/superadmin';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BranchPayload) => Promise<void>;
  branch?: SuperAdminBranch | null;
  isLoading?: boolean;
}

const vacio: BranchPayload = { name: '', location: '', email: '', phone: '' };

/** Cada sucursal lleva su propia información de contacto, aunque el cliente sea el mismo. */
const BranchFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, branch, isLoading }) => {
  const [form, setForm] = useState<BranchPayload>(vacio);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      branch
        ? {
            name: branch.name,
            location: branch.location ?? '',
            email: branch.email ?? '',
            phone: branch.phone ?? '',
          }
        : vacio
    );
  }, [isOpen, branch]);

  const set = (k: keyof BranchPayload, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={branch ? 'Editar sucursal' : 'Nueva sucursal'}
      maxWidth="md"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSubmit(form);
        }}
        className="space-y-4"
      >
        <Field label="Nombre">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Sucursal Centro"
            required
            autoFocus
          />
        </Field>
        <Field label="Dirección">
          <input
            className={inputClass}
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Av. Corrientes 1234"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email de la sucursal">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="centro@negocio.com"
            />
          </Field>
          <Field label="Teléfono">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="11 5555-5555"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {branch ? 'Guardar' : 'Crear sucursal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default BranchFormModal;
