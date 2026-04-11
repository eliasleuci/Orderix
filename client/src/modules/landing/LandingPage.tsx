import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Zap, 
  Play, 
  TrendingUp, 
  Wifi, 
  X, 
  Maximize2, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  Menu,
  Instagram,
  Send,
  FileSpreadsheet,
  PackageX,
  FileX,
  XCircle,
  CheckCircle2,
  PackageCheck,
  BarChart3,
  Link as LinkIcon,
  ClipboardList,
  Package,
  Utensils,
  Building2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  const galleryImages = [
    '/landing/img/1.jpeg',
    '/landing/img/2.jpeg',
    '/landing/img/3.jpeg',
    '/landing/img/img1.jpg',
    '/landing/img/img2.jpg',
    '/landing/img/img3.jpg',
    '/landing/img/img4.jpg'
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setIsLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    document.body.style.overflow = '';
  };

  const nextImage = (e?: any) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const prevImage = (e?: any) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const openDemoModal = () => {
    setIsDemoModalOpen(true);
    setFormSuccess(false);
    document.body.style.overflow = 'hidden';
  };

  const closeDemoModal = () => {
    setIsDemoModalOpen(false);
    document.body.style.overflow = '';
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nombre = formData.get('nombre');
    const email = formData.get('email');
    const telefono = formData.get('telefono');
    const local = formData.get('local');
    const sucursales = formData.get('sucursales');
    
    const mensaje = `🔥 *SOLICITUD DE DEMO - ORDERIX*\n\n` +
      `👤 Nombre: ${nombre}\n` +
      `📧 Email: ${email}\n` +
      `📱 Teléfono: ${telefono}\n` +
      `🏪 Local: ${local}\n` +
      `🏢 Sucursales: ${sucursales}\n\n` +
      `Enviado desde landing page`;
    
    const whatsappUrl = `https://wa.me/5493515208784?text=${encodeURIComponent(mensaje)}`;
    
    setFormSuccess(true);
    setTimeout(() => {
      window.open(whatsappUrl, '_blank');
      closeDemoModal();
    }, 1000);
  };

  return (
    <div className="landing-body selection:bg-[#FF6B00] selection:text-white leading-normal tracking-normal text-white bg-[#1c1c20] overflow-x-hidden w-full antialiased">
      {/* Noise Overlay */}
      <div className="noise-overlay"></div>

      {/* Navbar */}
      <nav id="navbar" className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'glass shadow-2xl h-16' : 'h-20'}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            <a href="#" className="flex items-center gap-3 group">
              <div className="relative w-11 h-11">
                <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B00] to-[#CC5500] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-lg"></div>
                <img src="/landing/img/icono.webp" alt="ORDERIX" className="relative w-11 h-11 rounded-xl object-cover shadow-lg shadow-[#FF6B00]/30" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight">ORDERIX</span>
            </a>
            
            <div className="hidden md:flex items-center gap-10">
              <a href="#modulos" className="text-gray-400 hover:text-white transition-colors font-medium text-sm tracking-wide">Módulos</a>
              <a href="#galeria" className="text-gray-400 hover:text-white transition-colors font-medium text-sm tracking-wide">Galería</a>
              <a href="#precios" className="text-gray-400 hover:text-white transition-colors font-medium text-sm tracking-wide">Precios</a>
            </div>
            
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-gray-400 hover:text-white transition-colors font-bold text-[10px] uppercase tracking-[0.2em] mr-2">
                Ingresar
              </Link>
              
              <button 
                onClick={openDemoModal} 
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF6B00] hover:bg-[#CC5500] text-white font-semibold rounded-full transition-all shadow-lg shadow-[#FF6B00]/20 hover:shadow-[#FF6B00]/40 hover:-translate-y-0.5 text-sm cursor-pointer border-0"
              >
                Solicitar Demo
                <ArrowRight size={16} />
              </button>
              
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 text-gray-400 hover:text-white border-0 bg-transparent">
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden glass border-t border-white/5`}>
          <div className="px-6 py-6 space-y-4">
            <a href="#modulos" onClick={() => setIsMenuOpen(false)} className="block text-gray-400 hover:text-white py-2 font-medium">Módulos</a>
            <a href="#galeria" onClick={() => setIsMenuOpen(false)} className="block text-gray-400 hover:text-white py-2 font-medium">Galería</a>
            <a href="#precios" onClick={() => setIsMenuOpen(false)} className="block text-gray-400 hover:text-white py-2 font-medium">Precios</a>
            <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block text-gray-400 hover:text-white py-2 font-medium">Ingresar</Link>
            <button onClick={() => { setIsDemoModalOpen(true); setIsMenuOpen(false); }} className="w-full text-center py-3 bg-[#FF6B00] text-white font-semibold rounded-full mt-4 border-0">Solicitar Demo</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen pt-32 lg:pt-20 relative overflow-hidden flex items-center">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#FF6B00]/10 rounded-full blur-[150px] animate-pulse-glow"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#FF6B00]/5 rounded-full blur-[150px]"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-32 lg:pt-40 relative w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            
            <div className="space-y-8 animate-fadeUp flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="inline-flex items-center gap-3 px-4 py-2 glass rounded-full text-[12px] sm:text-sm mt-8 lg:mt-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-gray-400">+200 locales activos</span>
              </div>
              
              <h1 className="font-display font-black text-4xl sm:text-7xl lg:text-8xl leading-[1.1] lg:leading-[0.9] tracking-tighter">
                Tu cocina,<br />
                <span className="gradient-text">sin caos.</span>
              </h1>
              
              <p className="text-base lg:text-xl text-gray-400 max-w-lg leading-relaxed font-medium px-2 lg:px-0">
                Gestioná pedidos, stock y mesas desde un solo lugar. Sin papelitos, sin confusiones, sin tiempo perdido.
              </p>
              
              <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                <button onClick={openDemoModal} className="group inline-flex items-center gap-3 px-8 py-4 bg-[#FF6B00] hover:bg-[#CC5500] text-white text-lg font-semibold rounded-full transition-all shadow-2xl shadow-[#FF6B00]/25 hover:shadow-[#FF6B00]/40 hover:-translate-y-1 border-0 cursor-pointer">
                  Arrancar ahora
                  <Zap size={20} className="group-hover:rotate-12 transition-transform" />
                </button>
                <a href="#galeria" className="inline-flex items-center gap-3 px-8 py-4 glass hover:bg-white/10 text-white font-semibold rounded-full transition-all hover:-translate-y-1 group">
                  <Play size={20} className="text-[#FF6B00] group-hover:scale-110 transition-transform fill-[#FF6B00]" />
                  Ver demo
                </a>
              </div>
              
              <div className="flex items-center justify-center lg:justify-start gap-10 pt-6 border-t border-white/10 w-full lg:w-auto">
                <div>
                  <div className="font-display font-bold text-2xl lg:text-3xl text-[#FF6B00]">+40%</div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase font-black">Más ventas</div>
                </div>
                <div className="w-px h-12 bg-white/10"></div>
                <div>
                  <div className="font-display font-bold text-2xl lg:text-3xl text-green-400">-85%</div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase font-black">Menos errores</div>
                </div>
                <div className="w-px h-12 bg-white/10"></div>
                <div>
                  <div className="font-display font-bold text-2xl lg:text-3xl text-white">3h</div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase font-black">Ahorradas</div>
                </div>
              </div>
            </div>
            
            <div className="relative animate-fadeUp delay-300 perspective-3d block mt-12 lg:mt-0">
              <div className="absolute -inset-10 bg-gradient-to-r from-[#FF6B00]/30 via-transparent to-[#FF6B00]/30 rounded-3xl blur-2xl animate-pulse-glow"></div>
              
              <div className="hero-image-container relative rounded-2xl overflow-hidden shadow-2xl shadow-[#FF6B00]/10 border border-white/10">
                <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c20] via-transparent to-transparent z-10"></div>
                <img src="/landing/img/dashboard.jpg" alt="ORDERIX Dashboard" className="w-full h-auto relative z-0" />
                
                <div className="absolute top-6 left-6 z-20 animate-float glass rounded-xl p-4 scale-75 lg:scale-100 origin-top-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <TrendingUp size={20} className="text-green-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">Ventas hoy</div>
                      <div className="font-display font-bold text-lg leading-none mt-1">$127.450</div>
                    </div>
                  </div>
                </div>
                
                <div className="absolute bottom-6 right-6 z-20 animate-float-delayed glass rounded-xl px-4 py-2.5 scale-75 lg:scale-100 origin-bottom-right">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="font-mono text-[10px] font-bold text-gray-300 uppercase">+1 pedido #849</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section id="problema" className="py-24 lg:py-32 relative overflow-hidden scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 relative">
          <div className="text-center mb-16 px-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-[10px] font-black uppercase tracking-widest rounded-full mb-6">
              SISTEMA ACTUAL
            </span>
            <h2 className="font-display font-black text-4xl lg:text-7xl tracking-tighter mb-4 leading-tight">¿Te suena esto?</h2>
            <p className="text-gray-400 text-lg lg:text-xl max-w-xl mx-auto">El caos de todos los días, traducido a errores del sistema</p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="glass-card rounded-3xl p-8 lg:p-10 border-red-500/20 hover:border-red-500/40 transition-colors">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <XCircle size={24} className="text-red-400" />
                </div>
                <div>
                  <span className="text-red-400 font-display font-bold text-lg uppercase tracking-tight">Sin ORDERIX</span>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">El camino difícil</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: FileX, text: 'Pedidos en papel o WhatsApp' },
                  { icon: PackageX, text: 'Stock inventariado a mano' },
                  { icon: FileSpreadsheet, text: 'Excel al final del día' },
                  { icon: LinkIcon, text: 'Caja y cocina descoordinados' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-red-500/5 rounded-xl border border-red-500/10 transition-transform hover:translate-x-1">
                    <item.icon size={18} className="text-red-400 shrink-0" />
                    <span className="text-gray-300 font-bold uppercase tracking-tight text-xs">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="glass-card rounded-3xl p-8 lg:p-10 border-green-500/20 hover:border-green-500/40 transition-colors">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-green-400" />
                </div>
                <div>
                  <span className="text-green-400 font-display font-bold text-lg uppercase tracking-tight">Con ORDERIX</span>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">El camino inteligente</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Send, text: 'Pedidos en tiempo real a cocina' },
                  { icon: PackageCheck, text: 'Stock automático con alertas' },
                  { icon: BarChart3, text: 'Reportes en tiempo real' },
                  { icon: LinkIcon, text: 'Caja y cocina 100% sincronizados' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-green-500/5 rounded-xl border border-green-500/10 transition-transform hover:translate-x-1">
                    <item.icon size={18} className="text-green-400 shrink-0" />
                    <span className="text-gray-300 font-bold uppercase tracking-tight text-xs">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modulos" className="py-24 lg:py-32 relative scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
          <div className="text-center mb-16 animate-fadeUp">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] font-mono text-[10px] font-black uppercase tracking-widest rounded-full mb-6">SISTEMA MODULAR</span>
            <h2 className="font-display font-black text-4xl lg:text-7xl tracking-tighter mb-4 leading-tight">Todo lo que necesitás,<br /><span className="gradient-text leading-tight">nada que no.</span></h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { id: 'pedidos', title: 'Pedidos', icon: ClipboardList, desc: 'De la pantalla directo a cocina. Estados en tiempo real: pendiente → preparando → listo.' },
              { id: 'stock', title: 'Stock', icon: Package, desc: 'Descuento automático por venta. Alertas cuando algo se agota.' },
              { id: 'menu', title: 'Menú Digital', icon: Utensils, desc: 'Categorías, fotos, variantes, precios. Actualizable al instante.' },
              { id: 'reports', title: 'Reportes', icon: BarChart3, desc: 'Qué se vende, cuándo, a quién. Datos reales para decidir.' },
              { id: 'multi', title: 'Sucursal', icon: Building2, desc: 'Varios locales, una sola app. Control total remoto.' },
              { id: 'roles', title: 'Roles', icon: ShieldCheck, desc: 'Admin, cajero, cocina. Cada uno con su acceso seguro.' }
            ].map((mod) => (
              <div key={mod.id} className="bento-card glass-card rounded-3xl p-8 group flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-[#FF6B00]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <mod.icon size={32} className="text-[#FF6B00]" />
                </div>
                <h3 className="font-display font-black text-2xl mb-3 tracking-tighter uppercase leading-none">{mod.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="galeria" className="py-24 lg:py-32 relative overflow-hidden scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16 animate-fadeUp">
            <h2 className="font-display font-black text-4xl lg:text-7xl tracking-tighter mb-4 leading-tight uppercase">Galería</h2>
            <p className="text-gray-400 text-sm lg:text-lg font-bold uppercase tracking-widest">Capturas reales del producto</p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {galleryImages.map((src, index) => (
              <div 
                key={index} 
                className="group relative rounded-2xl overflow-hidden cursor-pointer aspect-video bg-[#242428] border border-white/5"
                onClick={() => openLightbox(index)}
              >
                <img src={src} alt={`ORDERIX - ${index + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 size={24} className="text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precios" className="py-24 lg:py-32 relative scroll-mt-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="glass-card rounded-[3rem] p-8 lg:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[#FF6B00]/20 rounded-full blur-[100px] -z-10"></div>
            
            <div className="relative">
              <span className="inline-flex items-center gap-2 px-5 py-2 bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] font-mono text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-8">
                <Sparkles size={14} />
                PRECIOS SIMPLES
              </span>
              
              <h2 className="font-display font-black text-4xl sm:text-5xl lg:text-7xl tracking-tighter mb-8 leading-none uppercase">Sin sorpresas.</h2>
              
              <div className="glass rounded-[2.5rem] p-8 lg:p-10 max-w-md mx-auto border border-[#FF6B00]/20 shadow-2xl relative z-10">
                <div className="font-display font-black text-5xl sm:text-6xl lg:text-7xl text-[#FF6B00] mb-2 leading-none">$45.000</div>
                <div className="text-gray-400 font-black uppercase tracking-[0.4em] text-[10px] mb-8">pesos / mes</div>
                
                <ul className="space-y-4 text-left mb-10">
                  {['Pedidos ilimitados', 'Control de stock real', 'Menú con fotos', 'Métricas de venta', 'Multi-sucursal', 'Soporte prioritario'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300 font-bold uppercase tracking-tight text-[11px]">
                      <CheckCircle size={16} className="text-green-400" />
                      {item}
                    </li>
                  ))}
                </ul>

                <button onClick={openDemoModal} className="w-full py-5 bg-[#FF6B00] hover:bg-[#CC5500] text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-[#FF6B00]/20 border-0 cursor-pointer text-sm">
                  Empezar ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-left">
            <div className="flex items-center gap-4">
              <img src="/landing/img/icono.webp" alt="ORDERIX" className="w-14 h-14 rounded-2xl shadow-xl" />
              <span className="font-display font-black text-3xl tracking-tighter">ORDERIX</span>
            </div>
            
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">© 2026 ORDERIX. Córdoba, Argentina.</p>
          </div>
        </div>
      </footer>

      {/* Social Buttons - SHIELDED FROM INTERFERENCE */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-[100]">
        <a 
          href="https://www.instagram.com/orderixcba/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-14 h-14 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all group"
        >
          <Instagram size={24} className="text-white" />
          <span className="absolute right-full mr-4 px-4 py-2 glass rounded-xl text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl pointer-events-none">Instagram</span>
        </a>

        <button 
          onClick={openDemoModal}
          className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 hover:scale-110 transition-all group border-0 cursor-pointer"
        >
          <svg className="w-7 h-7 text-white fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          <span className="absolute right-full mr-4 px-4 py-2 glass rounded-xl text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl pointer-events-none">¿Hablamos?</span>
        </button>
      </div>

      {/* Demo Modal */}
      {isDemoModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeDemoModal}></div>
          <div className="relative glass-card rounded-[3rem] p-10 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh] animate-fadeUp">
            <button onClick={closeDemoModal} className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors cursor-pointer border-0 bg-transparent">
              <X size={24} />
            </button>
            
            {!formSuccess ? (
              <>
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-[#FF6B00]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles size={32} className="text-[#FF6B00]" />
                  </div>
                  <h2 className="font-display font-black text-3xl uppercase tracking-tighter">Solicitar Demo</h2>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2">Configuramos el sistema con vos en 24hs</p>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  {[
                    { name: 'nombre', label: 'Nombre Completo', type: 'text', placeholder: 'PABLO GARCIA' },
                    { name: 'email', label: 'Tu Email', type: 'email', placeholder: 'PABLO@HAMBURGER.COM' },
                    { name: 'telefono', label: 'WhatsApp', type: 'tel', placeholder: '+54 351 ...' },
                    { name: 'local', label: 'Nombre del Local', type: 'text', placeholder: 'LA BURGERIA' }
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">{field.label}</label>
                      <input 
                        required 
                        name={field.name}
                        type={field.type} 
                        placeholder={field.placeholder}
                        className="w-full h-14 bg-[#1c1c20] border border-white/5 rounded-2xl px-5 text-sm font-bold uppercase tracking-widest focus:outline-none focus:border-[#FF6B00]/50 transition-colors"
                      />
                    </div>
                  ))}
                  
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nº de Locales</label>
                    <select name="sucursales" required className="w-full h-14 bg-[#1c1c20] border border-white/5 rounded-2xl px-5 text-sm font-bold uppercase tracking-widest focus:outline-none focus:border-[#FF6B00]/50 transition-colors appearance-none">
                      <option value="1">1 LOCAL</option>
                      <option value="2-3">2-3 LOCALES</option>
                      <option value="4+">4 O MÁS</option>
                    </select>
                  </div>

                  <button type="submit" className="w-full py-5 bg-[#FF6B00] hover:bg-[#CC5500] text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[#FF6B00]/20 mt-6 flex items-center justify-center gap-2 border-0 cursor-pointer">
                    Enviar Solicitud
                    <ArrowRight size={20} />
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-20 animate-fadeUp">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-10">
                  <CheckCircle size={40} className="text-green-400" />
                </div>
                <h3 className="font-display font-black text-3xl uppercase tracking-tighter mb-4">¡Enviado!</h3>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Redirigiendo a WhatsApp...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-[400] bg-black/95 flex items-center justify-center p-4 backdrop-blur-xl cursor-default"
          onClick={closeLightbox}
        >
          <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors border-0 bg-transparent cursor-pointer"><X size={32} /></button>
          <button onClick={prevImage} className="absolute left-4 lg:left-10 text-white/50 hover:text-white transition-colors border-0 bg-transparent cursor-pointer"><ChevronLeft size={48} /></button>
          <button onClick={nextImage} className="absolute right-4 lg:right-10 text-white/50 hover:text-white transition-colors border-0 bg-transparent cursor-pointer"><ChevronRight size={48} /></button>
          
          <img 
            src={galleryImages[currentImageIndex]} 
            alt="Detalle ORDERIX"
            className="max-w-5xl w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10 p-2"
          />
        </div>
      )}
    </div>
  );
};

export default LandingPage;
