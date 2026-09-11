import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Plus, Pencil, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { ANIMATIONS } from '../../../lib/motion';

import { CartItem, CartModifier } from '../../../store/cartStore';

interface ModifierModalProps {
  isOpen: boolean;
  item: CartItem | null;
  onClose: () => void;
  onSave: (cartItemId: string, modifiers: CartModifier[], notes: string) => void;
}

interface Modifier {
  id: string;
  label: string;
  type: 'add' | 'remove';
  price: number;
}

const DEFAULT_MODIFIERS: Modifier[] = [
  { id: 'm1', label: '+ Extra Carne', type: 'add', price: 1500 },
  { id: 'm2', label: '+ Cheddar', type: 'add', price: 500 },
  { id: 'm3', label: '+ Bacon', type: 'add', price: 800 },
  { id: 'm4', label: '- Sin Cebolla', type: 'remove', price: 0 },
  { id: 'm5', label: '- Sin Tomate', type: 'remove', price: 0 },
  { id: 'm6', label: '- Sin Aderezo', type: 'remove', price: 0 },
];

// Persist custom modifiers across sessions
const STORAGE_KEY = 'pos_modifiers';

function loadModifiers(): Modifier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Modifier[];
      // Ensure price is always a number (guards against old string values)
      return parsed.map(m => ({ ...m, price: Number(m.price) || 0 }));
    }
  } catch {}
  return DEFAULT_MODIFIERS;
}

function saveModifiers(mods: Modifier[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mods));
}

