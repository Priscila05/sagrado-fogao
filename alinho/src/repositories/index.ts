import { localRepositories } from './local';
import type { Repositories } from './types';

/**
 * Ponto único de acesso à persistência.
 *
 * O aplicativo começa no modo local (IndexedDB) e troca para o Supabase quando
 * uma sessão autenticada é estabelecida. Páginas e serviços importam sempre
 * `repositories` e não sabem qual implementação está ativa.
 */

export type RepositoryMode = 'local' | 'equipe';

let active: Repositories = localRepositories;
let activeMode: RepositoryMode = 'local';

const listeners = new Set<(mode: RepositoryMode) => void>();

/** Troca a implementação ativa. Chamado pela camada de autenticação. */
export function setActiveRepositories(
  next: Repositories | null,
  mode: RepositoryMode = next ? 'equipe' : 'local',
): void {
  active = next ?? localRepositories;
  activeMode = next ? mode : 'local';
  for (const listener of listeners) listener(activeMode);
}

export function repositoryMode(): RepositoryMode {
  return activeMode;
}

/** Avisa quando a origem dos dados muda, para que o estado seja recarregado. */
export function onRepositoryModeChange(listener: (mode: RepositoryMode) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Delegação por proxy: a referência exportada nunca muda, mas sempre aponta
 * para a implementação ativa no momento da chamada.
 */
export const repositories: Repositories = new Proxy({} as Repositories, {
  get(_target, property) {
    return active[property as keyof Repositories];
  },
});

export { localRepositories };
export type { Repositories } from './types';
