import React, { useState } from 'react';
import { FileDown, Check, Loader2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Toast, { ToastType } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';
import { PERIODOS, obtenerDatos, type Periodo } from './reporte';
import { descargarReportePdf } from './generarPdf';

interface Props {
  /** Texto del botón. Por defecto "Descargar reporte". */
  label?: string;
  className?: string;
}

/** Descarga en PDF de lo vendido, para archivar y controlar. */
const BotonReporte: React.FC<Props> = ({ label = 'Descargar reporte', className }) => {
  const { branchId } = useAuthStore();

  const [abierto, setAbierto] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [generando, setGenerando] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const generar = async () => {
    if (!branchId) return;
    setGenerando(true);
    try {
      const datos = await obtenerDatos(branchId, periodo);
      await descargarReportePdf(datos);
      setToast({
        message:
          datos.cantidadOrdenes > 0
            ? `Reporte descargado: ${datos.cantidadOrdenes} órdenes`
            : 'Reporte descargado, sin ventas en ese período',
        type: 'success',
      });
      setAbierto(false);
    } catch (e: any) {
      setToast({ message: e.message || 'No se pudo generar el reporte', type: 'error' });
    } finally {
      setGenerando(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setAbierto(true)}
        leftIcon={<FileDown size={18} />}
        className={className}
        disabled={!branchId}
      >
        {label}
      </Button>

      <Modal
        isOpen={abierto}
        onClose={() => !generando && setAbierto(false)}
        title="Descargar reporte"
        maxWidth="sm"
      >
        <div className="space-y-5">
          <p className="text-sm text-text-secondary">
            Se genera un PDF con el total vendido, el desglose por forma de pago,
            los productos y el detalle de cada orden.
          </p>

          <div className="space-y-3">
            {PERIODOS.map((p) => {
              const activo = periodo === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodo(p.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    activo
                      ? 'border-primary bg-primary/10'
                      : 'border-border-subtle bg-surface-elevated/50 hover:border-primary/40'
                  }`}
                >
                  <span>
                    <span className="block font-black text-text-primary">{p.label}</span>
                    <span className="block text-xs text-text-muted mt-0.5">{p.detalle}</span>
                  </span>
                  {activo && <Check className="text-primary shrink-0" size={20} />}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={generando}>
              Cancelar
            </Button>
            <Button
              onClick={generar}
              isLoading={generando}
              leftIcon={generando ? <Loader2 size={18} /> : <FileDown size={18} />}
            >
              Descargar PDF
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        message={toast?.message ?? ''}
        type={toast?.type ?? 'success'}
        isVisible={Boolean(toast)}
        onClose={() => setToast(null)}
      />
    </>
  );
};

export default BotonReporte;
