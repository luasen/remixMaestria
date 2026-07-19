import React from 'react';
import { Home, BookOpen, ShoppingBag, ShieldCheck } from 'lucide-react';
import { useApp, ActiveView } from '../contexts/AppContext';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils';

export default function BottomNav() {
  const { activeView, setActiveView } = useApp();
  const { totalItems } = useCart();
  const { profile } = useAuth();

  const isEmployee = profile?.role === 'admin' || profile?.role === 'superadmin';

  const navItems: { view: ActiveView; label: string; icon: React.ComponentType<any>; badge?: number }[] = [
    { view: 'home', label: 'Início', icon: Home },
    { view: 'menu', label: 'Cardápio', icon: BookOpen },
    { view: 'cart', label: 'Carrinho', icon: ShoppingBag, badge: totalItems },
    ...(isEmployee ? [{ view: 'admin' as const, label: 'Painel', icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/20 bg-white/35 pb-safe backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {navItems.map(({ view, label, icon: Icon, badge }) => {
          const isActive = activeView === view || (view === 'cart' && activeView === 'checkout');
          return (
            <button
              key={view}
              id={`nav-btn-${view}`}
              onClick={() => setActiveView(view)}
              className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
                  isActive
                    ? "bg-orange-500/15 text-orange-600 font-semibold border border-orange-500/20"
                    : "text-gray-400 hover:text-gray-600 hover:bg-white/30"
                )}
              >
                <Icon className="h-5 w-5" />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute top-1.5 right-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-orange-600 text-[9px] font-bold text-white ring-2 ring-white">
                    {badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium tracking-wide mt-0.5",
                  isActive ? "text-orange-600 font-semibold" : "text-gray-400"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
