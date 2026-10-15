import { describe, expect, it } from 'vitest';
import {
  LOCAL_PERMISSIONS,
  displayName,
  permissionsFor,
  visibleMembers,
  type Profile,
} from './roles';

const profile = (partial: Partial<Profile> & { id: string; role: Profile['role'] }): Profile => ({
  orgId: 'org',
  email: `${partial.id}@empresa.com.br`,
  fullName: '',
  managerId: null,
  active: true,
  ...partial,
});

describe('permissões por papel', () => {
  it('somente o administrador acessa o financeiro', () => {
    expect(permissionsFor('admin').viewFinance).toBe(true);
    expect(permissionsFor('gerente').viewFinance).toBe(false);
    expect(permissionsFor('vendedor').viewFinance).toBe(false);
  });

  it('gerente supervisiona, mas não administra a empresa', () => {
    const gerente = permissionsFor('gerente');
    expect(gerente.viewTeam).toBe(true);
    expect(gerente.assignLeads).toBe(true);
    expect(gerente.manageTeam).toBe(false);
    expect(gerente.manageSettings).toBe(false);
    expect(gerente.importBackup).toBe(false);
    expect(gerente.eraseData).toBe(false);
  });

  it('vendedor não vê painel de equipe nem distribui leads', () => {
    const vendedor = permissionsFor('vendedor');
    expect(vendedor.viewTeam).toBe(false);
    expect(vendedor.assignLeads).toBe(false);
    expect(vendedor.viewFinance).toBe(false);
    expect(vendedor.exportBackup).toBe(false);
    expect(vendedor.eraseData).toBe(false);
  });

  it('modo local mantém o dono de tudo, sem painel de equipe', () => {
    expect(LOCAL_PERMISSIONS.viewFinance).toBe(true);
    expect(LOCAL_PERMISSIONS.manageSettings).toBe(true);
    expect(LOCAL_PERMISSIONS.exportBackup).toBe(true);
    expect(LOCAL_PERMISSIONS.viewTeam).toBe(false);
    expect(LOCAL_PERMISSIONS.assignLeads).toBe(false);
  });
});

describe('alcance de cada pessoa', () => {
  const admin = profile({ id: 'admin', role: 'admin' });
  const gerente = profile({ id: 'gerente', role: 'gerente' });
  const vendedorA = profile({ id: 'vendA', role: 'vendedor', managerId: 'gerente' });
  const vendedorB = profile({ id: 'vendB', role: 'vendedor', managerId: 'outro-gerente' });
  const equipe = [admin, gerente, vendedorA, vendedorB];

  it('admin enxerga toda a organização', () => {
    expect(visibleMembers(admin, equipe)).toHaveLength(4);
  });

  it('gerente enxerga a si mesmo e quem aponta para ele', () => {
    const visiveis = visibleMembers(gerente, equipe).map((member) => member.id);
    expect(visiveis).toEqual(['gerente', 'vendA']);
    expect(visiveis).not.toContain('vendB');
  });

  it('vendedor enxerga apenas a si mesmo', () => {
    expect(visibleMembers(vendedorA, equipe).map((m) => m.id)).toEqual(['vendA']);
  });

  it('usa o nome quando existe e o e-mail como reserva', () => {
    expect(displayName({ fullName: 'Ana Ribeiro', email: 'a@b.com' })).toBe('Ana Ribeiro');
    expect(displayName({ fullName: '   ', email: 'a@b.com' })).toBe('a@b.com');
  });
});
