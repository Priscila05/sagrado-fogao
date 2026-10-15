import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured, supabaseConfigIssue } from '../lib/supabaseClient';
import {
  LOCAL_PERMISSIONS,
  permissionsFor,
  visibleMembers,
  type Permissions,
  type Profile,
  type Role,
} from './roles';
import { createSupabaseRepositories, describeError } from '../repositories/supabase';
import { setActiveRepositories } from '../repositories';

export type AuthMode = 'local' | 'equipe';
type Status = 'carregando' | 'deslogado' | 'logado' | 'sem-perfil' | 'erro';

export interface AuthContextValue {
  mode: AuthMode;
  status: Status;
  error: string | null;
  /** Perfil do usuário autenticado. Nulo no modo local. */
  profile: Profile | null;
  /** Pessoas da organização que o usuário enxerga. Vazio no modo local. */
  team: Profile[];
  permissions: Permissions;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  updateProfileName: (fullName: string) => Promise<boolean>;
  updateMember: (
    id: string,
    patch: { role?: Role; managerId?: string | null; active?: boolean },
  ) => Promise<boolean>;
  refreshTeam: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface ProfileRow {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: Role;
  manager_id: string | null;
  active: boolean;
}

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  orgId: row.org_id,
  email: row.email ?? '',
  fullName: row.full_name ?? '',
  role: row.role,
  managerId: row.manager_id,
  active: row.active,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<Status>(configured ? 'carregando' : 'deslogado');
  const [error, setError] = useState<string | null>(supabaseConfigIssue());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;

  const loadProfile = useCallback(async (session: Session) => {
    const client = getSupabase();
    if (!client) return;
    const { data, error: profileError } = await client
      .from('profiles')
      .select('id, org_id, email, full_name, role, manager_id, active')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError) {
      setError(describeError(profileError));
      setStatus('erro');
      return;
    }
    if (!data) {
      // O usuário existe no Auth, mas ninguém criou o perfil dele.
      setError(
        'Seu usuário ainda não tem perfil nesta empresa. Peça ao administrador para liberar seu acesso.',
      );
      setStatus('sem-perfil');
      return;
    }

    const loaded = toProfile(data as ProfileRow);
    if (!loaded.active) {
      setError('Seu acesso foi desativado. Procure o administrador da empresa.');
      setStatus('sem-perfil');
      await client.auth.signOut();
      return;
    }

    setProfile(loaded);
    setError(null);
    // A partir daqui os dados vêm do banco compartilhado.
    setActiveRepositories(
      createSupabaseRepositories(() => ({
        client,
        orgId: loaded.orgId,
        userId: loaded.id,
      })),
    );
    setStatus('logado');

    const { data: members } = await client
      .from('profiles')
      .select('id, org_id, email, full_name, role, manager_id, active')
      .order('full_name');
    setTeam(((members ?? []) as ProfileRow[]).map(toProfile));
  }, []);

  useEffect(() => {
    if (!configured) {
      setStatus('deslogado');
      return undefined;
    }
    const client = getSupabase();
    if (!client) {
      setStatus('erro');
      return undefined;
    }

    let cancelled = false;

    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) void loadProfile(data.session);
      else setStatus('deslogado');
    });

    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null);
        setTeam([]);
        setActiveRepositories(null);
        setStatus('deslogado');
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (!profileRef.current || profileRef.current.id !== session.user.id) {
          void loadProfile(session);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [configured, loadProfile]);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const client = getSupabase();
    if (!client) return { ok: false, error: 'Supabase não configurado neste build.' };
    setError(null);
    const { error: signInError } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      const raw = signInError.message ?? '';
      const message = /invalid login credentials/i.test(raw)
        ? 'E-mail ou senha incorretos.'
        : /email not confirmed/i.test(raw)
          ? 'Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.'
          : /failed to fetch|network|load failed|timeout/i.test(raw)
            ? 'Não foi possível falar com o servidor da empresa. Verifique sua conexão e se o endereço do Supabase está correto.'
            : /rate limit|too many/i.test(raw)
              ? 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.'
              : raw;
      setError(message);
      return { ok: false, error: message };
    }
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabase();
    await client?.auth.signOut();
    setProfile(null);
    setTeam([]);
    setActiveRepositories(null);
    setStatus('deslogado');
  }, []);

  const sendPasswordReset = useCallback<AuthContextValue['sendPasswordReset']>(async (email) => {
    const client = getSupabase();
    if (!client) return { ok: false, error: 'Supabase não configurado neste build.' };
    const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    if (resetError) {
      const raw = resetError.message ?? '';
      return {
        ok: false,
        error: /failed to fetch|network|load failed/i.test(raw)
          ? 'Não foi possível falar com o servidor da empresa. Verifique sua conexão.'
          : raw,
      };
    }
    return { ok: true };
  }, []);

  const refreshTeam = useCallback(async () => {
    const client = getSupabase();
    if (!client || !profileRef.current) return;
    const { data } = await client
      .from('profiles')
      .select('id, org_id, email, full_name, role, manager_id, active')
      .order('full_name');
    setTeam(((data ?? []) as ProfileRow[]).map(toProfile));
  }, []);

  const updateProfileName = useCallback(
    async (fullName: string) => {
      const client = getSupabase();
      const current = profileRef.current;
      if (!client || !current) return false;
      const { error: updateError } = await client
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', current.id);
      if (updateError) {
        setError(describeError(updateError));
        return false;
      }
      setProfile({ ...current, fullName: fullName.trim() });
      await refreshTeam();
      return true;
    },
    [refreshTeam],
  );

  const updateMember = useCallback<AuthContextValue['updateMember']>(
    async (id, patch) => {
      const client = getSupabase();
      if (!client) return false;
      const payload: Record<string, unknown> = {};
      if (patch.role !== undefined) payload.role = patch.role;
      if (patch.managerId !== undefined) payload.manager_id = patch.managerId;
      if (patch.active !== undefined) payload.active = patch.active;
      if (Object.keys(payload).length === 0) return true;

      const { error: updateError } = await client.from('profiles').update(payload).eq('id', id);
      if (updateError) {
        setError(describeError(updateError));
        return false;
      }
      await refreshTeam();
      return true;
    },
    [refreshTeam],
  );

  const value = useMemo<AuthContextValue>(() => {
    const mode: AuthMode = configured ? 'equipe' : 'local';
    const permissions = profile ? permissionsFor(profile.role) : LOCAL_PERMISSIONS;
    return {
      mode,
      status,
      error,
      profile,
      team: profile ? visibleMembers(profile, team) : [],
      permissions: mode === 'local' ? LOCAL_PERMISSIONS : permissions,
      signIn,
      signOut,
      sendPasswordReset,
      updateProfileName,
      updateMember,
      refreshTeam,
    };
  }, [
    configured,
    status,
    error,
    profile,
    team,
    signIn,
    signOut,
    sendPasswordReset,
    updateProfileName,
    updateMember,
    refreshTeam,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}

/** Lista completa da organização (admin), já ordenada. */
export function useOrgMembers(): Profile[] {
  const { team } = useAuth();
  return team;
}
