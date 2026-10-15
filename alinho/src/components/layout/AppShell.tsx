import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, MoreHorizontal, Plus, Search } from 'lucide-react';
import { SidebarContent } from './Sidebar';
import { navItemsFor } from './navigation';
import { LogoMark } from '../../design/Logo';
import { Button } from '../ui/Button';
import { useData } from '../../state/DataProvider';
import { useAuth } from '../../auth/AuthProvider';
import { StorageNotice } from './StorageNotice';

/** Application frame: fixed sidebar on desktop, drawer + tab bar on mobile. */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { dataset } = useData();
  const { permissions } = useAuth();
  const mainRef = useRef<HTMLElement>(null);

  // Close the drawer and reset scroll whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const primaryItems = navItemsFor(permissions).filter((item) => item.primary);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <a
        href="#conteudo"
        className="focus-ring sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-raised focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop"
      >
        Ir para o conteúdo
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 animate-fade-in dark:bg-black/65"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] border-r border-line bg-surface shadow-modal animate-slide-in-right"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
          >
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={drawerOpen}
            className="focus-ring rounded-md p-2 text-muted hover:bg-sunken hover:text-ink"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <LogoMark className="h-[18px] w-[18px]" />
          <span className="text-sm font-semibold tracking-[0.12em] text-ink">ALINHO</span>
          {dataset === 'demo' ? (
            <span className="rounded-sm bg-caution-soft px-1.5 py-0.5 text-2xs font-semibold text-caution-ink">
              DEMO
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Buscar leads"
              onClick={() => navigate('/leads?focus=busca')}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="primary"
              size="icon"
              aria-label="Novo lead"
              onClick={() => navigate('/leads?novo=1')}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        <main
          id="conteudo"
          ref={mainRef}
          className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0"
          tabIndex={-1}
        >
          <StorageNotice />
          <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <Outlet />
          </div>
        </main>

        {/* Mobile tab bar */}
        <nav
          aria-label="Navegação rápida"
          className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-surface/95 backdrop-blur-sm lg:hidden"
        >
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'focus-ring flex flex-1 flex-col items-center gap-1 py-2.5 text-2xs font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-subtle',
                ].join(' ')
              }
            >
              <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {item.shortLabel}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="focus-ring flex flex-1 flex-col items-center gap-1 py-2.5 text-2xs font-medium text-subtle"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
            Mais
          </button>
        </nav>
      </div>
    </div>
  );
}
