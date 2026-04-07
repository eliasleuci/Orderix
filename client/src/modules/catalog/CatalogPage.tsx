import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { productService } from '../../services/productService';
import { Product, Category } from '../../types/domain';
import { BookOpen, Plus, Search, Edit3, Trash2, Image as ImageIcon, CheckCircle, XCircle, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ANIMATIONS } from '../../lib/motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Toast from '../../components/Toast';

const CatalogPage: React.FC = () => {
  const { branchId } = useAuthStore();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Feedback State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', visible: boolean }>({
    message: '', type: 'success', visible: false
  });

  // New Category State
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const fetchData = async () => {
    if (!branchId) return;
    setLoading(true);
    const [pRes, cRes] = await Promise.all([
      productService.getBranchProducts(branchId, true), // Include inactive
      productService.getCategories()
    ]);
    setProducts(pRes.data || []);
    setCategories(cRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [branchId]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('La imagen es demasiado grande (Máximo 2MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingProduct(prev => prev ? { ...prev, image_url: reader.result as string } : null);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct({ ...product });
    } else {
      setEditingProduct({ branch_id: branchId || '', is_active: true, price: 0 });
    }
    setShowNewCategory(false);
    setNewCategoryName('');
    setIsModalOpen(true);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { data, error } = await productService.createCategory(newCategoryName);
    if (error) {
      showToast(`Error al crear categoría: ${error}`, 'error');
      return;
    }
    if (data) {
      setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setEditingProduct(prev => prev ? { ...prev, category_id: data.id } : prev);
      showToast(`Categoría "${data.name}" creada.`, 'success');
    }
    setShowNewCategory(false);
    setNewCategoryName('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.category_id) {
      showToast('Por favor completa los campos requeridos.', 'error');
      return;
    }

    const { categories: _, ...productDataToSave } = editingProduct as any;

    if (editingProduct.id) {
      const res = await productService.updateProduct(editingProduct.id, productDataToSave);
      if (res.error) {
        showToast(res.error, 'error');
      } else if (res.data) {
        const newProduct = res.data as Product;
        const category = categories.find((c) => c.id === newProduct.category_id);
        setProducts(prev => prev.map(p => p.id === newProduct.id ? { ...newProduct, categories: category } : p));
        showToast('Producto actualizado correctamente.', 'success');
        setIsModalOpen(false);
      }
    } else {
      const res = await productService.createProduct(productDataToSave);
      if (res.error) {
        showToast(res.error, 'error');
      } else if (res.data) {
        const newProduct = res.data as Product;
        const category = categories.find((c) => c.id === newProduct.category_id);
        setProducts(prev => [{ ...newProduct, categories: category }, ...prev]);
        showToast('Producto creado correctamente.', 'success');
        setIsModalOpen(false);
      }
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto de forma permanente?')) return;
    
    const { error } = await productService.deleteProduct(id);
    if (error) {
      showToast(error, 'error');
    } else {
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast('Producto eliminado.', 'success');
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  return (
    <div className="flex h-screen bg-surface-base text-text-primary overflow-hidden relative font-sans">
      <div className="flex-1 flex flex-col p-8 overflow-hidden z-10">
        
        {/* HEADER */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                <BookOpen size={24} className="text-primary" />
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Catálogo Menú</h1>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-80">
              <Input
                placeholder="Buscar producto..."
                icon={<Search size={20} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-14"
              />
            </div>
            <Button size="lg" leftIcon={<Plus size={20} />} onClick={() => handleOpenModal()} className="h-14 px-8">
              Nuevo Producto
            </Button>
          </div>
        </header>

        {/* CATEGORY TABS */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-6 py-3 rounded-full font-black uppercase tracking-widest text-xs transition-colors whitespace-nowrap ${
              selectedCategory === null ? 'bg-primary text-surface-base' : 'bg-surface-elevated text-text-muted hover:text-text-primary'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-3 rounded-full font-black uppercase tracking-widest text-xs transition-colors whitespace-nowrap ${
                selectedCategory === cat.id ? 'bg-primary text-surface-base' : 'bg-surface-elevated text-text-muted hover:text-text-primary border border-white/5'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* PRODUCTS GRID */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <BookOpen size={48} className="text-primary opacity-20" />
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pr-2 scroll-smooth pb-12">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((p) => (
                <motion.div key={p.id} layout {...ANIMATIONS.scaleIn}>
                  <Card variant="glass" padding="normal" className={`relative flex flex-col border ${p.is_active ? 'border-primary/10 hover:border-primary/30' : 'border-danger/20 opacity-70'} transition-all duration-300 group shadow-sm hover:shadow-xl`}>
                    
                    <div className="aspect-[4/3] rounded-2xl bg-surface-base/50 mb-4 flex items-center justify-center overflow-hidden relative border border-border-subtle">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <ImageIcon size={48} className="text-text-muted/20" />
                      )}
                      <div className="absolute top-4 left-4">
                        <Badge variant={p.is_active ? "success" : "danger"}>
                          {p.is_active ? "Activo" : "Pausado"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-1 min-h-[80px]">
                      <h4 className="font-black text-xl tracking-tight uppercase leading-tight mb-2 text-text-primary">{p.name}</h4>
                      <p className="text-text-muted text-xs line-clamp-2 font-medium">
                        {p.description || "Sin descripción establecida."}
                      </p>
                    </div>

                    <div className="flex items-end justify-between mt-6">
                      <span className="text-2xl font-black text-primary tracking-tighter">${p.price}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                        <button 
                          onClick={() => handleOpenModal(p)}
                          className="w-10 h-10 bg-primary/10 hover:bg-primary/20 rounded-xl flex items-center justify-center text-primary transition-colors"
                          title="Editar"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p.id)}
                          className="w-10 h-10 bg-danger/10 hover:bg-danger/20 rounded-xl flex items-center justify-center text-danger transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-text-muted opacity-30">
                <BookOpen size={64} className="mb-4" />
                <p className="font-black text-2xl uppercase tracking-tighter">No hay productos en esta categoría.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {isModalOpen && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            
            <motion.div {...ANIMATIONS.scaleIn} className="bg-surface-elevated w-full max-w-2xl rounded-[2.5rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
              <header className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingProduct.id ? 'Editar Producto' : 'Crear Producto'}</h2>
                  <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">Configuración del catálogo</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-colors">
                  <XCircle size={24} />
                </button>
              </header>

              <div className="p-8 overflow-y-auto flex-1">
                <form id="productForm" onSubmit={handleSaveProduct} className="space-y-6">
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Nombre del Producto *</label>
                      <Input value={editingProduct.name || ''} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} placeholder="Ej: Burger Doble" required />
                    </div>
                    <div>
                      <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Precio ($) *</label>
                      <Input type="number" min="0" step="0.01" value={editingProduct.price || ''} onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })} placeholder="0.00" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Categoría *</label>
                      
                      {!showNewCategory ? (
                        <div className="flex gap-2">
                          <select 
                            required={!showNewCategory}
                            className="flex-1 bg-surface-base border border-white/10 rounded-2xl h-14 px-4 text-text-primary uppercase tracking-widest text-sm font-bold focus:outline-none focus:border-primary appearance-none"
                            value={editingProduct.category_id || ''}
                            onChange={(e) => {
                              if (e.target.value === '__NEW__') {
                                setShowNewCategory(true);
                              } else {
                                setEditingProduct({ ...editingProduct, category_id: e.target.value });
                              }
                            }}
                          >
                            <option value="" disabled>Seleccionar...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            <option value="__NEW__">➕ Nueva categoría...</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Ej: POSTRES"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateCategory())}
                            className="flex-1 bg-surface-base border border-primary/50 rounded-2xl h-14 px-4 text-text-primary uppercase tracking-widest text-sm font-bold focus:outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            className="w-14 h-14 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded-2xl flex items-center justify-center text-primary transition-colors shrink-0"
                            title="Confirmar"
                          >
                            <CheckCircle size={20} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                            className="w-14 h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center text-text-muted transition-colors shrink-0"
                            title="Cancelar"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      )}
                      
                      {showNewCategory && (
                        <p className="text-[10px] text-text-muted mt-1.5 font-bold uppercase tracking-widest">
                          <Tag size={9} className="inline mr-1" />Escribí el nombre y presá ✔
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Estado *</label>
                      <button 
                        type="button"
                        onClick={() => setEditingProduct({ ...editingProduct, is_active: !editingProduct.is_active })}
                        className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${
                          editingProduct.is_active ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'
                        }`}
                      >
                        {editingProduct.is_active ? <CheckCircle size={18} /> : <XCircle size={18} />}
                        {editingProduct.is_active ? 'Activo (En Venta)' : 'Pausado (Sin Stock)'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">Descripción (Opcional)</label>
                    <textarea 
                      className="w-full bg-surface-base border border-white/10 rounded-2xl p-4 text-text-primary focus:outline-none focus:border-primary min-h-[100px] resize-none"
                      placeholder="Ingredientes o detalles..."
                      value={editingProduct.description || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-text-muted uppercase tracking-widest mb-2 block">
                      Imagen del Producto
                    </label>
                    <div className="flex gap-4 items-center">
                      <div className="w-16 h-16 rounded-xl bg-surface-base border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                        {editingProduct.image_url ? (
                          <img src={editingProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={20} className="text-white/20" />
                        )}
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="flex items-center justify-center w-full h-14 bg-surface-base hover:bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer transition-colors text-sm font-bold text-text-muted uppercase tracking-widest">
                          <ImageIcon size={18} className="mr-2" />
                          Subir Fotografía
                          <input 
                            type="file" 
                            accept="image/jpeg, image/png, image/webp" 
                            className="hidden" 
                            onChange={handleImageUpload} 
                          />
                        </label>
                        {editingProduct.image_url && (
                          <button 
                            type="button"
                            onClick={() => setEditingProduct({ ...editingProduct, image_url: '' })}
                            className="text-[10px] text-danger uppercase tracking-widest font-black text-left hover:underline"
                          >
                            Quitar Imagen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                </form>
              </div>

              <footer className="p-8 border-t border-white/5 bg-surface-base flex justify-end gap-4">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" form="productForm" size="lg" className="px-8 font-black uppercase tracking-widest">
                  Guardar Cambios
                </Button>
              </footer>
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

export default CatalogPage;
