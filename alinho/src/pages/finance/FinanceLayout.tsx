import { NavLink, Outlet } from 'react-router-dom';
import { useData } from '../../state/DataProvider';
import { PageHeader } from '../../components/ui/primitives';

const TABS = [
  { to: '/financeiro', label: 'Visão geral', end: true },
  { to: '/financeiro/contratos', label: 'Contratos', end: false },
  { to: '/financeiro/pagamentos', label: 'Pagamentos', end: false },
  { to: '/financeiro/despesas', label: 'Despesas', end: false },
  { to: '/financeiro/historico', label: 'Histórico', end: false },
  { to: '/financeiro/relatorios', label: 'Relatórios', end: false },
];

/** Moldura do módulo financeiro: cabeçalho fixo e abas com URL própria. */
export function FinanceLayout() {
  const { dataset } = useData();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={dataset === 'demo' ? 'Demonstração' : 'Financeiro'}
        title="Controle financeiro"
        description="Contratos, recebimentos e despesas do estúdio, com valores calculados a partir dos lançamentos."
      />

      <nav
        aria-label="Seções do financeiro"
        className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0"
      >
        <ul className="flex min-w-max items-center gap-1 border-b border-line">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  [
                    'focus-ring -mb-px inline-flex items-center rounded-t-sm border-b-2 px-3 py-2 text-base font-medium transition-colors duration-150',
                    isActive
                      ? 'border-accent text-ink'
                      : 'border-transparent text-muted hover:text-ink',
                  ].join(' ')
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </div>
  );
}
