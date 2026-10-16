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
import { repositories, onRepositoryModeChange } from '../repositories';
import { useAuth } from '../auth/AuthProvider';
import { backendKind } from '../db/backend';
import { createDefaultSettings } from '../models/defaults';
import type {
  Activity,
  Company,
  Dataset,
  Interaction,
  InteractionType,
  Lead,
  Settings,
  Stage,
} from '../models/types';
import { ACTIVITY_TYPE_LABEL } from '../models/types';
import {
  applyStageChange,
  buildActivity,
  buildCompany,
  buildInteraction,
  buildLead,
  firstStageId,
  stageName,
  type ActivityDraft,
  type CompanyDraft,
  type LeadDraft,
} from '../services/crm';
import type { Contract, Expense, Payment } from '../models/finance';
import {
  buildContract,
  buildExpense,
  buildPayment,
  syncContractSchedule,
  type ContractDraft,
  type ExpenseDraft,
  type PaymentDraft,
} from '../services/finance';
import { normalizeContract, normalizeExpense, normalizePayment } from '../models/normalize';
import { buildDemoDataset } from '../services/demo';
import { normalizeLead } from '../models/normalize';
import type { BackupPayload } from '../services/backup';
import { useToast } from '../components/ui/Toast';

type Status = 'loading' | 'ready' | 'error';

export interface DatasetCounts {
  leads: number;
  companies: number;
  activities: number;
  interactions: number;
  contracts: number;
  payments: number;
  expenses: number;
}

export interface DataContextValue {
  status: Status;
  /** De onde vêm os dados: navegador deste computador ou banco da empresa. */
  source: 'local' | 'equipe';
  error: string | null;
  /** Mensagem crua de quem recusou a leitura — o que diz POR QUE falhou. */
  errorDetail: string | null;
  storageMode: 'indexeddb' | 'memory' | 'unknown';
  settings: Settings;
  stages: Stage[];
  dataset: Dataset;
  /** Records of the active dataset only. */
  leads: Lead[];
  companies: Company[];
  activities: Activity[];
  interactions: Interaction[];
  contracts: Contract[];
  payments: Payment[];
  expenses: Expense[];
  counts: Record<Dataset, DatasetCounts>;
  /** True while a mutation is being written. */
  saving: boolean;
  actions: DataActions;
}

export interface DataActions {
  reload: () => Promise<void>;
  createLead: (draft: LeadDraft) => Promise<Lead | null>;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<Lead | null>;
  deleteLead: (id: string) => Promise<boolean>;
  changeLeadStage: (id: string, stageId: string) => Promise<boolean>;
  convertLeadToClient: (id: string) => Promise<boolean>;
  createCompany: (draft: CompanyDraft) => Promise<Company | null>;
  updateCompany: (id: string, patch: Partial<Company>) => Promise<Company | null>;
  deleteCompany: (id: string) => Promise<boolean>;
  linkLeadToCompany: (leadId: string, companyId: string | null) => Promise<boolean>;
  createCompanyFromLead: (leadId: string) => Promise<Company | null>;
  createActivity: (draft: ActivityDraft) => Promise<Activity | null>;
  updateActivity: (id: string, patch: Partial<Activity>) => Promise<Activity | null>;
  setActivityDone: (id: string, done: boolean) => Promise<boolean>;
  deleteActivity: (id: string) => Promise<boolean>;
  addInteraction: (draft: {
    leadId?: string | null;
    companyId?: string | null;
    type: InteractionType;
    description: string;
    occurredAt?: string | null;
  }) => Promise<Interaction | null>;
  deleteInteraction: (id: string) => Promise<boolean>;
  updateSettings: (patch: Partial<Settings>) => Promise<Settings | null>;
  /* ----------------------------------------------------------- financeiro -- */
  createContract: (draft: ContractDraft) => Promise<Contract | null>;
  updateContract: (id: string, patch: Partial<Contract>) => Promise<Contract | null>;
  deleteContract: (id: string) => Promise<boolean>;
  updatePayment: (id: string, patch: Partial<Payment>) => Promise<Payment | null>;
  setPaymentPaid: (
    id: string,
    paid: boolean,
    details?: { paidAmount?: number; paidAt?: string | null; method?: string },
  ) => Promise<Payment | null>;
  createPayment: (draft: PaymentDraft) => Promise<Payment | null>;
  deletePayment: (id: string) => Promise<boolean>;
  createExpense: (draft: ExpenseDraft) => Promise<Expense | null>;
  updateExpense: (id: string, patch: Partial<Expense>) => Promise<Expense | null>;
  deleteExpense: (id: string) => Promise<boolean>;
  importBackup: (payload: BackupPayload) => Promise<boolean>;
  importLeads: (drafts: Partial<Lead>[]) => Promise<number>;
  markBackupExported: () => Promise<void>;
  setDataset: (dataset: Dataset) => Promise<void>;
  seedDemo: () => Promise<boolean>;
  clearDemo: () => Promise<boolean>;
  eraseRealData: () => Promise<boolean>;
  /** Raw records of every dataset — used by the backup export. */
  snapshot: () => {
    leads: Lead[];
    companies: Company[];
    activities: Activity[];
    interactions: Interaction[];
    contracts: Contract[];
    payments: Payment[];
    expenses: Expense[];
    settings: Settings;
  };
}

