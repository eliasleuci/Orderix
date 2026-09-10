import React, { useEffect, useState } from 'react';
import { Lock, KeyRound } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDone?: (mensaje: string) => void;
}

const MIN_LARGO = 8;

/** Cambio de contraseña del propio usuario, desde adentro de la app. */
const ChangePasswordModal: React.FC<Props> = ({ isOpen, onClose, onDone }) => {
  const { user } = useAuthStore();

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActual('');
      setNueva('');
      setRepetir('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (nueva.length < MIN_LARGO) {
      setError(`La contraseña nueva debe tener al menos ${MIN_LARGO} caracteres`);
      return;
    }
    if (nueva !== repetir) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (nueva === actual) {
      setError('La contraseña nueva tiene que ser distinta de la actual');
      return;
    }
    if (!user?.email) {
      setError('No se pudo identificar tu usuario. Volvé a iniciar sesión.');
      return;
    }

    setLoading(true);
    const { error: err } = await authService.changePassword(user.email, actual, nueva);
    setLoading(false);

    if (err) {
      setError(err);
      return;
    }

    onDone?.('Contraseña actualizada');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cambiar mi contraseña" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-text-secondary">
          Vas a seguir con la sesión abierta. La próxima vez que entres, usá la contraseña nueva.
        </p>

        <Input
          label="Contraseña actual"
          type="password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          icon={<Lock size={18} />}
          autoComplete="current-password"
          required
          autoFocus
        />

        <Input
          label="Contraseña nueva"
          type="password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          icon={<KeyRound size={18} />}
          autoComplete="new-password"
          minLength={MIN_LARGO}
          required
        />

        <Input
          label="Repetir la nueva"
          type="password"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          icon={<KeyRound size={18} />}
          autoComplete="new-password"
          errorMessage={error || undefined}
          required
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={loading}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
