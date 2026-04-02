import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { tableService, Table, TableStatus } from '../../services/tableService';
import { supabase } from '../../lib/supabase';
import {
  UtensilsCrossed, Plus, X, Check, Clock, Users, Edit3, Trash2,
  ChevronDown, Coffee, Star, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { ANIMATIONS } from '../../lib/motion';
import Toast from '../../components/Toast';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

// --- TIMER HOOK ---
const useTableTimer = (openedAt: string | null | undefined) => {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!openedAt) { setElapsed(''); return; }
    const update = () => {
      const start = new Date(openedAt).getTime();
      const diff = Math.max(0, Date.now() - start);
      
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;

      if (h > 0) {
        setElapsed(`${h}h ${m}m`);
      } else if (m >= 10) {
        setElapsed(`${m}m`);
      } else {
        // Mostramos segundos para los primeros 10 minutos para dar feedback visual
        setElapsed(`${m}m ${s}s`);
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [openedAt]);
  return elapsed;
};

// --- TABLE CARD ---
const TableCard: React.FC<{
  table: Table;
  onOccupy: (t: Table) => void;
  onReserve: (t: Table) => void;
  onFree: (t: Table) => void;
  onEdit: (t: Table) => void;
  onDelete: (id: string) => void;
}> = ({ table, onOccupy, onReserve, onFree, onEdit, onDelete }) => {
  const elapsed = useTableTimer(table.opened_at);
  const [showActions, setShowActions] = useState(false);

  const statusConfig = {
    FREE: {
      border: 'border-success/30 hover:border-success/60',
      bg: 'bg-success/5',
      dot: 'bg-success shadow-[0_0_10px_rgba(16,185,129,0.6)]',
      label: 'LIBRE',
      labelColor: 'text-success',
    },
    OCCUPIED: {
      border: 'border-danger/40 hover:border-danger/70',
      bg: 'bg-danger/5',
      dot: 'bg-danger shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse',
      label: 'OCUPADA',
      labelColor: 'text-danger',
    },
    RESERVED: {
      border: 'border-warning/40 hover:border-warning/70',
      bg: 'bg-warning/5',
      dot: 'bg-warning shadow-[0_0_10px_rgba(245,158,11,0.6)]',
      label: 'RESERVADA',
      labelColor: 'text-warning',
    },
  }[table.status];

  return (
    <motion.div layout {...ANIMATIONS.scaleIn} exit={{ opacity: 0, scale: 0.85 }}>
      <Card
        variant="solid"
        padding="none"
        className={cn(
          'relative flex flex-col overflow-hidden transition-all duration-300 cursor-pointer group',
          statusConfig.border, statusConfig.bg
        )}
        onClick={() => setShowActions(v => !v)}
      >
        {/* HEADER */}
        <div className="p-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', statusConfig.dot)} />
              <span className={cn('text-[9px] font-black uppercase tracking-[0.2em]', statusConfig.labelColor)}>
                {statusConfig.label}
              </span>
            </div>
            <h3 className="text-3xl font-black tracking-tighter text-text-primary leading-none">
              {table.label || `Mesa ${table.number}`}
            </h3>
            <div className="flex items-center gap-1 mt-1.5">
              <Users size={10} className="text-text-muted" />
              <span className="text-[10px] font-bold text-text-muted">{table.capacity} personas</span>
            </div>
          </div>

          {/* TIMER (solo cuando está ocupada) */}
          {table.status === 'OCCUPIED' && elapsed && (
            <div className="flex items-center gap-1.5 bg-danger/10 border border-danger/20 px-3 py-1.5 rounded-2xl">
              <Clock size={12} className="text-danger" />
              <span className="text-xs font-black text-danger tabular-nums">{elapsed}</span>
            </div>
          )}
        </div>

        {/* CUSTOMER INFO */}
        {(table.customer_name || table.notes) && (
          <div className="px-5 pb-4 space-y-1">
            {table.customer_name && (
              <p className="text-sm font-black text-text-primary bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                👤 {table.customer_name}
              </p>
            )}
            {table.notes && (
              <p className="text-xs text-text-muted font-medium italic px-1">
                📝 {table.notes}
              </p>
            )}
          </div>
        )}

        {/* ACTION PANEL (slide in on click) */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="px-4 pb-5 pt-2 border-t border-white/5 flex flex-col gap-2"
              onClick={e => e.stopPropagation()}
            >
              {table.status !== 'FREE' && (
                <button
                  onClick={() => { onFree(table); setShowActions(false); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-success/10 hover:bg-success/20 border border-success/20 text-success text-xs font-black uppercase tracking-widest transition-all"
                >
                  <Check size={14} /> Liberar Mesa
                </button>
              )}
              {table.status !== 'OCCUPIED' && (
                <button
                  onClick={() => { onOccupy(table); setShowActions(false); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger text-xs font-black uppercase tracking-widest transition-all"
                >
                  <UtensilsCrossed size={14} /> Marcar Ocupada
                </button>
              )}
              {table.status !== 'RESERVED' && (
                <button
                  onClick={() => { onReserve(table); setShowActions(false); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-warning/10 hover:bg-warning/20 border border-warning/20 text-warning text-xs font-black uppercase tracking-widest transition-all"
                >
                  <Star size={14} /> Reservar
                </button>
              )}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => { onEdit(table); setShowActions(false); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <Edit3 size={12} /> Editar
                </button>
                <button
                  onClick={() => onDelete(table.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-danger/5 hover:bg-danger/10 border border-danger/10 text-danger/60 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* EXPAND HINT */}
        {!showActions && (
          <div className="px-5 pb-3">
            <ChevronDown size={14} className="text-text-muted/30 mx-auto group-hover:text-text-muted/60 transition-colors" />
          </div>
        )}
      </Card>
    </motion.div>
  );
};

// --- MODAL: OCUPAR / RESERVAR / EDITAR ---
interface ActionModalProps {
  isOpen: boolean;
  mode: 'occupy' | 'reserve' | 'edit' | 'create';
  table: Partial<Table> | null;
  onClose: () => void;
  onConfirm: (data: Partial<Table>) => void;
}
const ActionModal: React.FC<ActionModalProps> = ({ isOpen, mode, table, onClose, onConfirm }) => {
  const [form, setForm] = useState<Partial<Table>>({});

  useEffect(() => {
    if (table) setForm({ ...table });
    else setForm({ capacity: 4, status: 'FREE' });
  }, [table, isOpen]);

  if (!isOpen) return null;

  const titles = {
    occupy: 'Marcar como Ocupada',
    reserve: 'Reservar Mesa',
    edit: 'Editar Mesa',
    create: 'Nueva Mesa',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        {...ANIMATIONS.scaleIn}
        className="bg-surface-elevated w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden"
      >
        <header className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-tighter">{titles[mode]}</h2>
          <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-colors">
            <X size={20} />
          </button>
        </header>

        <div className="p-6 space-y-4">
          {(mode === 'edit' || mode === 'create') && (
            <>
              <div>
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Nombre o Número</label>
                <input
                  type="text"
                  placeholder="Ej: Mesa 1, Barra, VIP"
                  value={form.label || ''}
                  onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  className="w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-text-primary font-bold focus:outline-none focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Número (único)</label>
                <input
                  type="number"
                  min="1"
                  value={form.number || ''}
                  onChange={e => setForm(p => ({ ...p, number: Number(e.target.value) }))}
                  className="w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-text-primary font-bold focus:outline-none focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Capacidad (personas)</label>
                <input
                  type="number"
                  min="1"
                  value={form.capacity || 4}
                  onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))}
                  className="w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-text-primary font-bold focus:outline-none focus:border-primary text-sm"
                />
              </div>
            </>
          )}

          {(mode === 'occupy' || mode === 'reserve') && (
            <>
              <div>
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">
                  {mode === 'occupy' ? 'Nombre del cliente (opcional)' : 'Nombre de la reserva *'}
                </label>
                <input
                  type="text"
                  placeholder={mode === 'occupy' ? 'Ej: Juan, Familia García' : 'Ej: García, para las 20hs'}
                  value={form.customer_name || ''}
                  onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                  className="w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-text-primary font-bold focus:outline-none focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Observaciones (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Cumpleaños, alérgico a nueces..."
                  value={form.notes || ''}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-text-primary font-bold focus:outline-none focus:border-primary text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-white/5 flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
          <Button fullWidth onClick={() => onConfirm(form)}>
            {mode === 'create' ? 'Crear Mesa' : mode === 'edit' ? 'Guardar' : 'Confirmar'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

// --- MAIN PAGE ---
const TablesPage: React.FC = () => {
  const { branchId } = useAuthStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | TableStatus>('ALL');

  const [modal, setModal] = useState<{
    open: boolean;
    mode: 'occupy' | 'reserve' | 'edit' | 'create';
    table: Partial<Table> | null;
  }>({ open: false, mode: 'create', table: null });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({
    message: '', type: 'success', visible: false,
  });

  const showToast = (message: string, type: 'success' | 'error') =>
    setToast({ message, type, visible: true });

  const loadTables = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const { data } = await tableService.getBranchTables(branchId);
    setTables(data || []);
    setLoading(false);
  }, [branchId]);

  useEffect(() => { loadTables(); }, [loadTables]);

  // Realtime subscription
  useEffect(() => {
    if (!branchId) return;
    const channel = supabase
      .channel(`tables-${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `branch_id=eq.${branchId}` },
        () => loadTables()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [branchId, loadTables]);

  const handleConfirm = async (data: Partial<Table>) => {
    if (!branchId) return;
    let error: string | null = null;

    if (modal.mode === 'create') {
      const res = await tableService.createTable({ ...data, branch_id: branchId, status: 'FREE' });
      error = res.error;
    } else if (modal.mode === 'edit' && modal.table?.id) {
      const res = await tableService.updateTable(modal.table.id, { label: data.label, capacity: data.capacity, number: data.number });
      error = res.error;
    } else if (modal.mode === 'occupy' && modal.table?.id) {
      const res = await tableService.occupyTable(modal.table.id, data.customer_name || undefined, data.notes || undefined);
      error = res.error;
    } else if (modal.mode === 'reserve' && modal.table?.id) {
      const res = await tableService.reserveTable(modal.table.id, data.customer_name || undefined, data.notes || undefined);
      error = res.error;
    }

    if (error) {
      showToast(`Error: ${error}`, 'error');
    } else {
      showToast(modal.mode === 'create' ? 'Mesa creada ✓' : 'Mesa actualizada ✓', 'success');
      setModal(m => ({ ...m, open: false }));
      loadTables();
    }
  };

  const handleFree = async (table: Table) => {
    const { error } = await tableService.freeTable(table.id);
    if (error) showToast(error, 'error');
    else { showToast('Mesa liberada ✓', 'success'); loadTables(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta mesa?')) return;
    const { error } = await tableService.deleteTable(id);
    if (error) showToast(error, 'error');
    else { showToast('Mesa eliminada', 'success'); loadTables(); }
  };

  const filtered = filter === 'ALL' ? tables : tables.filter(t => t.status === filter);

  const counts = {
    free: tables.filter(t => t.status === 'FREE').length,
    occupied: tables.filter(t => t.status === 'OCCUPIED').length,
    reserved: tables.filter(t => t.status === 'RESERVED').length,
  };

  return (
    <div className="min-h-screen bg-surface-base text-text-primary p-8 relative overflow-hidden font-sans">
      {/* BG */}
      <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />

      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
              <UtensilsCrossed size={24} className="text-primary" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Mesas</h1>
          </div>
          <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.3em] ml-16">
            Gestión del Salón en Tiempo Real
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={loadTables} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-text-muted transition-all border border-white/5" title="Actualizar">
            <RefreshCw size={18} />
          </button>
          <Button leftIcon={<Plus size={18} />} onClick={() => setModal({ open: true, mode: 'create', table: null })}>
            Nueva Mesa
          </Button>
        </div>
      </header>

      {/* STAT PILLS */}
      <div className="flex flex-wrap gap-3 mb-8 relative z-10">
        {[
          { key: 'ALL', label: 'Todas', count: tables.length, color: 'bg-white/5 border-white/10 text-text-primary' },
          { key: 'FREE', label: 'Libres', count: counts.free, color: 'bg-success/10 border-success/20 text-success' },
          { key: 'OCCUPIED', label: 'Ocupadas', count: counts.occupied, color: 'bg-danger/10 border-danger/20 text-danger' },
          { key: 'RESERVED', label: 'Reservadas', count: counts.reserved, color: 'bg-warning/10 border-warning/20 text-warning' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={cn(
              'px-5 py-2.5 rounded-full font-black uppercase tracking-widest text-xs border transition-all flex items-center gap-2',
              filter === f.key ? f.color + ' scale-105' : 'bg-surface-elevated/50 border-white/5 text-text-muted hover:text-text-primary'
            )}
          >
            {f.label}
            <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px]', filter === f.key ? 'bg-white/20' : 'bg-white/10')}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* TABLES GRID */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-40 bg-surface-elevated/30 rounded-[2rem] animate-pulse border border-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div {...ANIMATIONS.fadeIn} className="flex flex-col items-center justify-center h-[50vh] text-text-muted opacity-20 pointer-events-none">
          <UtensilsCrossed size={120} strokeWidth={1} />
          <p className="text-2xl font-black mt-6 tracking-tighter uppercase">Sin mesas configuradas</p>
          <p className="text-sm font-bold mt-2 uppercase tracking-[0.3em]">Creá la primera desde el botón +</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 relative z-10">
          <AnimatePresence mode="popLayout">
            {filtered.map(table => (
              <TableCard
                key={table.id}
                table={table}
                onOccupy={t => setModal({ open: true, mode: 'occupy', table: t })}
                onReserve={t => setModal({ open: true, mode: 'reserve', table: t })}
                onFree={handleFree}
                onEdit={t => setModal({ open: true, mode: 'edit', table: t })}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* SUMMARY FOOTER */}
      {tables.length > 0 && (
        <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-surface-elevated shadow-2xl px-6 py-3 rounded-full border border-white/5 backdrop-blur-md flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{counts.free} Libres</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{counts.occupied} Ocupadas</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{counts.reserved} Reservadas</span>
            </div>
          </div>
        </footer>
      )}

      {/* MODAL */}
      <AnimatePresence>
        {modal.open && (
          <ActionModal
            isOpen={modal.open}
            mode={modal.mode}
            table={modal.table}
            onClose={() => setModal(m => ({ ...m, open: false }))}
            onConfirm={handleConfirm}
          />
        )}
      </AnimatePresence>

      <Toast message={toast.message} type={toast.type} isVisible={toast.visible} onClose={() => setToast(p => ({ ...p, visible: false }))} />
    </div>
  );
};

export default TablesPage;