const ModifierModal: React.FC<ModifierModalProps> = ({ isOpen, item, onClose, onSave }) => {
  const [modifiers, setModifiers] = useState<Modifier[]>(loadModifiers);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  // Inline editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  // New modifier form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newType, setNewType] = useState<'add' | 'remove'>('add');
  const newLabelRef = useRef<HTMLInputElement>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen && item) {
      const initial: Record<string, number> = {};
      item.modifiers?.forEach(m => {
        initial[m.label] = (initial[m.label] || 0) + 1;
      });
      setSelectedModifiers(initial);
      setNotes(item.notes || '');
      setEditingId(null);
      setShowNewForm(false);
    }
  }, [isOpen, item]);

  // Focus new label input when form opens
  useEffect(() => {
    if (showNewForm) setTimeout(() => newLabelRef.current?.focus(), 50);
  }, [showNewForm]);

  if (!isOpen || !item) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const persist = (next: Modifier[]) => {
    setModifiers(next);
    saveModifiers(next);
  };

  const updateModifierCount = (label: string, delta: number) => {
    setSelectedModifiers(prev => {
      const next = { ...prev };
      const current = next[label] || 0;
      const final = Math.max(0, current + delta);
      if (final === 0) delete next[label];
      else next[label] = final;
      return next;
    });
  };

  const toggleRemoveModifier = (label: string) => {
    setSelectedModifiers(prev => {
      const next = { ...prev };
      if (next[label]) delete next[label];
      else next[label] = 1;
      return next;
    });
  };

  // ── Price editing ──────────────────────────────────────────────────────────

  const startEdit = (mod: Modifier) => {
    setEditingId(mod.id);
    setEditPrice(String(mod.price));
  };

  const commitEdit = (id: string) => {
    const parsed = parseInt(editPrice, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      persist(modifiers.map(m => m.id === id ? { ...m, price: parsed } : m));
    }
    setEditingId(null);
  };

  // ── Delete modifier ────────────────────────────────────────────────────────

  const deleteModifier = (id: string) => {
    const mod = modifiers.find(m => m.id === id);
    if (mod) {
      setSelectedModifiers(prev => {
        const next = { ...prev };
        delete next[mod.label];
        return next;
      });
    }
    persist(modifiers.filter(m => m.id !== id));
  };

  // ── Add new modifier ───────────────────────────────────────────────────────

  const addModifier = () => {
    const label = newLabel.trim();
    if (!label) return;
    const price = newType === 'add' ? Math.max(0, parseInt(newPrice, 10) || 0) : 0;
    const prefix = newType === 'add' ? '+ ' : '- ';
    const fullLabel = label.startsWith('+') || label.startsWith('-') ? label : prefix + label;
    const newMod: Modifier = {
      id: `custom_${Date.now()}`,
      label: fullLabel,
      type: newType,
      price,
    };
    persist([...modifiers, newMod]);
    setNewLabel('');
    setNewPrice('');
    setNewType('add');
    setShowNewForm(false);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const modsToSave: CartModifier[] = [];
    Object.entries(selectedModifiers).forEach(([label, count]) => {
      const found = modifiers.find(m => m.label === label);
      const price = found ? found.price : 0;
      for (let i = 0; i < count; i++) {
        modsToSave.push({ label, price });
      }
    });
    onSave(item.cartItemId, modsToSave, notes);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const addMods = modifiers.filter(m => m.type === 'add');
  const removeMods = modifiers.filter(m => m.type === 'remove');

  return (
    <AnimatePresence>
      {/* Por encima del panel del carrito (z-70) y de la barra inferior (z-50):
          con z-50 quedaba tapado y el botón parecía no funcionar. */}
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        {/* BACKDROP */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* MODAL WINDOW */}
        <motion.div
          {...ANIMATIONS.scaleIn}
          className="bg-surface-elevated w-full max-w-xl rounded-[2rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* HEADER */}
          <header className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Personalizar</h2>
              <p className="text-text-muted mt-1 font-bold text-sm tracking-widest uppercase">{item.name}</p>
            </div>
            <button
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </header>

          {/* CONTENT */}
          <div className="p-6 overflow-y-auto flex-1 space-y-8">

            {/* EXTRAS (con precio editable) */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-text-muted uppercase tracking-widest">Extras</h3>
                <span className="text-[10px] text-text-muted/50 font-bold uppercase tracking-widest">
                  Toca el precio para editar
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {addMods.map(mod => {
                  const count = selectedModifiers[mod.label] || 0;
                  const isSelected = count > 0;
                  const isEditing = editingId === mod.id;

                  return (
                    <div
                      key={mod.id}
                      className={`
                        relative group h-20 rounded-2xl flex flex-col items-center justify-center text-sm font-black uppercase tracking-tight border transition-all cursor-pointer active:scale-95
                        ${isSelected
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-surface-base border-white/5 text-text-secondary hover:border-white/20'
                        }
                      `}
                      onClick={() => !isEditing && updateModifierCount(mod.label, 1)}
                    >
                      {/* Delete button */}
                      <button
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-danger/0 hover:bg-danger/80 text-danger/0 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10"
                        onClick={(e) => { e.stopPropagation(); deleteModifier(mod.id); }}
                        title="Eliminar"
                      >
                        <Trash2 size={10} />
                      </button>

                      {/* Count Badge */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div 
                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-black rounded-full flex items-center justify-center font-black text-xs shadow-lg z-20 pointer-events-none"
                          >
                            x{count}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Decrement Button */}
                      {isSelected && !isEditing && (
                        <button
                          className="absolute -bottom-2 right-2 w-7 h-7 bg-danger text-white rounded-full flex items-center justify-center shadow-lg z-20 hover:scale-110 active:scale-95 transition-all outline-none"
                          onClick={(e) => { e.stopPropagation(); updateModifierCount(mod.label, -1); }}
                          title="Restar uno"
                        >
                          <span className="h-0.5 w-3 bg-white rounded-full"></span>
                        </button>
                      )}

                      <span className="leading-tight text-center px-2">{mod.label}</span>

                      {/* Price area */}
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1 mt-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="text-[11px] text-primary font-bold">$</span>
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            value={editPrice}
                            onChange={e => setEditPrice(e.target.value)}
                            onBlur={() => commitEdit(mod.id)}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(mod.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="w-16 text-center text-[11px] font-bold bg-black/40 border border-primary/60 rounded-lg px-1 py-0.5 text-primary focus:outline-none focus:border-primary"
                          />
                        </div>
                      ) : (
                        <button
                          className={`flex items-center gap-1 mt-1 rounded-md px-1.5 py-0.5 hover:bg-white/10 transition-colors ${isSelected ? 'text-primary' : 'text-text-muted opacity-70'}`}
                          onClick={e => { e.stopPropagation(); startEdit(mod); }}
                          title="Editar precio"
                        >
                          <span className="text-[11px] font-bold">+${mod.price.toLocaleString('es-AR')}</span>
                          <Pencil size={9} className="opacity-60" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Botón agregar extra */}
                {!showNewForm && (
                  <button
                    onClick={() => { setNewType('add'); setShowNewForm(true); }}
                    className="h-20 rounded-2xl flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-white/10 text-text-muted hover:border-primary/40 hover:text-primary transition-all active:scale-95"
                  >
                    <Plus size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Agregar</span>
                  </button>
                )}
              </div>
            </section>

            {/* REMOCIONES */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-text-muted uppercase tracking-widest">Remociones</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {removeMods.map(mod => {
                  const isSelected = !!selectedModifiers[mod.label];
                  return (
                    <div
                      key={mod.id}
                      className={`
                        relative group h-16 rounded-2xl flex flex-col items-center justify-center text-sm font-black uppercase tracking-tight border transition-all cursor-pointer active:scale-95
                        ${isSelected
                          ? 'bg-danger/20 border-danger text-danger'
                          : 'bg-surface-base border-white/5 text-text-secondary hover:border-white/20'
                        }
                      `}
                      onClick={() => toggleRemoveModifier(mod.label)}
                    >
                      {/* Delete button */}
                      <button
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-danger/0 hover:bg-danger/80 text-danger/0 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10"
                        onClick={(e) => { e.stopPropagation(); deleteModifier(mod.id); }}
                        title="Eliminar"
                      >
                        <Trash2 size={10} />
                      </button>
                      <span>{mod.label}</span>
                    </div>
                  );
                })}

                {/* Botón agregar remoción */}
                {!showNewForm && (
                  <button
                    onClick={() => { setNewType('remove'); setShowNewForm(true); }}
                    className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 border-dashed border-white/10 text-text-muted hover:border-danger/40 hover:text-danger transition-all active:scale-95"
                  >
                    <Plus size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Agregar</span>
                  </button>
                )}
              </div>
            </section>

            {/* FORMULARIO NUEVO MODIFICADOR */}
            <AnimatePresence>
              {showNewForm && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="bg-surface-base border border-white/10 rounded-2xl p-5 space-y-4"
                >
                  <h3 className="text-sm font-black text-text-muted uppercase tracking-widest">
                    Nuevo modificador
                  </h3>

                  {/* Tipo */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewType('add')}
                      className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-all ${newType === 'add' ? 'bg-primary/20 border-primary text-primary' : 'bg-surface-elevated border-white/10 text-text-muted'}`}
                    >
                      + Extra (suma $)
                    </button>
                    <button
                      onClick={() => setNewType('remove')}
                      className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-all ${newType === 'remove' ? 'bg-danger/20 border-danger text-danger' : 'bg-surface-elevated border-white/10 text-text-muted'}`}
                    >
                      − Remoción
                    </button>
                  </div>

                  {/* Nombre */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5 block">
                      Nombre
                    </label>
                    <input
                      ref={newLabelRef}
                      type="text"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      placeholder={newType === 'add' ? 'Ej: Huevo frito' : 'Ej: Sin pepino'}
                      onKeyDown={e => { if (e.key === 'Enter') addModifier(); if (e.key === 'Escape') setShowNewForm(false); }}
                      className="w-full bg-surface-elevated border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Precio (solo si es add) */}
                  {newType === 'add' && (
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5 block">
                        Precio adicional ($)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={newPrice}
                        onChange={e => setNewPrice(e.target.value)}
                        placeholder="Ej: 700"
                        onKeyDown={e => { if (e.key === 'Enter') addModifier(); if (e.key === 'Escape') setShowNewForm(false); }}
                        className="w-full bg-surface-elevated border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowNewForm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-muted hover:bg-white/5 text-xs font-black uppercase tracking-wide transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={addModifier}
                      disabled={!newLabel.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-primary text-black font-black uppercase tracking-wide text-xs hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Agregar
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* NOTAS LIBRES */}
            <section>
              <h3 className="text-sm font-black text-text-muted uppercase tracking-widest mb-4">Notas Especiales (Cocina)</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Pan sin TACC, bien cocida..."
                className="w-full bg-surface-base border border-white/10 rounded-2xl p-4 text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-h-[120px] resize-none"
              />
            </section>
          </div>

          {/* FOOTER */}
          <footer className="p-6 border-t border-white/5 bg-surface-base">
            <Button size="lg" fullWidth leftIcon={<Check size={20} />} onClick={handleSave}>
              Guardar Modificaciones
            </Button>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ModifierModal;
