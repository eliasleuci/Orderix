import React, { useState, useEffect, useMemo } from 'react';
import { Clock, CheckCircle, Zap, ChefHat, PackageCheck, Timer, Utensils, Truck, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { Order } from '../../../types/domain';
import { ANIMATIONS } from '../../../lib/motion';

// --- CUSTOM HOOK FOR INDEPENDENT TIMER ---
const useOrderTimer = (createdAt: string) => {
  const [elapsed, setElapsed] = useState({ min: 0, sec: 0, totalSec: 0 });

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    
    const update = () => {
      const diff = Math.max(0, Date.now() - start);
      const totalSec = Math.floor(diff / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      setElapsed({ min, sec, totalSec });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return elapsed;
};

// --- FORMAT TIME HELPER ---
const formatTime = (isoString: string): string => {
  return new Date(isoString).toLocaleTimeString('es-AR', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

// --- DURATION BETWEEN TWO TIMES ---
const getDuration = (from: string, to: string): string => {
  const diff = Math.max(0, new Date(to).getTime() - new Date(from).getTime());
  const totalSec = Math.floor(diff / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
};

// --- TIMELINE COMPONENT ---
interface TimelineProps {
  createdAt: string;
  startedAt?: string | null;
  readyAt?: string | null;
  status: string;
  currentMin: number;
  currentSec: number;
}

/**
 * Una sola línea en vez de la línea de tiempo con círculos que había antes.
 * Los tres nodos con sus timestamps y duraciones ocupaban casi 100px -un
 * quinto de la tarjeta- para contar algo que el cocinero no usa mientras
 * cocina: lo que necesita saber es cuánto hace que espera, y eso ya está
 * grande arriba. Los horarios siguen estando, sólo que no gritan.
 */
const OrderTimeline: React.FC<TimelineProps> = ({ createdAt, startedAt, readyAt }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-text-muted tabular-nums">
    <Timer size={10} className="shrink-0" />
    <span>Entró {formatTime(createdAt)}</span>
    {startedAt && (
      <>
        <span className="opacity-40">·</span>
        <span>Empezó {formatTime(startedAt)} ({getDuration(createdAt, startedAt)})</span>
      </>
    )}
    {readyAt && (
      <>
        <span className="opacity-40">·</span>
        <span className="text-success">Listo ({getDuration(startedAt || createdAt, readyAt)})</span>
      </>
    )}
  </div>
);

// --- PARSE MODIFIERS SAFELY ---
const parseModifier = (mod: any): { label: string; price: number } => {
  if (typeof mod === 'string') {
    return { label: mod, price: 0 };
  }
  if (mod && typeof mod === 'object') {
    return { label: mod.label || mod.name || String(mod), price: Number(mod.price || 0) };
  }
  return { label: String(mod), price: 0 };
};

interface OrderCardProps {
  order: Order;
  onStatusChange: (orderId: string, currentStatus: string) => void;
}

const OrderCard: React.FC<OrderCardProps> = React.memo(({ order, onStatusChange }) => {
  const { min, sec, totalSec } = useOrderTimer(order.created_at);
  
  // Semaphore Logic
  const isNew = totalSec < 60; // < 1 min
  const isWarning = min >= 5 && min < 10;
  const isUrgent = min >= 10;

  const statusStyles = useMemo(() => {
    if (isUrgent) return {
      border: 'border-danger/50 shadow-danger/20',
      timeText: 'text-danger animate-pulse',
      bgPulse: 'bg-danger/5'
    };
    if (isWarning) return {
      border: 'border-warning/50 shadow-warning/10',
      timeText: 'text-warning',
      bgPulse: 'bg-transparent'
    };
    return {
      border: 'border-white/5',
      timeText: order.status === 'PREPARING' ? 'text-primary' : 'text-text-muted',
      bgPulse: 'bg-transparent'
    };
  }, [isUrgent, isWarning, order.status]);

  return (
    <motion.div
      layout
      {...ANIMATIONS.fadeInUp}
      exit={{ opacity: 0, scale: 0.9 }}
      className="h-full"
    >
      <Card
        variant="solid"
        padding="none"
        className={cn(
          "h-full flex flex-col transition-all duration-500 overflow-hidden",
          statusStyles.border,
          statusStyles.bgPulse
        )}
      >
        {/* CABECERA. Todo lo de logística en dos renglones: antes iban el
            número, el tipo, el estado y el cliente cada uno en su propia fila
            apilada, y sólo la cabecera se comía 130px. */}
        <div className="p-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl font-black text-text-primary tracking-tighter uppercase leading-none shrink-0">
                #{(order.id || '').substring(0, 4).toUpperCase()}
              </span>
              {isNew && <Badge variant="warning" size="sm" className="animate-bounce shrink-0">NUEVO</Badge>}
            </div>

            <div className={cn(
              "flex items-center gap-1.5 font-black text-xl tracking-tighter tabular-nums shrink-0",
              statusStyles.timeText
            )}>
              <Clock size={18} />
              <span>{min}m {sec.toString().padStart(2, '0')}s</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {order.order_type === 'MESA' && (
              <span className="bg-success/20 text-success border border-success/30 px-2 py-0.5 rounded-full flex items-center gap-1 text-[9px] font-black uppercase tracking-widest leading-none">
                <Utensils size={11} />
                {order.tables?.label || `Mesa ${order.tables?.number || '?'}`}
              </span>
            )}
            {order.order_type === 'DELIVERY' && (
              <span className="bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full flex items-center gap-1 text-[9px] font-black uppercase tracking-widest leading-none">
                <Truck size={11} /> Delivery
              </span>
            )}
            {order.order_type === 'TAKEAWAY' && (
              <span className="bg-white/10 text-text-muted border border-white/20 px-2 py-0.5 rounded-full flex items-center gap-1 text-[9px] font-black uppercase tracking-widest leading-none">
                <User size={11} /> Mostrador
              </span>
            )}

            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.2em] leading-none",
              order.status === 'PREPARING' ? "text-primary" : "text-text-muted"
            )}>
              {order.status === 'PREPARING' ? 'EN FUEGO' : 'PENDIENTE'}
            </span>

            {order.customer_name && (
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-text-primary leading-none min-w-0">
                <User size={11} className="text-primary shrink-0" />
                <span className="truncate">
                  {order.customer_name}
                  {order.order_type === 'DELIVERY' && order.customer_address ? ` · ${order.customer_address}` : ''}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* BODY: ITEMS LIST */}
        <div className="p-3 flex-1 space-y-2.5 overflow-y-auto">
          {order.order_items?.map((item: any, idx: number) => {
            const parsedModifiers = (item.modifiers || []).map(parseModifier);
            const hasModifs = parsedModifiers.length > 0 || item.notes;
            
            return (
              <div key={item.id || idx} className="flex items-start gap-3">
                <div className="w-9 h-9 bg-surface-base rounded-lg flex items-center justify-center border border-white/5 font-black text-lg text-primary shrink-0 shadow-inner">
                  {item.quantity}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="font-black text-lg text-text-primary leading-tight uppercase tracking-tight">
                    {item.products?.name}
                  </p>
                  
                  {/* HIGHLIGHTED MODIFICATIONS FOR KITCHEN */}
                  {hasModifs ? (
                    <div className="mt-1.5 flex flex-col gap-1">
                      {parsedModifiers.map((mod: { label: string; price: number }, mIdx: number) => {
                        const isAdd = mod.label.startsWith('+');
                        return (
                          <span 
                            key={mIdx} 
                            className={`text-[11px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${
                              isAdd 
                                ? 'bg-primary/20 border-primary/50 text-primary' 
                                : 'bg-danger/20 border-danger/50 text-danger'
                            }`}
                          >
                            {mod.label}
                          </span>
                        );
                      })}
                      {item.notes && (
                        <span className="text-sm font-black text-warning uppercase tracking-widest px-2 py-1 flex items-center gap-1 rounded-md bg-warning/10 border border-warning/30">
                          <Zap size={14} className="fill-warning" /> OBS: {item.notes}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* TIMELINE */}
        <div className="border-t border-white/5 bg-white/[0.015]">
          <OrderTimeline
            createdAt={order.created_at}
            startedAt={order.started_at}
            readyAt={order.ready_at}
            status={order.status}
            currentMin={min}
            currentSec={sec}
          />
        </div>

        {/* FOOTER: ACTION BUTTON */}
        <div className="p-3 bg-white/[0.03] border-t border-white/5">
          <Button
            size="lg"
            fullWidth
            variant={order.status === 'PENDING' ? 'primary' : 'success'}
            className="h-12 text-base font-black shadow-lg"
            onClick={() => onStatusChange(order.id, order.status)}
            leftIcon={order.status === 'PREPARING' ? <CheckCircle size={20} /> : <ChefHat size={20} />}
          >
            {order.status === 'PENDING' ? 'EMPEZAR' : 'LISTO'}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
});

OrderCard.displayName = 'OrderCard';

export default OrderCard;
