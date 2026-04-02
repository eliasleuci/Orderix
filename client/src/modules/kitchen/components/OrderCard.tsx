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

const OrderTimeline: React.FC<TimelineProps> = ({ createdAt, startedAt, readyAt, status, currentMin, currentSec }) => {
  const steps = [
    {
      key: 'received',
      label: 'Recibido',
      time: formatTime(createdAt),
      done: true,
      active: status === 'PENDING',
      icon: <PackageCheck size={12} />,
      color: 'text-primary border-primary bg-primary/20',
    },
    {
      key: 'started',
      label: 'Empezado',
      time: startedAt ? formatTime(startedAt) : null,
      duration: startedAt ? getDuration(createdAt, startedAt) : null,
      done: !!startedAt,
      active: status === 'PREPARING',
      icon: <ChefHat size={12} />,
      color: startedAt ? 'text-warning border-warning bg-warning/20' : 'text-text-muted border-white/10 bg-white/5',
    },
    {
      key: 'ready',
      label: 'Listo',
      time: readyAt ? formatTime(readyAt) : null,
      duration: readyAt && startedAt ? getDuration(startedAt, readyAt) : readyAt ? getDuration(createdAt, readyAt) : null,
      done: !!readyAt,
      active: status === 'READY',
      icon: <CheckCircle size={12} />,
      color: readyAt ? 'text-success border-success bg-success/20' : 'text-text-muted border-white/10 bg-white/5',
    },
  ];

  return (
    <div className="px-5 pb-4 pt-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Timer size={10} className="text-text-muted" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Línea de Tiempo</span>
      </div>
      <div className="flex items-center gap-0">
        {steps.map((step, idx) => (
          <React.Fragment key={step.key}>
            {/* NODE */}
            <div className="flex flex-col items-center min-w-0 flex-1">
              {/* Circle */}
              <div className={cn(
                "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                step.done || step.active ? step.color : 'text-text-muted border-white/10 bg-white/5'
              )}>
                {step.icon}
              </div>
              {/* Label + time */}
              <div className="text-center mt-2 px-0.5">
                <p className={cn(
                  "text-[9px] font-black uppercase tracking-widest leading-none",
                  step.done || step.active ? (step.active && !step.done ? 'text-text-secondary' : 'text-text-primary') : 'text-text-muted'
                )}>
                  {step.label}
                </p>
                {step.time ? (
                  <p className="text-[9px] font-bold text-text-muted mt-0.5 tabular-nums leading-none">{step.time}</p>
                ) : step.active ? (
                  <p className="text-[9px] font-black text-warning mt-0.5 tabular-nums leading-none animate-pulse">
                    {currentMin}m {currentSec.toString().padStart(2,'0')}s
                  </p>
                ) : (
                  <p className="text-[9px] text-text-muted mt-0.5 leading-none">—</p>
                )}
                {step.duration && (
                  <p className="text-[10px] font-black text-text-muted mt-0.5 leading-none opacity-70">
                    ({step.duration})
                  </p>
                )}
              </div>
            </div>
            
            {/* CONNECTOR */}
            {idx < steps.length - 1 && (
              <div className={cn(
                "h-px flex-1 mb-6 mx-1 transition-all",
                steps[idx + 1].done ? 'bg-white/30' : 'bg-white/10'
              )} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

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
        {/* HEADER: ORDER # & TIMER */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-text-primary tracking-tighter uppercase leading-none">
                #{(order.id || '').substring(0, 4).toUpperCase()}
              </span>
              {isNew && (
                <Badge variant="warning" size="sm" className="animate-bounce">NUEVO</Badge>
              )}
            </div>

            {/* ORDER TYPE LOGISTICS */}
            <div className="flex items-center gap-2 mt-0.5">
              {order.order_type === 'MESA' && (
                <div className="bg-success/20 text-success border border-success/30 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Utensils size={12} className="fill-success/20" />
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                    {order.tables?.label || `Mesa ${order.tables?.number || '?'}`}
                  </span>
                </div>
              )}
              {order.order_type === 'DELIVERY' && (
                <div className="bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Truck size={12} className="fill-primary/20" />
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">Delivery</span>
                </div>
              )}
              {order.order_type === 'TAKEAWAY' && (
                <div className="bg-white/10 text-text-muted border border-white/20 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <User size={12} className="fill-text-muted/20" />
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">Mostrador</span>
                </div>
              )}
            </div>

            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.2em] leading-none mt-1.5",
              order.status === 'PREPARING' ? "text-primary" : "text-text-muted"
            )}>
              {order.status === 'PREPARING' ? 'EN FUEGO' : 'PENDIENTE'}
            </span>
            {order.customer_name && (
              <span className="mt-1.5 text-sm font-black text-white bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/30 w-fit shadow-md block leading-tight">
                👤 {order.customer_name.substring(0, 20)}{order.customer_name.length > 20 ? '...' : ''} {order.order_type === 'DELIVERY' && order.customer_address ? `(${order.customer_address})` : ''}
              </span>
            )}
          </div>

          <div className={cn(
            "flex items-center gap-1.5 font-black text-xl tracking-tighter tabular-nums",
            statusStyles.timeText
          )}>
            <Clock size={20} />
            <span>{min}m {sec.toString().padStart(2, '0')}s</span>
          </div>
        </div>

        {/* BODY: ITEMS LIST */}
        <div className="p-4 flex-1 space-y-4 overflow-y-auto">
          {order.order_items?.map((item: any, idx: number) => {
            const parsedModifiers = (item.modifiers || []).map(parseModifier);
            const hasModifs = parsedModifiers.length > 0 || item.notes;
            
            return (
              <div key={item.id || idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-surface-base rounded-xl flex items-center justify-center border border-white/5 font-black text-xl text-primary shrink-0 shadow-inner">
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
                  ) : (
                    <div className="flex gap-2 mt-1">
                      <Badge variant="neutral" size="sm">REGULAR</Badge>
                    </div>
                  )}
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
        <div className="p-4 bg-white/[0.03] border-t border-white/5">
          <Button
            size="lg"
            fullWidth
            variant={order.status === 'PENDING' ? 'primary' : 'success'}
            className="h-14 text-lg font-black shadow-2xl"
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
