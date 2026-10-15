import {
  BarChart3,
  Building2,
  CalendarCheck,
  LayoutDashboard,
  Settings as SettingsIcon,
  Users,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Shown in the mobile tab bar. */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Visão geral', shortLabel: 'Visão', icon: LayoutDashboard, primary: true },
  { to: '/leads', label: 'Leads', shortLabel: 'Leads', icon: Users, primary: true },
  { to: '/funil', label: 'Funil de vendas', shortLabel: 'Funil', icon: Workflow, primary: true },
  { to: '/empresas', label: 'Empresas e clientes', shortLabel: 'Empresas', icon: Building2, primary: false },
  { to: '/atividades', label: 'Atividades', shortLabel: 'Agenda', icon: CalendarCheck, primary: true },
  { to: '/relatorios', label: 'Relatórios', shortLabel: 'Relatórios', icon: BarChart3, primary: false },
  { to: '/configuracoes', label: 'Configurações', shortLabel: 'Ajustes', icon: SettingsIcon, primary: false },
];
