import { NavLink } from 'react-router-dom';
import { Moon, Sun, X } from 'lucide-react';
import { LogoLockup } from '../../design/Logo';
import { NAV_ITEMS } from './navigation';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../state/DataProvider';
import { formatNumber } from '../../utils/format';
import { bucketActivities } from '../../services/metrics';

function NavBadge({ count, tone }: { count: number; tone: 'critical' | 'neutral' }) {
  if (count <= 0) return null;
  return (
    <span
      className={[
        'ml-auto min-w-[1.25rem] rounded-sm px-1 py-0.5 text-center text-2xs font-semibold tnum',
        tone === 'critical' ? 'bg-critical-soft text-critical-ink' : 'bg-sunken text-muted',
      ].join(' ')}
    >
      {formatNumber(count)}
    </span>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { resolved, toggle } = useTheme();
  const { leads, activities, dataset } = useData();
  const buckets = bucketActivities(activities);
  const pendingToday = buckets.overdue.length + buckets.today.length;

  const counts: Record<string, { value: number; tone: 'critical' | 'neutral' }> = {
    '/leads': { value: leads.length, tone: 'neutral' },
    '/atividades': { value: pendingToday, tone: buckets.overdue.length > 0 ? 'critical' : 'neutral' },
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <LogoLockup />
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Fechar menu"
            className="focus-ring rounded-md p-1.5 text-subtle hover:bg-sunken hover:text-ink lg:hidden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-2.5 py-2">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const badge = counts[item.to];
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    [
                      'focus-ring group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-base font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-sunken text-ink'
                        : 'text-muted hover:bg-sunken/70 hover:text-ink',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? 'text-accent' : 'text-subtle group-hover:text-muted'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                      {badge ? <NavBadge count={badge.value} tone={badge.tone} /> : null}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-line px-3 py-3">
        {dataset === 'demo' ? (
          <p className="mb-2.5 rounded-md bg-caution-soft px-2.5 py-2 text-2xs font-medium leading-relaxed text-caution-ink">
            Modo demonstração ativo. Os dados exibidos são fictícios.
          </p>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          className="focus-ring flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
          aria-label={resolved === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {resolved === 'dark' ? (
            <Sun className="h-4 w-4 text-subtle" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4 text-subtle" aria-hidden="true" />
          )}
          {resolved === 'dark' ? 'Modo claro' : 'Modo escuro'}
        </button>
        <p className="mt-2 px-2.5 text-2xs text-subtle">
          Dados salvos apenas neste navegador.
        </p>
      </div>
    </div>
  );
}
