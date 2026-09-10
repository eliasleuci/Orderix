import React, { useEffect, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Field, { inputClass, slugify } from './Field';
import type { SuperAdminTenant, CreateTenantPayload } from '../../../types/superadmin';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  /** Si viene, el modal edita; si no, da de alta. */
  tenant?: SuperAdminTenant | null;
  isLoading?: boolean;
}

const vacio: CreateTenantPayload = {
  name: '',
  slug: '',
  email: '',
  phone: '',
  branchName: 'Casa Central',
  branchLocation: '',
  adminEmail: '',
  adminPassword: '',
};

const TenantFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, tenant, isLoading }) => {
  const editando = Boolean(tenant);
  const [form, setForm] = useState<CreateTenantPayload>(vacio);
  // El slug se autogenera desde el nombre hasta que el usuario lo toca a mano.
  const [slugManual, setSlugManual] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (tenant) {
      setForm({
        ...vacio,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email ?? '',
        phone: tenant.phone ?? '',
      });
      setSlugManual(true);
    } else {
      setForm(vacio);
      setSlugManual(false);
    }
  }, [isOpen, tenant]);

  const set = (k: keyof CreateTenantPayload, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onNameChange = (v: string) => {
    setForm((f) => ({ ...f, name: v, ...(slugManual ? {} : { slug: slugify(v) }) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editando) {
      await onSubmit({
        name: form.name,
        slug: form.slug,
        email: form.email,
        phone: form.phone,
      });
    } else {
      await onSubmit(form);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editando ? 'Editar cliente' : 'Nuevo cliente'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nombre del negocio">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Prime Burgers"
              required
              autoFocus
            />
          </Field>
          <Field label="Identificador" hint="Sólo minúsculas, números y guiones">
            <input
              className={inputClass}
              value={form.slug}
              onChange={(e) => {
                setSlugManual(true);
                set('slug', slugify(e.target.value));
              }}
              placeholder="prime-burgers"
              required
            />
          </Field>
          <Field label="Email de contacto">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="contacto@negocio.com"
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

        {!editando && (
          <>
            <div className="border-t border-white/10 pt-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">
                Primera sucursal
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Nombre de la sucursal">
                  <input
                    className={inputClass}
                    value={form.branchName}
                    onChange={(e) => set('branchName', e.target.value)}
                    placeholder="Casa Central"
                  />
                </Field>
                <Field label="Dirección">
                  <input
                    className={inputClass}
                    value={form.branchLocation}
                    onChange={(e) => set('branchLocation', e.target.value)}
                    placeholder="Av. Siempre Viva 742"
                  />
                </Field>
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">
                Usuario administrador
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Email" hint="Con este email va a iniciar sesión">
                  <input
                    type="email"
                    className={inputClass}
                    value={form.adminEmail}
                    onChange={(e) => set('adminEmail', e.target.value)}
                    placeholder="admin@negocio.com"
                    required
                  />
                </Field>
                <Field label="Contraseña" hint="Mínimo 8 caracteres">
                  <input
                    type="text"
                    className={inputClass}
                    value={form.adminPassword}
                    onChange={(e) => set('adminPassword', e.target.value)}
                    placeholder="Clave provisoria"
                    minLength={8}
                    required
                  />
                </Field>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {editando ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TenantFormModal;
