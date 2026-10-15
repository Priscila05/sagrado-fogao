import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { OverviewPage } from './pages/OverviewPage';
import { LeadsPage } from './pages/LeadsPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { PipelinePage } from './pages/PipelinePage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { ReportsPage } from './pages/ReportsPage';
import { FinanceLayout } from './pages/finance/FinanceLayout';
import { FinanceOverviewPage } from './pages/finance/FinanceOverviewPage';
import { ContractsPage } from './pages/finance/ContractsPage';
import { PaymentsPage } from './pages/finance/PaymentsPage';
import { ExpensesPage } from './pages/finance/ExpensesPage';
import { FinanceHistoryPage } from './pages/finance/FinanceHistoryPage';
import { FinanceReportsPage } from './pages/finance/FinanceReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TeamPage } from './pages/TeamPage';
import { LoginPage } from './pages/LoginPage';
import { useData } from './state/DataProvider';
import { useAuth } from './auth/AuthProvider';
import type { Permissions } from './auth/roles';
import { LogoMark } from './design/Logo';
import { Button } from './components/ui/Button';

/** Blocking states: first load and a storage failure we cannot recover from. */
function BootScreen({ message }: { message: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <LogoMark className="h-7 w-7 animate-pulse" />
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

/**
 * Rota protegida: quem não tem a permissão é levado de volta à visão geral.
 * O banco recusaria os dados de qualquer forma; isto evita uma tela quebrada.
 */
function Require({
  permission,
  children,
}: {
  permission: keyof Permissions;
  children: ReactNode;
}) {
  const { permissions } = useAuth();
  if (!permissions[permission]) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const { status, error, actions } = useData();
  const auth = useAuth();

  // Modo equipe: nada é exibido antes do login.
  if (auth.mode === 'equipe') {
    if (auth.status === 'carregando') {
      return <BootScreen message="Verificando seu acesso…" />;
    }
    if (auth.status !== 'logado') {
      return <LoginPage />;
    }
  }

  if (status === 'loading') {
    return <BootScreen message="Carregando seus dados locais…" />;
  }

  if (status === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <LogoMark className="h-7 w-7" />
        <div className="max-w-md">
          <h1 className="text-lg font-semibold text-ink">Não foi possível abrir seus dados</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {error ??
              'O navegador recusou o acesso ao armazenamento local. Verifique as permissões do site.'}
          </p>
        </div>
        <Button variant="primary" onClick={() => void actions.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:leadId" element={<LeadDetailPage />} />
        <Route path="/funil" element={<PipelinePage />} />
        <Route path="/empresas" element={<CompaniesPage />} />
        <Route path="/empresas/:companyId" element={<CompanyDetailPage />} />
        <Route path="/atividades" element={<ActivitiesPage />} />
        <Route path="/relatorios" element={<ReportsPage />} />
        <Route
          path="/equipe"
          element={
            <Require permission="viewTeam">
              <TeamPage />
            </Require>
          }
        />
        <Route
          path="/financeiro"
          element={
            <Require permission="viewFinance">
              <FinanceLayout />
            </Require>
          }
        >
          <Route index element={<FinanceOverviewPage />} />
          <Route path="contratos" element={<ContractsPage />} />
          <Route path="pagamentos" element={<PaymentsPage />} />
          <Route path="despesas" element={<ExpensesPage />} />
          <Route path="historico" element={<FinanceHistoryPage />} />
          <Route path="relatorios" element={<FinanceReportsPage />} />
        </Route>
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