const DataContext = createContext<DataContextValue | null>(null);

function sortStages(stages: Stage[]): Stage[] {
  return [...stages].sort((a, b) => a.order - b.order);
}

function countDataset(
  dataset: Dataset,
  rows: {
    leads: Lead[];
    companies: Company[];
    activities: Activity[];
    interactions: Interaction[];
    contracts: Contract[];
    payments: Payment[];
    expenses: Expense[];
  },
): DatasetCounts {
  const count = <T extends { dataset: Dataset }>(list: T[]) =>
    list.filter((row) => row.dataset === dataset).length;
  return {
    leads: count(rows.leads),
    companies: count(rows.companies),
    activities: count(rows.activities),
    interactions: count(rows.interactions),
    contracts: count(rows.contracts),
    payments: count(rows.payments),
    expenses: count(rows.expenses),
  };
}

/**
 * Texto técnico do que recusou a leitura. Um erro do banco da empresa carrega
 * a resposta crua do PostgREST em `detalhe`; o banco local do navegador traz o
 * nome do erro do IndexedDB (NotFoundError, VersionError e afins).
 */
function detalharCausa(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'detalhe' in cause) {
    return String((cause as { detalhe: unknown }).detalhe);
  }
  if (cause instanceof Error) {
    return cause.name && cause.name !== 'Error' ? `${cause.name}: ${cause.message}` : cause.message;
  }
  return String(cause);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { mode, status: authStatus, profile } = useAuth();
  const isTeam = mode === 'equipe';
  // `load` é estável (sem dependências) para não recarregar a cada render; o
  // ref deixa o modo atual visível lá dentro sem recriá-la.
  const isTeamRef = useRef(isTeam);
  isTeamRef.current = isTeam;

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => createDefaultSettings());
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [allInteractions, setAllInteractions] = useState<Interaction[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);

  // Kept in a ref so actions can read current data without re-creating callbacks.
  const dataRef = useRef({
    settings,
    leads: allLeads,
    companies: allCompanies,
    activities: allActivities,
    interactions: allInteractions,
    contracts: allContracts,
    payments: allPayments,
    expenses: allExpenses,
  });
  dataRef.current = {
    settings,
    leads: allLeads,
    companies: allCompanies,
    activities: allActivities,
    interactions: allInteractions,
    contracts: allContracts,
    payments: allPayments,
    expenses: allExpenses,
  };

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [storedSettings, leads, companies, activities, interactions, contracts, payments, expenses] =
        await Promise.all([
          repositories.settings.read(),
          repositories.leads.list(),
          repositories.companies.list(),
          repositories.activities.list(),
          repositories.interactions.list(),
          repositories.contracts.list(),
          repositories.payments.list(),
          repositories.expenses.list(),
        ]);
      setSettings(storedSettings);
      setAllLeads(leads);
      setAllCompanies(companies);
      setAllActivities(activities);
      setAllInteractions(interactions);
      setAllContracts(contracts);
      setAllPayments(payments);
      setAllExpenses(expenses);
      setError(null);
      setErrorDetail(null);
      setStatus('ready');
    } catch (cause) {
      console.error('[alinho] falha ao carregar os dados', cause);
      setError(
        isTeamRef.current
          ? 'Não foi possível carregar os dados da empresa. O login funcionou, mas o banco recusou a leitura.'
          : 'Não foi possível abrir o banco de dados local do navegador. Verifique se o armazenamento do site está liberado.',
      );
      // O motivo técnico vai para a tela, não só para o console: é ele que
      // diz o que corrigir, e nem todo mundo consegue abrir o console.
      setErrorDetail(detalharCausa(cause));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // No modo equipe só há dados depois do login; antes disso não há o que ler.
    if (isTeam && authStatus !== 'logado') {
      setStatus(authStatus === 'carregando' ? 'loading' : 'ready');
      return;
    }
    void load();
  }, [load, isTeam, authStatus]);

  // Trocar entre banco local e banco da empresa recarrega tudo.
  useEffect(() => onRepositoryModeChange(() => void load()), [load]);

  /** Wraps a mutation with the saving flag and a user-visible error toast. */
  const run = useCallback(
    async <T,>(label: string, operation: () => Promise<T>): Promise<T | null> => {
      setSaving(true);
      try {
        return await operation();
      } catch (cause) {
        console.error(`[alinho] ${label}`, cause);
        toast.error(
          'Não foi possível salvar',
          'O navegador recusou a gravação. Exporte um backup e verifique o espaço de armazenamento.',
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  const dataset = settings.activeDataset;
  const stages = useMemo(() => sortStages(settings.stages), [settings.stages]);

  /* ----------------------------------------------------------- interactions --- */

  const logInteraction = useCallback(
    async (draft: {
      leadId?: string | null;
      companyId?: string | null;
      authorId?: string | null;
      type: InteractionType;
      description: string;
      occurredAt?: string | null;
      automatic?: boolean;
    }): Promise<Interaction> => {
      const activeDataset = dataRef.current.settings.activeDataset;
      const record = buildInteraction({ authorId: profile?.id ?? null, ...draft }, activeDataset);
      const saved = await repositories.interactions.save(record);
      setAllInteractions((current) => [...current, saved]);
      return saved;
    },
    [],
  );

  /* ------------------------------------------------------------------ leads --- */

  const createLead = useCallback<DataActions['createLead']>(
    (draft) =>
      run('createLead', async () => {
        const current = dataRef.current;
        const lead = buildLead(
          // Quem cadastra passa a ser o responsável, a menos que a distribuição
          // já tenha indicado outra pessoa.
          { ownerId: profile?.id ?? null, ...draft },
          current.settings.activeDataset,
          firstStageId(current.settings.stages),
        );
        const saved = await repositories.leads.save(lead);
        setAllLeads((rows) => [...rows, saved]);
        await logInteraction({
          leadId: saved.id,
          companyId: saved.companyId,
          type: 'sistema',
          description: `Lead criado na etapa "${stageName(current.settings.stages, saved.stageId)}".`,
          occurredAt: saved.createdAt,
          automatic: true,
        });
        toast.success('Lead cadastrado');
        return saved;
      }),
    [run, logInteraction, toast, profile],
  );

  const updateLead = useCallback<DataActions['updateLead']>(
    (id, patch) =>
      run('updateLead', async () => {
        const current = dataRef.current;
        const existing = current.leads.find((lead) => lead.id === id);
        if (!existing) return null;

        const stageChanged = patch.stageId !== undefined && patch.stageId !== existing.stageId;
        let next: Lead = normalizeLead({
          ...existing,
          ...patch,
          id: existing.id,
          dataset: existing.dataset,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        });
        if (stageChanged) {
          next = applyStageChange(next, current.settings.stages, next.stageId);
        }

        const saved = await repositories.leads.save(next);
        setAllLeads((rows) => rows.map((lead) => (lead.id === saved.id ? saved : lead)));

        if (stageChanged) {
          await logInteraction({
            leadId: saved.id,
            companyId: saved.companyId,
            type: 'sistema',
            description: `Etapa alterada de "${stageName(
              current.settings.stages,
              existing.stageId,
            )}" para "${stageName(current.settings.stages, saved.stageId)}".`,
            automatic: true,
          });
        }
        return saved;
      }),
    [run, logInteraction],
  );

  const deleteLead = useCallback<DataActions['deleteLead']>(
    async (id) => {
      const result = await run('deleteLead', async () => {
        const current = dataRef.current;
        const relatedActivities = current.activities.filter((activity) => activity.leadId === id);
        const relatedInteractions = current.interactions.filter(
          (interaction) => interaction.leadId === id,
        );
        await repositories.activities.removeMany(relatedActivities.map((row) => row.id));
        await repositories.interactions.removeMany(relatedInteractions.map((row) => row.id));
        await repositories.leads.remove(id);
        setAllActivities((rows) => rows.filter((row) => row.leadId !== id));
        setAllInteractions((rows) => rows.filter((row) => row.leadId !== id));
        setAllLeads((rows) => rows.filter((row) => row.id !== id));
        toast.success('Lead excluído', 'As atividades e o histórico vinculados também foram removidos.');
        return true;
      });
      return result ?? false;
    },
    [run, toast],
  );

  const changeLeadStage = useCallback<DataActions['changeLeadStage']>(
    async (id, stageId) => {
      const saved = await updateLead(id, { stageId });
      if (saved) {
        toast.success('Etapa atualizada', stageName(dataRef.current.settings.stages, stageId));
        return true;
      }
      return false;
    },
    [updateLead, toast],
  );

  /* -------------------------------------------------------------- companies --- */

  const createCompany = useCallback<DataActions['createCompany']>(
    (draft) =>
      run('createCompany', async () => {
        const company = buildCompany(
          { ownerId: profile?.id ?? null, ...draft },
          dataRef.current.settings.activeDataset,
        );
        const saved = await repositories.companies.save(company);
        setAllCompanies((rows) => [...rows, saved]);
        toast.success('Empresa cadastrada');
        return saved;
      }),
    [run, toast, profile],
  );

  const updateCompany = useCallback<DataActions['updateCompany']>(
    (id, patch) =>
      run('updateCompany', async () => {
        const existing = dataRef.current.companies.find((company) => company.id === id);
        if (!existing) return null;
        const saved = await repositories.companies.save({
          ...existing,
          ...patch,
          id: existing.id,
          dataset: existing.dataset,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        });
        setAllCompanies((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
        return saved;
      }),
    [run],
  );

  const deleteCompany = useCallback<DataActions['deleteCompany']>(
    async (id) => {
      const result = await run('deleteCompany', async () => {
        const current = dataRef.current;
        const linkedLeads = current.leads.filter((lead) => lead.companyId === id);
        for (const lead of linkedLeads) {
          const saved = await repositories.leads.save({
            ...lead,
            companyId: null,
            updatedAt: new Date().toISOString(),
          });
          setAllLeads((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
        }
        const linkedActivities = current.activities.filter(
          (activity) => activity.companyId === id && !activity.leadId,
        );
        await repositories.activities.removeMany(linkedActivities.map((row) => row.id));
        setAllActivities((rows) =>
          rows.filter((row) => !(row.companyId === id && !row.leadId)),
        );
        await repositories.companies.remove(id);
        setAllCompanies((rows) => rows.filter((row) => row.id !== id));
        toast.success(
          'Empresa excluída',
          linkedLeads.length > 0
            ? `${linkedLeads.length} lead(s) continuaram cadastrados, agora sem empresa vinculada.`
            : undefined,
        );
        return true;
      });
      return result ?? false;
    },
    [run, toast],
  );

  const linkLeadToCompany = useCallback<DataActions['linkLeadToCompany']>(
    async (leadId, companyId) => {
      const saved = await updateLead(leadId, { companyId });
      if (!saved) return false;
      if (companyId) {
        const company = dataRef.current.companies.find((row) => row.id === companyId);
        await logInteraction({
          leadId,
          companyId,
          type: 'sistema',
          description: `Lead vinculado à empresa "${company?.name ?? 'empresa'}".`,
          automatic: true,
        });
        toast.success('Empresa vinculada');
      } else {
        toast.success('Vínculo removido');
      }
      return true;
    },
    [updateLead, logInteraction, toast],
  );

  const createCompanyFromLead = useCallback<DataActions['createCompanyFromLead']>(
    (leadId) =>
      run('createCompanyFromLead', async () => {
        const current = dataRef.current;
        const lead = current.leads.find((row) => row.id === leadId);
        if (!lead) return null;
        const company = buildCompany(
          {
            // A empresa nasce com o mesmo responsável do lead que a originou.
            ownerId: lead.ownerId ?? profile?.id ?? null,
            name: lead.establishmentName || lead.contactName,
            segment: lead.segment,
            phone: lead.phone,
            whatsapp: lead.whatsapp,
            email: lead.email,
            neighborhood: lead.neighborhood,
            city: lead.city,
            instagram: lead.instagram,
            website: lead.website,
            status: 'prospect',
          },
          current.settings.activeDataset,
        );
        const savedCompany = await repositories.companies.save(company);
        setAllCompanies((rows) => [...rows, savedCompany]);

        const savedLead = await repositories.leads.save({
          ...lead,
          companyId: savedCompany.id,
          updatedAt: new Date().toISOString(),
        });
        setAllLeads((rows) => rows.map((row) => (row.id === savedLead.id ? savedLead : row)));

        await logInteraction({
          leadId,
          companyId: savedCompany.id,
          type: 'sistema',
          description: `Empresa "${savedCompany.name}" criada a partir deste lead.`,
          automatic: true,
        });
        toast.success('Empresa criada e vinculada');
        return savedCompany;
      }),
    [run, logInteraction, toast, profile],
  );

  const convertLeadToClient = useCallback<DataActions['convertLeadToClient']>(
    async (leadId) => {
      const result = await run('convertLeadToClient', async () => {
        const current = dataRef.current;
        const lead = current.leads.find((row) => row.id === leadId);
        if (!lead) return false;

        let companyId = lead.companyId;
        if (companyId) {
          const company = current.companies.find((row) => row.id === companyId);
          if (company) {
            const saved = await repositories.companies.save({
              ...company,
              status: 'cliente',
              updatedAt: new Date().toISOString(),
            });
            setAllCompanies((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
          }
        } else {
          const company = buildCompany(
            {
              ownerId: lead.ownerId ?? profile?.id ?? null,
              name: lead.establishmentName || lead.contactName,
              segment: lead.segment,
              phone: lead.phone,
              whatsapp: lead.whatsapp,
              email: lead.email,
              neighborhood: lead.neighborhood,
              city: lead.city,
              instagram: lead.instagram,
              website: lead.website,
              status: 'cliente',
            },
            current.settings.activeDataset,
          );
          const saved = await repositories.companies.save(company);
          setAllCompanies((rows) => [...rows, saved]);
          companyId = saved.id;
        }

        const savedLead = await repositories.leads.save({
          ...lead,
          companyId,
          updatedAt: new Date().toISOString(),
        });
        setAllLeads((rows) => rows.map((row) => (row.id === savedLead.id ? savedLead : row)));

        await logInteraction({
          leadId,
          companyId,
          type: 'sistema',
          description: 'Estabelecimento convertido em cliente. O histórico comercial foi mantido.',
          automatic: true,
        });
        toast.success('Convertido em cliente', 'O histórico do lead foi preservado.');
        return true;
      });
      return result ?? false;
    },
    [run, logInteraction, toast, profile],
  );

  /* ------------------------------------------------------------- activities --- */

  const createActivity = useCallback<DataActions['createActivity']>(
    (draft) =>
      run('createActivity', async () => {
        const activity = buildActivity(
          { ownerId: profile?.id ?? null, ...draft },
          dataRef.current.settings.activeDataset,
        );
        const saved = await repositories.activities.save(activity);
        setAllActivities((rows) => [...rows, saved]);
        toast.success('Atividade criada');
        return saved;
      }),
    [run, toast, profile],
  );

  const updateActivity = useCallback<DataActions['updateActivity']>(
    (id, patch) =>
      run('updateActivity', async () => {
        const existing = dataRef.current.activities.find((activity) => activity.id === id);
        if (!existing) return null;
        const saved = await repositories.activities.save({
          ...existing,
          ...patch,
          id: existing.id,
          dataset: existing.dataset,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        });
        setAllActivities((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
        return saved;
      }),
    [run],
  );

  const setActivityDone = useCallback<DataActions['setActivityDone']>(
    async (id, done) => {
      const existing = dataRef.current.activities.find((activity) => activity.id === id);
      if (!existing) return false;
      const now = new Date().toISOString();
      const saved = await updateActivity(id, { done, doneAt: done ? now : null });
      if (!saved) return false;

      if (done && saved.leadId) {
        await logInteraction({
          leadId: saved.leadId,
          companyId: saved.companyId,
          type: 'sistema',
          description: `Atividade concluída — ${ACTIVITY_TYPE_LABEL[saved.type]}: ${saved.title}`,
          automatic: true,
        });
        const lead = dataRef.current.leads.find((row) => row.id === saved.leadId);
        if (lead) {
          const updated = await repositories.leads.save({
            ...lead,
            lastInteractionAt: now,
            updatedAt: now,
          });
          setAllLeads((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
        }
      }
      toast.success(done ? 'Atividade concluída' : 'Atividade reaberta');
      return true;
    },
    [updateActivity, logInteraction, toast],
  );

  const deleteActivity = useCallback<DataActions['deleteActivity']>(
    async (id) => {
      const result = await run('deleteActivity', async () => {
        await repositories.activities.remove(id);
        setAllActivities((rows) => rows.filter((row) => row.id !== id));
        toast.success('Atividade excluída');
        return true;
      });
      return result ?? false;
    },
    [run, toast],
  );

  /* ------------------------------------------------------------ interaction --- */

  const addInteraction = useCallback<DataActions['addInteraction']>(
    (draft) =>
      run('addInteraction', async () => {
        const saved = await logInteraction({ ...draft, automatic: false });
        if (saved.leadId) {
          const lead = dataRef.current.leads.find((row) => row.id === saved.leadId);
          if (lead) {
            const now = new Date().toISOString();
            const updated = await repositories.leads.save({
              ...lead,
              lastInteractionAt: saved.occurredAt,
              updatedAt: now,
            });
            setAllLeads((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
          }
        }
        toast.success('Interação registrada');
        return saved;
      }),
    [run, logInteraction, toast],
  );

  const deleteInteraction = useCallback<DataActions['deleteInteraction']>(
    async (id) => {
      const result = await run('deleteInteraction', async () => {
        await repositories.interactions.remove(id);
        setAllInteractions((rows) => rows.filter((row) => row.id !== id));
        return true;
      });
      return result ?? false;
    },
    [run],
  );

  /* --------------------------------------------------------------- settings --- */

  const updateSettings = useCallback<DataActions['updateSettings']>(
    (patch) =>
      run('updateSettings', async () => {
        const next = await repositories.settings.write({ ...dataRef.current.settings, ...patch });
        setSettings(next);
        return next;
      }),
    [run],
  );

  const markBackupExported = useCallback(async () => {
    await updateSettings({ lastBackupAt: new Date().toISOString() });
  }, [updateSettings]);

  const setDataset = useCallback(
    async (next: Dataset) => {
      await updateSettings({ activeDataset: next });
    },
    [updateSettings],
  );


  /* ------------------------------------------------------------ financeiro --- */

  /**
   * Grava a agenda reconciliada de um contrato. A reconciliação acontece em
   * `syncContractSchedule`: parcelas são identificadas pela posição na agenda,
   * então salvar o mesmo contrato duas vezes nunca duplica lançamentos.
   */
  const persistSchedule = useCallback(
    async (contract: Contract, existing: Payment[]) => {
      const result = syncContractSchedule(contract, existing);
      if (result.removed.length > 0) {
        await repositories.payments.removeMany(result.removed.map((row) => row.id));
      }
      const written = await repositories.payments.saveMany([...result.created, ...result.updated]);
      const removedIds = new Set(result.removed.map((row) => row.id));
      const writtenById = new Map(written.map((row) => [row.id, row]));
      setAllPayments((rows) => {
        const next = rows
          .filter((row) => !removedIds.has(row.id))
          .map((row) => writtenById.get(row.id) ?? row);
        const existingIds = new Set(next.map((row) => row.id));
        return [...next, ...written.filter((row) => !existingIds.has(row.id))];
      });
      return result;
    },
    [],
  );

  const createContract = useCallback<DataActions['createContract']>(
    (draft) =>
      run('createContract', async () => {
        const current = dataRef.current;
        const contract = buildContract(draft, current.settings.activeDataset);
        const saved = await repositories.contracts.save(contract);
        setAllContracts((rows) => [...rows, saved]);
        await persistSchedule(saved, []);
        toast.success('Contrato cadastrado', 'A agenda de pagamentos foi gerada.');
        return saved;
      }),
    [run, persistSchedule, toast],
  );

  const updateContract = useCallback<DataActions['updateContract']>(
    (id, patch) =>
      run('updateContract', async () => {
        const current = dataRef.current;
        const existing = current.contracts.find((contract) => contract.id === id);
        if (!existing) return null;
        const saved = await repositories.contracts.save(
          normalizeContract({
            ...existing,
            ...patch,
            id: existing.id,
            dataset: existing.dataset,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
          }),
        );
        setAllContracts((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
        const own = current.payments.filter((payment) => payment.contractId === saved.id);
        const result = await persistSchedule(saved, own);
        toast.success(
          'Contrato atualizado',
          result.kept.some((payment) => payment.status === 'pago')
            ? 'Parcelas já pagas foram preservadas; apenas as em aberto foram recalculadas.'
            : undefined,
        );
        return saved;
      }),
    [run, persistSchedule, toast],
  );

  const deleteContract = useCallback<DataActions['deleteContract']>(
    async (id) => {
      const result = await run('deleteContract', async () => {
        const current = dataRef.current;
        const own = current.payments.filter((payment) => payment.contractId === id);
        await repositories.payments.removeMany(own.map((row) => row.id));
        setAllPayments((rows) => rows.filter((row) => row.contractId !== id));

        // Despesas são custos reais: perdem o vínculo, mas nunca somem.
        const linkedExpenses = current.expenses.filter((expense) => expense.contractId === id);
        for (const expense of linkedExpenses) {
          const saved = await repositories.expenses.save({
            ...expense,
            contractId: null,
            updatedAt: new Date().toISOString(),
          });
          setAllExpenses((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
        }

        await repositories.contracts.remove(id);
        setAllContracts((rows) => rows.filter((row) => row.id !== id));
        toast.success(
          'Contrato excluído',
          linkedExpenses.length > 0
            ? `${linkedExpenses.length} despesa(s) foram mantidas, agora sem projeto vinculado.`
            : 'A agenda de pagamentos foi removida junto.',
        );
        return true;
      });
      return result ?? false;
    },
    [run, toast],
  );

  const updatePayment = useCallback<DataActions['updatePayment']>(
    (id, patch) =>
      run('updatePayment', async () => {
        const existing = dataRef.current.payments.find((payment) => payment.id === id);
        if (!existing) return null;
        const saved = await repositories.payments.save(
          normalizePayment({
            ...existing,
            ...patch,
            id: existing.id,
            dataset: existing.dataset,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
          }),
        );
        setAllPayments((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
        return saved;
      }),
    [run],
  );

  const setPaymentPaid = useCallback<DataActions['setPaymentPaid']>(
    async (id, paid, details) => {
      const existing = dataRef.current.payments.find((payment) => payment.id === id);
      if (!existing) return null;
      const saved = await updatePayment(id, {
        status: paid ? 'pago' : 'pendente',
        // Sem valor informado, considera-se que entrou exatamente o previsto.
        paidAmount: paid ? details?.paidAmount ?? existing.amount : 0,
        paidAt: paid ? details?.paidAt ?? new Date().toISOString() : null,
        method: details?.method ?? existing.method,
      });
      if (saved) {
        toast.success(
          paid ? 'Pagamento registrado' : 'Pagamento reaberto',
          paid ? 'O valor entrou no total recebido.' : 'O valor saiu do total recebido.',
        );
      }
      return saved;
    },
    [updatePayment, toast],
  );

  const createPayment = useCallback<DataActions['createPayment']>(
    (draft) =>
      run('createPayment', async () => {
        const current = dataRef.current;
        // Lançamento extra: entra como avulso para não colidir com a agenda.
        const siblings = current.payments.filter(
          (payment) => draft.contractId && payment.contractId === draft.contractId,
        );
        const nextSequence =
          siblings.length > 0 ? Math.max(...siblings.map((payment) => payment.sequence)) + 1 : 1;
        const payment = buildPayment(
          {
            ...draft,
            kind: draft.kind ?? 'avulso',
            sequence: draft.sequence ?? nextSequence,
            label: draft.label || 'Lançamento avulso',
          },
          current.settings.activeDataset,
        );
        const saved = await repositories.payments.save(payment);
        setAllPayments((rows) => [...rows, saved]);
        toast.success('Lançamento criado');
        return saved;
      }),
    [run, toast],
  );

  const deletePayment = useCallback<DataActions['deletePayment']>(
    async (id) => {
      const result = await run('deletePayment', async () => {
        await repositories.payments.remove(id);
        setAllPayments((rows) => rows.filter((row) => row.id !== id));
        toast.success('Lançamento excluído');
        return true;
      });
      return result ?? false;
    },
    [run, toast],
  );

  const createExpense = useCallback<DataActions['createExpense']>(
    (draft) =>
      run('createExpense', async () => {
        const expense = buildExpense(draft, dataRef.current.settings.activeDataset);
        const saved = await repositories.expenses.save(expense);
        setAllExpenses((rows) => [...rows, saved]);
        toast.success('Despesa registrada');
        return saved;
      }),
    [run, toast],
  );

  const updateExpense = useCallback<DataActions['updateExpense']>(
    (id, patch) =>
      run('updateExpense', async () => {
        const existing = dataRef.current.expenses.find((expense) => expense.id === id);
        if (!existing) return null;
        const saved = await repositories.expenses.save(
          normalizeExpense({
            ...existing,
            ...patch,
            id: existing.id,
            dataset: existing.dataset,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
          }),
        );
        setAllExpenses((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
        return saved;
      }),
    [run],
  );

  const deleteExpense = useCallback<DataActions['deleteExpense']>(
    async (id) => {
      const result = await run('deleteExpense', async () => {
        await repositories.expenses.remove(id);
        setAllExpenses((rows) => rows.filter((row) => row.id !== id));
        toast.success('Despesa excluída');
        return true;
      });
      return result ?? false;
    },
    [run, toast],
  );

  /* ----------------------------------------------------------------- import --- */


  const importBackup = useCallback<DataActions['importBackup']>(
    async (payload) => {
      const result = await run('importBackup', async () => {
        await repositories.replaceAll(payload);
        await load();
        toast.success('Backup importado', 'Os dados do arquivo substituíram o conteúdo anterior.');
        return true;
      });
      return result ?? false;
    },
    [run, load, toast],
  );

  const importLeads = useCallback<DataActions['importLeads']>(
    async (drafts) => {
      const result = await run('importLeads', async () => {
        const current = dataRef.current;
        const fallbackStage = firstStageId(current.settings.stages);
        const records = drafts.map((draft) =>
          buildLead(draft, current.settings.activeDataset, fallbackStage),
        );
        const saved = await repositories.leads.saveMany(records);
        const logs = saved.map((lead) =>
          buildInteraction(
            {
              leadId: lead.id,
              companyId: lead.companyId,
              type: 'sistema',
              description: 'Lead importado de arquivo CSV.',
              occurredAt: lead.createdAt,
              automatic: true,
            },
            current.settings.activeDataset,
          ),
        );
        const savedLogs = await repositories.interactions.saveMany(logs);
        setAllLeads((rows) => [...rows, ...saved]);
        setAllInteractions((rows) => [...rows, ...savedLogs]);
        return saved.length;
      });
      return result ?? 0;
    },
    [run],
  );

  /* -------------------------------------------------------------- demo data --- */

  const seedDemo = useCallback<DataActions['seedDemo']>(
    async () => {
      if (isTeam) {
        toast.error(
          'Indisponível no modo equipe',
          'Os dados de demonstração existem apenas no modo local, para não poluir o banco da empresa.',
        );
        return false;
      }
      const result = await run('seedDemo', async () => {
        const current = dataRef.current;
        // Replace any previous demo records so the demo never accumulates.
        await repositories.clearDataset('demo');
        const demo = buildDemoDataset(current.settings.stages);
        await repositories.companies.saveMany(demo.companies);
        await repositories.leads.saveMany(demo.leads);
        await repositories.activities.saveMany(demo.activities);
        await repositories.interactions.saveMany(demo.interactions);
        const nextSettings = await repositories.settings.write({
          ...current.settings,
          demoSeeded: true,
          activeDataset: 'demo',
        });
        setSettings(nextSettings);
        setAllCompanies((rows) => [...rows.filter((r) => r.dataset !== 'demo'), ...demo.companies]);
        setAllLeads((rows) => [...rows.filter((r) => r.dataset !== 'demo'), ...demo.leads]);
        setAllActivities((rows) => [...rows.filter((r) => r.dataset !== 'demo'), ...demo.activities]);
        setAllInteractions((rows) => [
          ...rows.filter((r) => r.dataset !== 'demo'),
          ...demo.interactions,
        ]);
        await repositories.contracts.saveMany(demo.contracts);
        await repositories.payments.saveMany(demo.payments);
        await repositories.expenses.saveMany(demo.expenses);
        setAllContracts((rows) => [...rows.filter((r) => r.dataset !== 'demo'), ...demo.contracts]);
        setAllPayments((rows) => [...rows.filter((r) => r.dataset !== 'demo'), ...demo.payments]);
        setAllExpenses((rows) => [...rows.filter((r) => r.dataset !== 'demo'), ...demo.expenses]);
        toast.success('Demonstração carregada', 'Os dados reais continuam separados e intactos.');
        return true;
      });
      return result ?? false;
    },
    [run, toast],
  );

  const clearDemo = useCallback<DataActions['clearDemo']>(
    async () => {
      const result = await run('clearDemo', async () => {
        await repositories.clearDataset('demo');
        const nextSettings = await repositories.settings.write({
          ...dataRef.current.settings,
          demoSeeded: false,
          activeDataset: 'real',
        });
        setSettings(nextSettings);
        setAllLeads((rows) => rows.filter((row) => row.dataset !== 'demo'));
        setAllCompanies((rows) => rows.filter((row) => row.dataset !== 'demo'));
        setAllActivities((rows) => rows.filter((row) => row.dataset !== 'demo'));
        setAllInteractions((rows) => rows.filter((row) => row.dataset !== 'demo'));
        setAllContracts((rows) => rows.filter((row) => row.dataset !== 'demo'));
        setAllPayments((rows) => rows.filter((row) => row.dataset !== 'demo'));
        setAllExpenses((rows) => rows.filter((row) => row.dataset !== 'demo'));
        toast.success('Dados de demonstração removidos');
        return true;
      });
      return result ?? false;
    },
    [run, toast],
  );

  const eraseRealData = useCallback<DataActions['eraseRealData']>(
    async () => {
      const result = await run('eraseRealData', async () => {
        await repositories.clearDataset('real');
        setAllLeads((rows) => rows.filter((row) => row.dataset !== 'real'));
        setAllCompanies((rows) => rows.filter((row) => row.dataset !== 'real'));
        setAllActivities((rows) => rows.filter((row) => row.dataset !== 'real'));
        setAllInteractions((rows) => rows.filter((row) => row.dataset !== 'real'));
        setAllContracts((rows) => rows.filter((row) => row.dataset !== 'real'));
        setAllPayments((rows) => rows.filter((row) => row.dataset !== 'real'));
        setAllExpenses((rows) => rows.filter((row) => row.dataset !== 'real'));
        toast.success('Dados apagados', 'Os registros reais foram removidos deste navegador.');
        return true;
      });
      return result ?? false;
    },
    [run, toast],
  );

  const snapshot = useCallback<DataActions['snapshot']>(() => {
    const current = dataRef.current;
    return {
      leads: current.leads,
      companies: current.companies,
      activities: current.activities,
      interactions: current.interactions,
      contracts: current.contracts,
      payments: current.payments,
      expenses: current.expenses,
      settings: current.settings,
    };
  }, []);

  /* ------------------------------------------------------------------ value --- */

  const actions = useMemo<DataActions>(
    () => ({
      reload: load,
      createLead,
      updateLead,
      deleteLead,
      changeLeadStage,
      convertLeadToClient,
      createCompany,
      updateCompany,
      deleteCompany,
      linkLeadToCompany,
      createCompanyFromLead,
      createActivity,
      updateActivity,
      setActivityDone,
      deleteActivity,
      addInteraction,
      deleteInteraction,
      updateSettings,
      createContract,
      updateContract,
      deleteContract,
      updatePayment,
      setPaymentPaid,
      createPayment,
      deletePayment,
      createExpense,
      updateExpense,
      deleteExpense,
      importBackup,
      importLeads,
      markBackupExported,
      setDataset,
      seedDemo,
      clearDemo,
      eraseRealData,
      snapshot,
    }),
    [
      load,
      createLead,
      updateLead,
      deleteLead,
      changeLeadStage,
      convertLeadToClient,
      createCompany,
      updateCompany,
      deleteCompany,
      linkLeadToCompany,
      createCompanyFromLead,
      createActivity,
      updateActivity,
      setActivityDone,
      deleteActivity,
      addInteraction,
      deleteInteraction,
      updateSettings,
      createContract,
      updateContract,
      deleteContract,
      updatePayment,
      setPaymentPaid,
      createPayment,
      deletePayment,
      createExpense,
      updateExpense,
      deleteExpense,
      importBackup,
      importLeads,
      markBackupExported,
      setDataset,
      seedDemo,
      clearDemo,
      eraseRealData,
      snapshot,
    ],
  );

  const value = useMemo<DataContextValue>(() => {
    const leads = allLeads.filter((row) => row.dataset === dataset);
    const companies = allCompanies.filter((row) => row.dataset === dataset);
    const activities = allActivities.filter((row) => row.dataset === dataset);
    const interactions = allInteractions.filter((row) => row.dataset === dataset);
    const contracts = allContracts.filter((row) => row.dataset === dataset);
    const payments = allPayments.filter((row) => row.dataset === dataset);
    const expenses = allExpenses.filter((row) => row.dataset === dataset);
    const datasets = {
      leads: allLeads,
      companies: allCompanies,
      activities: allActivities,
      interactions: allInteractions,
      contracts: allContracts,
      payments: allPayments,
      expenses: allExpenses,
    };
    return {
      status,
      error,
      errorDetail,
      source: isTeam ? 'equipe' : 'local',
      storageMode: isTeam ? 'indexeddb' : backendKind(),
      settings,
      stages,
      dataset,
      leads,
      companies,
      activities,
      interactions,
      contracts,
      payments,
      expenses,
      counts: {
        real: countDataset('real', datasets),
        demo: countDataset('demo', datasets),
      },
      saving,
      actions,
    };
  }, [
    status,
    error,
    errorDetail,
    isTeam,
    settings,
    stages,
    dataset,
    allLeads,
    allCompanies,
    allActivities,
    allInteractions,
    allContracts,
    allPayments,
    allExpenses,
    saving,
    actions,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData precisa estar dentro de <DataProvider>');
  return context;
}
