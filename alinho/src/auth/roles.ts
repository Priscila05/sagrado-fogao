/**
 * Papéis e o que cada um pode fazer.
 *
 * O RLS no banco é quem realmente garante as regras; estas funções existem para
 * que a interface não ofereça caminhos que o banco vai recusar.
 */

export type Role = 'admin' | 'gerente' | 'vendedor';

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: 'Enxerga e edita tudo da empresa, inclusive o financeiro.',
  gerente: 'Supervisiona a própria equipe: leads, atividades e desempenho.',
  vendedor: 'Trabalha apenas com os leads e as atividades sob sua responsabilidade.',
};

export interface Permissions {
  /** Ver o módulo financeiro (contratos, pagamentos, despesas, relatórios). */
  viewFinance: boolean;
  /** Ver o painel de supervisão da equipe. */
  viewTeam: boolean;
  /** Distribuir leads entre as pessoas que enxerga. */
  assignLeads: boolean;
  /** Alterar papéis, equipes e as listas da empresa. */
  manageTeam: boolean;
  /** Alterar etapas, origens, segmentos e demais ajustes da organização. */
  manageSettings: boolean;
  /** Exportar backup completo dos dados. */
  exportBackup: boolean;
  /** Importar backup substituindo os dados. */
  importBackup: boolean;
  /** Apagar dados em massa. */
  eraseData: boolean;
}

/** Permissões no modo local (uma pessoa só, dona de tudo). */
export const LOCAL_PERMISSIONS: Permissions = {
  viewFinance: true,
  viewTeam: false,
  assignLeads: false,
  manageTeam: false,
  manageSettings: true,
  exportBackup: true,
  importBackup: true,
  eraseData: true,
};

export function permissionsFor(role: Role): Permissions {
  switch (role) {
    case 'admin':
      return {
        viewFinance: true,
        viewTeam: true,
        assignLeads: true,
        manageTeam: true,
        manageSettings: true,
        exportBackup: true,
        importBackup: true,
        eraseData: true,
      };
    case 'gerente':
      return {
        viewFinance: false,
        viewTeam: true,
        assignLeads: true,
        manageTeam: false,
        manageSettings: false,
        exportBackup: true,
        importBackup: false,
        eraseData: false,
      };
    case 'vendedor':
    default:
      return {
        viewFinance: false,
        viewTeam: false,
        assignLeads: false,
        manageTeam: false,
        manageSettings: false,
        exportBackup: false,
        importBackup: false,
        eraseData: false,
      };
  }
}

export interface Profile {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: Role;
  managerId: string | null;
  active: boolean;
}

/** Pessoas que o usuário enxerga — espelha `app_visible_user_ids()` no banco. */
export function visibleMembers(profile: Profile, team: Profile[]): Profile[] {
  if (profile.role === 'admin') return team;
  if (profile.role === 'gerente') {
    return team.filter((member) => member.id === profile.id || member.managerId === profile.id);
  }
  return team.filter((member) => member.id === profile.id);
}

export function displayName(profile: Pick<Profile, 'fullName' | 'email'>): string {
  return profile.fullName.trim() || profile.email;
}
