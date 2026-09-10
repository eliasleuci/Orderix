import React from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import Button from '../../../components/ui/Button';

interface Props {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage: string;
  onRetry: () => void;
  colSpan: number;
}

/**
 * Fila de estado para las tablas del panel.
 *
 * Existe para no repetir el error que tenía la tabla de clientes: mostrar
 * "no hay registros" cuando en realidad la consulta había fallado.
 */
const DataState: React.FC<Props> = ({ loading, error, empty, emptyMessage, onRetry, colSpan }) => {
  if (loading) {
    return (
      <tr>
        <td colSpan={colSpan} className="p-12 text-center">
          <Loader2 className="animate-spin text-indigo-500 mx-auto" size={28} />
        </td>
      </tr>
    );
  }

  if (error) {
    return (
      <tr>
        <td colSpan={colSpan} className="p-10 text-center">
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="text-red-400" size={28} />
            <p className="font-black text-red-400 uppercase tracking-wider text-xs">
              No se pudo cargar
            </p>
            <p className="text-white/50 text-sm max-w-md">{error}</p>
            <Button variant="secondary" onClick={onRetry} leftIcon={<RefreshCw size={16} />}>
              Reintentar
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  if (empty) {
    return (
      <tr>
        <td colSpan={colSpan} className="p-12 text-center text-white/40 font-medium">
          {emptyMessage}
        </td>
      </tr>
    );
  }

  return null;
};

export default DataState;
