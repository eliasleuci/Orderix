import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { inputClass } from './Field';
import type { SuperAdminTenant } from '../../../types/superadmin';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenant: SuperAdminTenant | null;
  onConfirm: (confirmSlug: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Borrado definitivo, reutilizable desde el listado y desde el detalle.
 * El servidor exige que el cliente ya esté suspendido; acá solo replicamos
 * esa regla en el texto para no dejar clickear algo que va a fallar.
 */
const DeleteTenantModal: React.FC<Props> = ({ isOpen, onClose, tenant, onConfirm, isLoading }) => {
  const [confirmSlug, setConfirmSlug] = useState('');

  useEffect(() => {
    if (isOpen) setConfirmSlug('');
  }, [isOpen]);

  if (!tenant) return null;

  const suspendido = tenant.isActive === false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Borrar "${tenant.name}"`} maxWidth="sm">
      <div className="space-y-4">
        <p className="text-sm text-white/60">
          Se elimina el cliente, sus sucursales, usuarios, productos, stock y ventas.
          <strong className="text-rose-400"> No se puede deshacer.</strong>
        </p>

        {!suspendido ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/50">
            Primero tenés que suspenderlo. Es un paso deliberado para evitar borrados por error.
          </div>
        ) : (
          <>
            <p className="text-sm text-white/60">
              Escribí <strong className="text-white font-mono">{tenant.slug}</strong> para confirmar:
            </p>
            <input
              className={inputClass}
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={tenant.slug}
              autoFocus
            />
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            leftIcon={<Trash2 size={16} />}
            disabled={!suspendido || confirmSlug !== tenant.slug}
            isLoading={isLoading}
            onClick={() => onConfirm(confirmSlug)}
          >
            Borrar definitivamente
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteTenantModal;
