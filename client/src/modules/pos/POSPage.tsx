import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { productService } from '../../services/productService';
import { orderService } from '../../services/orderService';
import { tableService, Table } from '../../services/tableService';
import { printService } from '../../lib/printService';
import { ShoppingCart, Search, LogOut, Utensils, Truck, User, Printer, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ANIMATIONS } from '../../lib/motion';
import Toast from '../../components/Toast';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import CategoryBar from './components/CategoryBar';
import ProductCard from './components/ProductCard';
import CartItem from './components/CartItem';
import ModifierModal from './components/ModifierModal';

const POSPage: React.FC = () => {
  const { items, addItem, updateQuantity, removeItem, updateItemModifiers, clearCart, getTotal } = useCartStore();
  const { branchId, user, signOut } = useAuthStore();
  
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderType, setOrderType] = useState<'MESA' | 'DELIVERY' | 'TAKEAWAY'>('TAKEAWAY');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'DIGITAL'>('CASH');

  // Print State
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [printerReady, setPrinterReady] = useState(false);
  const [printerError, setPrinterError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  // Modal State
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  
  // Search Input Ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  const editingCartItem = useMemo(() => 
    items.find(i => i.cartItemId === editingCartItemId) || null
  , [items, editingCartItemId]);

  // 1. DATA FETCHING
  useEffect(() => {
    if (!branchId) return;

    const fetchData = async () => {
      try {
        const [prodRes, catRes, tableRes] = await Promise.all([
          productService.getBranchProducts(branchId),
          productService.getCategories(),
          tableService.getBranchTables(branchId)
        ]);
        setProducts(prodRes.data || []);
        setCategories(catRes.data || []);
        setTables(tableRes.data || []);
      } catch (err) {
        console.error('Error fetching POS data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId]);

  // Check printer status
  useEffect(() => {
    const checkPrinter = async () => {
      const result = await printService.checkStatus();
      setPrinterReady(result.status === 'ready');
      if (result.error) {
        setPrinterError(result.error);
      }
    };
    checkPrinter();
    const interval = setInterval(checkPrinter, 30000);
    return () => clearInterval(interval);
  }, []);

  // Print handlers
  const handlePrintKitchen = async () => {
    if (!lastOrder) return;
    setPrinting(true);
    const result = await printService.printKitchen(lastOrder);
    setPrinting(false);
    if (result.error) {
      setPrinterError(result.error);
    }
  };

  const handlePrintCustomer = async () => {
    if (!lastOrder) return;
    setPrinting(true);
    const result = await printService.printCustomer(lastOrder);
    setPrinting(false);
    if (result.error) {
      setPrinterError(result.error);
    }
  };

  const handlePrintBoth = async () => {
    if (!lastOrder) return;
    setPrinting(true);
    const result = await printService.printBoth(lastOrder);
    setPrinting(false);
    if (result.error) {
      setPrinterError(result.error);
    }
  };


  // 2. MEMOIZED HANDLERS (CRITICAL FOR PERFORMANCE)
  const handleAddItem = useCallback((product: any) => {
    addItem({ 
      id: product.id, 
      name: product.name, 
      price: Number(product.price) 
    });
  }, [addItem]);

  const handleUpdateQuantity = useCallback((id: string, qty: number) => {
    updateQuantity(id, qty);
  }, [updateQuantity]);

  const handleRemoveItem = useCallback((id: string) => {
    removeItem(id);
  }, [removeItem]);

  const handleEditItem = useCallback((cartItemId: string) => {
    setEditingCartItemId(cartItemId);
    setIsModifierModalOpen(true);
  }, []);

  const handleSaveModifiers = useCallback((cartItemId: string, modifiers: any[], notes: string) => {
    updateItemModifiers(cartItemId, modifiers, notes);
    setIsModifierModalOpen(false);
  }, [updateItemModifiers]);

  const handleCategorySelect = useCallback((id: string | null) => {
    setSelectedCategory(id);
  }, []);

  const handleCheckout = useCallback(async () => {
    if (!branchId || items.length === 0 || checkoutStatus === 'loading') return;

    if (orderType === 'MESA' && !selectedTableId) {
      setErrorMessage('Por favor selecciona una mesa.');
      setCheckoutStatus('error');
      return;
    }

    setCheckoutStatus('loading');
    setErrorMessage('');

    const { data, error } = await orderService.createOrder({
      branchId,
      userId: user?.id,
      customerName: customerName.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      orderType: orderType,
      tableId: orderType === 'MESA' ? selectedTableId : null,
      items: items.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        modifiers: item.modifiers,
        notes: item.notes
      })),
      total: getTotal(),
      paymentMethod: paymentMethod
    });

    if (error) {
      setCheckoutStatus('error');
      setErrorMessage(error);
      return;
    }

    if (data?.status === 'error') {
      setCheckoutStatus('error');
      setErrorMessage(data.message);
      return;
    }

    if (orderType === 'MESA' && selectedTableId) {
      await tableService.occupyTable(selectedTableId, customerName || 'Cliente POS');
    }

    // Save order for printing
    const tableLabel = orderType === 'MESA' ? tables.find(t => t.id === selectedTableId)?.label || `Mesa ${tables.find(t => t.id === selectedTableId)?.number}` : '';
    setLastOrder({
      ticketNumber: data?.ticket_number,
      customerName: customerName.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      orderType,
      table: tableLabel,
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        modifiers: item.modifiers,
        notes: item.notes
      })),
      paymentMethod,
      total: getTotal(),
      time: new Date().toISOString()
    });

    setCheckoutStatus('success');
    clearCart();
    setSearchTerm('');
    setCustomerName('');
    setCustomerAddress('');
    setOrderType('TAKEAWAY');
    setSelectedTableId('');
    
    setTimeout(() => {
      setCheckoutStatus('idle');
      searchInputRef.current?.focus();
    }, 2000);
  }, [branchId, user?.id, items, customerName, customerAddress, orderType, selectedTableId, paymentMethod, getTotal, clearCart, checkoutStatus, tables]);

  // 3. FILTERING LOGIC
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-base">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <ShoppingCart className="w-12 h-12 text-primary opacity-20" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-base text-text-primary overflow-hidden relative font-sans">
      {/* 1. PRODUCT ZONE (LEFT) */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden z-10">
        {/* HEADER & NAV */}
        <header className="mb-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Ventas</h1>
            </div>
            <Button variant="ghost" size="md" leftIcon={<LogOut size={18} />} onClick={signOut}>
              Cerrar Sesión
            </Button>
          </div>

          <div className="flex gap-6 items-center">
            <div className="flex-1">
              <Input
                ref={searchInputRef}
                placeholder="Buscar hamburguesa, bebida, promo..."
                icon={<Search size={22} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-16 text-lg"
              />
            </div>
          </div>

          <CategoryBar 
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategorySelect}
          />
        </header>

        {/* PRODUCT GRID */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pr-2 scroll-smooth pb-12 items-start">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((p) => (
              <ProductCard 
                key={p.id} 
                product={p} 
                onAdd={handleAddItem}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* 2. PERSISTENT CART (RIGHT) */}
      <aside className="w-[380px] bg-surface-elevated shadow-[-20px_0_100px_rgba(0,0,0,0.5)] z-20 flex flex-col border-l border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-surface-elevated/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shrink-0">
              <ShoppingCart className="text-primary w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter leading-none">Tu Pedido</h2>
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none mt-1">
                {items.reduce((acc, curr) => acc + curr.quantity, 0)} Items Seleccionados
              </span>
            </div>
          </div>
          
          {items.length > 0 && (
            <Button variant="ghost" size="md" onClick={() => confirm('¿Vaciar pedido actual?') && clearCart()}>
              Vaciar
            </Button>
          )}
        </div>

        {/* CART ITEMS LIST */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((item) => (
              <CartItem 
                key={item.cartItemId}
                item={item} 
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={handleRemoveItem}
                onEdit={handleEditItem}
              />
            ))}
          </AnimatePresence>

          {items.length === 0 && (
            <motion.div 
              {...ANIMATIONS.fadeIn}
              className="h-[60%] flex flex-col items-center justify-center text-text-muted opacity-20 pointer-events-none"
            >
              <ShoppingCart className="w-32 h-32 mb-6" strokeWidth={1} />
              <p className="font-black text-2xl tracking-tighter uppercase">Esperando Productos...</p>
            </motion.div>
          )}
        </div>

        {/* CHECKOUT AREA (STICKY FOOTER) */}
        <footer className="p-5 bg-surface-base border-t border-white/5 shadow-[0_-20px_40px_rgba(0,0,0,0.4)] z-40">
          
          {/* TIPO DE PEDIDO SELECTOR */}
          <div className="flex gap-1 mb-6 bg-surface-elevated p-1 rounded-2xl border border-white/5">
            {[
              { id: 'TAKEAWAY', label: 'Mostrador', icon: <User size={14} /> },
              { id: 'MESA', label: 'Mesa', icon: <Utensils size={14} /> },
              { id: 'DELIVERY', label: 'Envío', icon: <Truck size={14} /> },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setOrderType(type.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  orderType === type.id 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'text-text-muted hover:bg-white/5'
                }`}
              >
                {type.icon}
                {type.label}
              </button>
            ))}
          </div>

          <div className="space-y-3 mb-6">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Nombre Cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-sm h-12 w-full px-4"
              />
              
              {orderType === 'DELIVERY' && (
                <motion.div {...ANIMATIONS.fadeIn}>
                  <Input
                    type="text"
                    placeholder="Dirección de Envío"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="text-sm h-12 w-full px-4 border-primary/30"
                  />
                </motion.div>
              )}

              {orderType === 'MESA' && (
                <motion.div {...ANIMATIONS.fadeIn}>
                  <select 
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    className="w-full bg-surface-elevated border border-primary/30 rounded-2xl h-12 px-4 text-text-primary uppercase tracking-widest text-[10px] font-black focus:outline-none focus:border-primary appearance-none"
                  >
                    <option value="">Seleccionar Mesa...</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id} disabled={t.status === 'OCCUPIED'}>
                        {t.label || `Mesa ${t.number}`} {t.status === 'OCCUPIED' ? '(OCUPADA)' : ''}
                      </option>
                    ))}
                  </select>
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-end mb-4">
            <span className="text-text-muted font-black uppercase tracking-widest text-[10px] mb-1">Total a Pagar</span>
            <span className="text-4xl font-black text-primary tracking-tighter leading-none">
              ${getTotal()}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button
              size="lg"
              fullWidth
              disabled={items.length === 0 || checkoutStatus === 'loading'}
              isLoading={checkoutStatus === 'loading'}
              onClick={handleCheckout}
              className="h-14 text-base font-black uppercase tracking-widest"
            >
              {checkoutStatus === 'loading' ? 'Procesando...' : 'Confirmar Pedido'}
            </Button>
            
            <div className="flex gap-2">
              <Button 
                variant={paymentMethod === 'CASH' ? 'primary' : 'secondary'} 
                fullWidth 
                disabled={checkoutStatus === 'loading'}
                onClick={() => setPaymentMethod('CASH')}
              >
                Efectivo
              </Button>
              <Button 
                variant={paymentMethod === 'CARD' ? 'primary' : 'secondary'} 
                fullWidth 
                disabled={checkoutStatus === 'loading'}
                onClick={() => setPaymentMethod('CARD')}
                className="text-xs"
              >
                Tarjeta / QR / Transferencia
              </Button>
            </div>
          </div>
        </footer>
      </aside>

      {/* TOAST SYSTEM */}
      <Toast 
        message="¡Pedido enviado a cocina!"
        type="success"
        isVisible={checkoutStatus === 'success'}
        onClose={() => setCheckoutStatus('idle')}
      />
      <Toast 
        message={errorMessage}
        type="error"
        isVisible={checkoutStatus === 'error'}
        onClose={() => setCheckoutStatus('idle')}
      />

      {/* PRINT PANEL */}
      <AnimatePresence>
        {lastOrder && (
          <div className="fixed bottom-6 right-6 z-50">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-surface-elevated border border-white/10 rounded-2xl shadow-2xl p-4 w-72"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Printer size={18} className="text-primary" />
                  <span className="font-black text-sm uppercase tracking-widest">Imprimir Ticket</span>
                </div>
                <button 
                  onClick={() => setLastOrder(null)}
                  className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-text-muted"
                >
                  ✕
                </button>
              </div>
              
              <div className="bg-surface-base rounded-xl p-3 mb-3 border border-white/5">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Orden</p>
                <p className="text-2xl font-black text-primary">#{String(lastOrder.ticketNumber || '???').padStart(3, '0')}</p>
              </div>

              {printerError && (
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-2 mb-3">
                  <p className="text-[10px] text-danger font-bold">{printerError}</p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={handlePrintKitchen}
                  disabled={printing || !printerReady}
                  className="w-full bg-surface-base hover:bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-left disabled:opacity-50 transition-colors"
                >
                  <p className="font-black text-xs uppercase tracking-widest">Ticket Cocina</p>
                  <p className="text-[10px] text-text-muted">Para la cocina</p>
                </button>
                
                <button
                  onClick={handlePrintCustomer}
                  disabled={printing || !printerReady}
                  className="w-full bg-surface-base hover:bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-left disabled:opacity-50 transition-colors"
                >
                  <p className="font-black text-xs uppercase tracking-widest">Ticket Cliente</p>
                  <p className="text-[10px] text-text-muted">Para entregar al cliente</p>
                </button>

                <button
                  onClick={handlePrintBoth}
                  disabled={printing || !printerReady}
                  className="w-full bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl py-3 px-4 text-left disabled:opacity-50 transition-colors"
                >
                  <p className="font-black text-xs uppercase tracking-widest text-primary">Imprimir Ambos</p>
                  <p className="text-[10px] text-text-muted">Cocina + Cliente</p>
                </button>
              </div>

              {!printerReady && !printerError && (
                <p className="text-[10px] text-text-muted text-center mt-2">
                  Conectando con impresora...
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POS CUSTOMIZATIONS MODAL */}
      <ModifierModal 
        isOpen={isModifierModalOpen}
        item={editingCartItem}
        onClose={() => setIsModifierModalOpen(false)}
        onSave={handleSaveModifiers}
      />
    </div>
  );
};

export default POSPage;
