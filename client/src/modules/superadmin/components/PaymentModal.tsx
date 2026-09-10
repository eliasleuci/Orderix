import React, { useEffect, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Field, { inputClass } from './Field';
import type { PaymentPayload } from '../../../types/superadmin';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentPayload) => Promise<void>;
  /** Vencimiento actual: los atajos suman a partir de acá, no desde hoy. */
  vencimientoActual?: string | null;
  isLoading?: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

const PaymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  vencimientoActual,
  isLoading,
}) => {
  const [form, setForm] = useState({
    amount: '',
    paidAt: iso(new Date()),
    periodEnd: '',
    method: 'Transferencia',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        amount: '',
        paidAt: iso(new Date()),
        periodEnd: '',
        method: 'Transferencia',
        notes: '',
      });
    }
  }, [isOpen]);

  /**
   * Suma un período al vencimiento vigente, o a hoy si ya venció.
   * Así renovar dos meses seguidos no pierde los días que quedaban.
   */
  const extender = (meses: number) => {
    const hoy = new Date();
    const actual = vencimientoActual ? new Date(vencimientoActual) : hoy;
    const base = actual > hoy ? actual : hoy;
    const nueva = new Date(base);
    nueva.setMonth(nueva.getMonth() + meses);
    setForm((f) => ({ ...f, periodEnd: iso(nueva) }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar pago" maxWidth="md">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSubmit({
            amount: form.amount ? Number(form.amount) : undefined,
            paidAt: form.paidAt,
            periodEnd: form.periodEnd,
            method: form.method,
            notes: form.notes,
          });
        }}
        className="space-y-4"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Monto">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="25000"
              autoFocus
            />
          </Field>
          <Field label="Fecha de pago">
            <input
              type="date"
              className={inputClass}
              value={form.paidAt}
              onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Pagado hasta" hint="Hasta esta fecha el cliente queda al día">
          <input
            type="date"
            className={inputClass}
            value={form.periodEnd}
            onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
            required
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {[
            { label: '+1 mes', m: 1 },
            { label: '+3 meses', m: 3 },
            { label: '+6 meses', m: 6 },
            { label: '+1 año', m: 12 },
          ].map((o) => (
            <button
              key={o.m}
              type="button"
              onClick={() => extender(o.m)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-indigo-500/20 border border-white/10
                         text-xs font-bold text-white/70 hover:text-white transition-colors"
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Método">
            <input
              className={inputClass}
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              placeholder="Transferencia"
            />
          </Field>
          <Field label="Notas">
            <input
              className={inputClass}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Opcional"
            />
          </Field>
        </div>

        <p className="text-xs text-white/40">
          Registrar un pago reactiva al cliente si estaba suspendido por falta de pago.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Registrar pago
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PaymentModal;
