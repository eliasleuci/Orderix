import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { ingredientService } from '../../services/ingredientService';
import { Ingredient, IngredientCategory } from '../../types/domain';
import { Package, Search, Edit3, XCircle, CheckCircle, AlertTriangle, TrendingDown, BarChart3, Clock, ArrowUp, ArrowDown, Minus, Plus, Trash2, Tag } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { ANIMATIONS } from '../../lib/motion';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Toast from '../../components/Toast';

type ViewMode = 'table' | 'report';

const COLORS = {
  ok: '#22c55e',
  low: '#eab308',
  out: '#ef4444',
  primary: '#f59e0b'
};

const COMMON_UNITS = ['unidad', 'gr', 'kg', 'ml', 'litro', 'cm', 'mts'];

const StockPage: React.FC = () => {
  const { branchId, role } = useAuthStore();
  const isAdmin = true;
  
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [newStockValue, setNewStockValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    unit: '',
    stock: '',
    minStock: '',
    categoryId: ''
  });
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error', visible: false });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true });
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setIngredients([]); // Force re-render
    
    try {
      console.log('Fetching data...');
      const [stockRes, categoriesRes] = await Promise.all([
        ingredientService.getBranchStock(),
        ingredientService.getCategories()
      ]);
      
      console.log('Stock response:', stockRes);
      console.log('Setting ingredients:', stockRes.data?.length);
      
      if (stockRes.error) {
        setError(stockRes.error);
      } else {
        setIngredients(stockRes.data || []);
        console.log('Ingredients set, count:', stockRes.data?.length);
      }
      
      if (!categoriesRes.error && categoriesRes.data) {
        setCategories(categoriesRes.data || []);
      }
    } catch (err: any) {
      console.error('Stock fetch error:', err);
      setError('Error al cargar datos. Verificá tu conexión.');
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [branchId]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const matchesSearch = ing.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || ing.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [ingredients, searchTerm, selectedCategory]);

  const getStockStatus = (ingredient: Ingredient): 'ok' | 'low' | 'out' => {
    if (ingredient.stock === 0) return 'out';
    if (ingredient.stock <= ingredient.min_stock) return 'low';
    return 'ok';
  };

  const stats = useMemo(() => {
    const total = ingredients.length;
    const lowStock = ingredients.filter(i => i.stock > 0 && i.stock <= i.min_stock).length;
    const outOfStock = ingredients.filter(i => i.stock === 0).length;
    return { total, lowStock, outOfStock };
  }, [ingredients]);

  const categoryDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    ingredients.forEach(ing => {
      const cat = ing.category?.name || 'Sin categoría';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [ingredients]);

  const stockByIngredient = useMemo(() => {
    return filteredIngredients
      .slice(0, 10)
      .map(ing => ({
        name: ing.name.length > 12 ? ing.name.substring(0, 12) + '...' : ing.name,
        stock: ing.stock,
        min: ing.min_stock,
        status: getStockStatus(ing)
      }));
  }, [filteredIngredients]);

  const getStockBadge = (status: 'ok' | 'low' | 'out') => {
    switch (status) {
      case 'out':
        return <Badge variant="danger">AGOTADO</Badge>;
      case 'low':
        return <Badge variant="warning">BAJO</Badge>;
      default:
        return <Badge variant="success">OK</Badge>;
    }
  };

  const handleOpenEdit = (ingredient: Ingredient) => {
    if (!isAdmin) return;
    setEditingIngredient(ingredient);
    setNewStockValue(ingredient.stock.toString());
    setEditReason('');
    setIsEditModalOpen(true);
  };

  const handleSaveStock = async () => {
    if (!editingIngredient) return;
    
    const newStock = parseFloat(newStockValue);
    if (isNaN(newStock) || newStock < 0) {
      showToast('El valor debe ser un número mayor o igual a 0', 'error');
      return;
    }

    const response = await ingredientService.updateStock(editingIngredient.id, newStock, editReason);
    if (response.error) {
      showToast(`Error al actualizar: ${response.error}`, 'error');
    } else {
      showToast(`Stock de "${editingIngredient.name}" actualizado`, 'success');
      setIsEditModalOpen(false);
      fetchData();
    }
  };

  const handleDeleteIngredient = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;

    console.log('handleDeleteIngredient called:', id, name);
    const response = await ingredientService.deleteIngredient(id);
    console.log('Delete response:', response);
    if (response.error) {
      showToast(`Error al eliminar: ${response.error}`, 'error');
    } else {
      showToast(`"${name}" eliminado`, 'success');
      fetchData();
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    const response = await ingredientService.createCategory(newCategoryName);
    if (response.error) {
      showToast(`Error: ${response.error}`, 'error');
    } else if (response.data) {
      setCategories(prev => [...prev, response.data!].sort((a, b) => a.name.localeCompare(b.name)));
      setNewIngredient(prev => ({ ...prev, categoryId: response.data!.id }));
      showToast(`Categoría "${response.data.name}" creada`, 'success');
    }
    setShowNewCategory(false);
    setNewCategoryName('');
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newIngredient.name.trim() || !newIngredient.unit.trim()) {
      showToast('Completá los campos requeridos', 'error');
      return;
    }

    const stock = parseFloat(newIngredient.stock) || 0;
    const minStock = parseFloat(newIngredient.minStock) || 0;

    const response = await ingredientService.createIngredient({
      name: newIngredient.name.trim(),
      unit: newIngredient.unit.trim(),
      stock,
      minStock,
      categoryId: newIngredient.categoryId || undefined
    });

    if (response.error) {
      showToast(`Error: ${response.error}`, 'error');
    } else {
      showToast(`"${newIngredient.name}" creado exitosamente`, 'success');
      setIsCreateModalOpen(false);
      setNewIngredient({ name: '', unit: '', stock: '', minStock: '', categoryId: '' });
      fetchData();
    }
  };

  return (
    <div className="flex h-screen bg-surface-base text-text-primary overflow-hidden relative font-sans">
      <div className="flex-1 flex flex-col p-6 overflow-hidden z-10">
        
        {/* HEADER */}
        <header className="mb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
              <Package size={24} className="text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Inventario</h1>
              <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">
                {stats.total} ingredientes • {stats.lowStock} bajos • {stats.outOfStock} agotados
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            {isAdmin && (
              <Button size="lg" leftIcon={<Plus size={18} />} onClick={() => setIsCreateModalOpen(true)} className="h-12 px-6">
                Agregar
              </Button>
            )}
            
            <div className="flex bg-surface-elevated rounded-2xl p-1 border border-white/5">
              <button
                onClick={() => setViewMode('table')}
                className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                  viewMode === 'table' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Inventario
              </button>
              <button
                onClick={() => setViewMode('report')}
                className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                  viewMode === 'report' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Reportes
              </button>
            </div>
          </div>
        </header>

        {viewMode === 'table' ? (
          <>
            {/* FILTERS */}
            <div className="flex gap-4 mb-4 flex-wrap">
              <div className="w-72">
                <Input
                  placeholder="Buscar ingrediente..."
                  icon={<Search size={16} />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11"
                />
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2.5 rounded-full font-black uppercase tracking-widest text-xs whitespace-nowrap transition-colors ${
                    selectedCategory === null 
                      ? 'bg-primary text-white' 
                      : 'bg-surface-elevated text-text-muted hover:text-text-primary border border-white/5'
                  }`}
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2.5 rounded-full font-black uppercase tracking-widest text-xs whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id 
                        ? 'bg-primary text-white' 
                        : 'bg-surface-elevated text-text-muted hover:text-text-primary border border-white/5'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Card variant="solid" padding="normal" className="border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Package size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest">Total</p>
                    <p className="text-xl font-black text-primary">{stats.total}</p>
                  </div>
                </div>
              </Card>
              <Card variant="solid" padding="normal" className="border border-warning/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-warning/10 rounded-xl flex items-center justify-center">
                    <TrendingDown size={18} className="text-warning" />
                  </div>
                  <div>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest">Stock Bajo</p>
                    <p className="text-xl font-black text-warning">{stats.lowStock}</p>
                  </div>
                </div>
              </Card>
              <Card variant="solid" padding="normal" className="border border-danger/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-danger/10 rounded-xl flex items-center justify-center">
                    <AlertTriangle size={18} className="text-danger" />
                  </div>
                  <div>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest">Agotados</p>
                    <p className="text-xl font-black text-danger">{stats.outOfStock}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* TABLE or EMPTY STATE */}
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="inline-block"
                    >
                      <Package size={48} className="text-primary opacity-30" />
                    </motion.div>
                    <p className="text-text-muted mt-4 font-bold uppercase tracking-widest text-sm">Cargando...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md p-8">
                    <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle size={40} className="text-danger" />
                    </div>
                    {serverError ? (
                      <>
                        <h3 className="text-xl font-black text-text-primary mb-2">Servidor no disponible</h3>
                        <p className="text-text-muted mb-6">
                          El servidor Express no está corriendo. Ejecutá en una terminal:
                        </p>
                        <code className="block bg-surface-base px-4 py-3 rounded-xl text-sm text-primary font-mono mb-6">
                          cd server && npm run dev
                        </code>
                        <p className="text-text-muted text-xs mb-4">
                          Asegurate de que el servidor esté corriendo en puerto 3000
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl font-black text-text-primary mb-2">Error al cargar</h3>
                        <p className="text-text-muted mb-4">{error}</p>
                      </>
                    )}
                    <Button className="mt-4" onClick={fetchData}>
                      Reintentar
                    </Button>
                  </div>
                </div>
              ) : filteredIngredients.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Package size={64} className="text-text-muted mx-auto mb-4 opacity-20" />
                    <p className="text-text-muted font-black text-xl uppercase tracking-tighter mb-2">
                      {ingredients.length === 0 ? 'Sin ingredientes' : 'Sin resultados'}
                    </p>
                    <p className="text-text-muted text-sm mb-6">
                      {ingredients.length === 0 
                        ? 'Agregá tu primer ingrediente para comenzar' 
                        : 'Probá con otro filtro o búsqueda'}
                    </p>
                    {isAdmin && ingredients.length === 0 && (
                      <Button leftIcon={<Plus size={18} />} onClick={() => setIsCreateModalOpen(true)}>
                        Crear ingrediente
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-surface-elevated rounded-2xl border border-white/5 overflow-hidden h-full flex flex-col">
                  <div className="grid grid-cols-12 gap-3 p-4 border-b border-white/5 bg-white/[0.02] shrink-0">
                    <div className="col-span-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Ingrediente</div>
                    <div className="col-span-2 text-[10px] font-black text-text-muted uppercase tracking-widest">Categoría</div>
                    <div className="col-span-2 text-[10px] font-black text-text-muted uppercase tracking-widest">Stock</div>
                    <div className="col-span-2 text-[10px] font-black text-text-muted uppercase tracking-widest">Mín.</div>
                    <div className="col-span-2 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Acciones</div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto">
                    {filteredIngredients.map((ing) => {
                      const status = getStockStatus(ing);
                      return (
                        <div
                          key={ing.id}
                          className={`grid grid-cols-12 gap-3 p-4 border-b border-white/5 transition-colors cursor-pointer hover:bg-white/[0.02] ${
                            status === 'out' ? 'bg-danger/5' : status === 'low' ? 'bg-warning/5' : ''
                          }`}
                          onClick={() => handleOpenEdit(ing)}
                        >
                          <div className="col-span-4 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              status === 'out' ? 'bg-danger' : status === 'low' ? 'bg-warning' : 'bg-success'
                            }`} />
                            <div>
                              <span className="font-black text-sm uppercase tracking-tight block">{ing.name}</span>
                              <span className="text-text-muted text-[10px] uppercase">{ing.unit}</span>
                            </div>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <Badge variant="neutral" className="text-[10px]">
                              {ing.category?.name || 'Sin categoría'}
                            </Badge>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className={`font-black text-lg ${
                              status === 'out' ? 'text-danger' : status === 'low' ? 'text-warning' : 'text-primary'
                            }`}>
                              {ing.stock.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className="text-text-muted font-bold text-sm">{ing.min_stock.toLocaleString('es-AR')}</span>
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {getStockBadge(status)}
                            {isAdmin && (
                              <>
                                <button 
                                  className="w-8 h-8 bg-primary/10 hover:bg-primary/20 rounded-lg flex items-center justify-center text-primary transition-colors"
                                  onClick={() => handleOpenEdit(ing)}
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button 
                                  className="w-8 h-8 bg-danger/10 hover:bg-danger/20 rounded-lg flex items-center justify-center text-danger transition-colors"
                                  onClick={() => handleDeleteIngredient(ing.id, ing.name)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card padding="normal">
                <h3 className="text-sm font-black uppercase tracking-widest text-text-muted mb-4">Distribución por Categoría</h3>
                {categoryDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-text-muted text-sm">
                    Sin datos disponibles
                  </div>
                )}
              </Card>
              
              <Card padding="normal">
                <h3 className="text-sm font-black uppercase tracking-widest text-text-muted mb-4">Stock por Ingrediente</h3>
                {stockByIngredient.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stockByIngredient} layout="vertical">
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} width={80} />
                      <Tooltip 
                        contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="stock" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Stock" />
                      <Bar dataKey="min" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Mín." />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-text-muted text-sm">
                    Sin datos disponibles
                  </div>
                )}
              </Card>
              
              <Card padding="normal" className="lg:col-span-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-text-muted mb-4">Ingredientes Críticos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-center">
                    <AlertTriangle size={24} className="text-danger mx-auto mb-2" />
                    <p className="text-2xl font-black text-danger">{stats.outOfStock}</p>
                    <p className="text-xs font-black uppercase text-text-muted tracking-widest">Agotados</p>
                  </div>
                  <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-center">
                    <TrendingDown size={24} className="text-warning mx-auto mb-2" />
                    <p className="text-2xl font-black text-warning">{stats.lowStock}</p>
                    <p className="text-xs font-black uppercase text-text-muted tracking-widest">Stock Bajo</p>
                  </div>
                  <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
                    <Package size={24} className="text-success mx-auto mb-2" />
                    <p className="text-2xl font-black text-success">{stats.total - stats.outOfStock - stats.lowStock}</p>
                    <p className="text-xs font-black uppercase text-text-muted tracking-widest">OK</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {isEditModalOpen && editingIngredient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
            
            <motion.div {...ANIMATIONS.scaleIn} className="bg-surface-elevated w-full max-w-md rounded-[2rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden">
              <header className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Editar Stock</h2>
                  <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">{editingIngredient.name}</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-colors">
                  <XCircle size={20} />
                </button>
              </header>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Nuevo Stock ({editingIngredient.unit})</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newStockValue}
                    onChange={(e) => setNewStockValue(e.target.value)}
                    placeholder="0.00"
                    className="h-12 text-lg font-black text-center"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Motivo (opcional)</label>
                  <Input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Ej: Reposición semanal"
                  />
                </div>
                
                <div className="bg-surface-base rounded-xl p-3 border border-white/5 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted text-xs font-black uppercase">Stock Actual</span>
                    <span className="font-bold">{editingIngredient.stock} {editingIngredient.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted text-xs font-black uppercase">Diferencia</span>
                    <span className={`font-bold ${parseFloat(newStockValue) - editingIngredient.stock >= 0 ? 'text-success' : 'text-danger'}`}>
                      {parseFloat(newStockValue) - editingIngredient.stock >= 0 ? '+' : ''}{(parseFloat(newStockValue || '0') - editingIngredient.stock).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <footer className="p-6 border-t border-white/5 bg-surface-base flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveStock} leftIcon={<CheckCircle size={16} />}>
                  Guardar
                </Button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
            
            <motion.div {...ANIMATIONS.scaleIn} className="bg-surface-elevated w-full max-w-md rounded-[2rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden">
              <header className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Nuevo Ingrediente</h2>
                  <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">Configuración de inventario</p>
                </div>
                <button onClick={() => setIsCreateModalOpen(false)} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-colors">
                  <XCircle size={20} />
                </button>
              </header>

              <form onSubmit={handleSaveIngredient} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Nombre *</label>
                  <Input
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Pan de hamburguesa"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Unidad *</label>
                    {!showNewCategory ? (
                      <select
                        className="w-full bg-surface-base border border-white/10 rounded-xl h-11 px-4 text-text-primary text-sm font-bold uppercase tracking-widest focus:outline-none focus:border-primary"
                        value={newIngredient.unit}
                        onChange={(e) => {
                          if (e.target.value === '__NEW__') {
                            setShowNewCategory(true);
                          } else {
                            setNewIngredient(prev => ({ ...prev, unit: e.target.value }));
                          }
                        }}
                        required
                      >
                        <option value="">Seleccionar...</option>
                        {COMMON_UNITS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                        <option value="__NEW__">➕ Otra...</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ej: kg"
                          value={newIngredient.unit}
                          onChange={(e) => setNewIngredient(prev => ({ ...prev, unit: e.target.value }))}
                          autoFocus
                        />
                        <button type="button" onClick={() => setShowNewCategory(false)} className="w-11 h-11 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center">
                          <XCircle size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Categoría</label>
                    <select
                      className="w-full bg-surface-base border border-white/10 rounded-xl h-11 px-4 text-text-primary text-sm font-bold uppercase tracking-widest focus:outline-none focus:border-primary"
                      value={newIngredient.categoryId}
                      onChange={(e) => setNewIngredient(prev => ({ ...prev, categoryId: e.target.value }))}
                    >
                      <option value="">Sin categoría</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Stock Inicial</label>
                    <Input
                      type="number"
                      min="0"
                      value={newIngredient.stock}
                      onChange={(e) => setNewIngredient(prev => ({ ...prev, stock: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Stock Mínimo</label>
                    <Input
                      type="number"
                      min="0"
                      value={newIngredient.minStock}
                      onChange={(e) => setNewIngredient(prev => ({ ...prev, minStock: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>

                <footer className="pt-4 flex justify-end gap-3">
                  <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" leftIcon={<Plus size={16} />}>
                    Crear
                  </Button>
                </footer>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.visible} 
        onClose={() => setToast(prev => ({ ...prev, visible: false }))} 
      />
    </div>
  );
};

export default StockPage;
