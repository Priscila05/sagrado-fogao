import { localRepositories } from './local';
import type { Repositories } from './types';

/**
 * Single access point for persistence. Swapping the local implementation for a
 * remote one later is a change in this file only.
 */
export const repositories: Repositories = localRepositories;

export type { Repositories } from './types';
