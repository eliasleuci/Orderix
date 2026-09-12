import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Download, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { menuService, EnlaceCarta } from '../../../services/menuService';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const QRCartaModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { branchId } = useAuthStore();
  const [enlace, setEnlace] = useState<EnlaceCarta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    menuService.getEnlace().then(({ data, error }) => {
      setEnlace(data);
      setError(error);
    });
  }, [isOpen]);

  // La sucursal sólo viaja en la URL si el local tiene más de una: con una sola
  // el link queda limpio y el servidor la resuelve igual.
  const url = useMemo(() => {
    if (!enlace) return '';
    const base = `${window.location.origin}/carta/${enlace.slug}`;
    return enlace.sucursales.length > 1 && branchId ? `${base}?sucursal=${branchId}` : base;
  }, [enlace, branchId]);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setError('No se pudo generar el código QR'));
  }, [url]);

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const descargar = () => {
    if (!qr || !enlace) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `carta-${enlace.slug}.png`;
    a.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Carta para clientes" maxWidth="sm">
      {error ? (
        <p className="text-danger text-sm font-bold text-center py-8">{error}</p>
      ) : !qr ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-text-secondary text-sm text-center">
            Pegá este código en las mesas o en la vidriera. Quien lo escanee ve tu carta
            actualizada, sin instalar nada ni crear una cuenta.
          </p>

          <div className="bg-white rounded-3xl p-5 mx-auto w-fit">
            <img src={qr} alt="Código QR de la carta" className="w-56 h-56 block" />
          </div>

          <div className="flex items-center gap-2 bg-surface-base border border-white/5 rounded-2xl px-4 py-3">
            <span className="flex-1 text-xs text-text-secondary font-mono truncate">{url}</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-text-muted hover:text-primary transition-colors"
              title="Abrir carta"
            >
              <ExternalLink size={16} />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={copiar}
              leftIcon={copiado ? <Check size={18} /> : <Copy size={18} />}
            >
              {copiado ? 'Copiado' : 'Copiar link'}
            </Button>
            <Button variant="primary" fullWidth onClick={descargar} leftIcon={<Download size={18} />}>
              Descargar QR
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default QRCartaModal;
