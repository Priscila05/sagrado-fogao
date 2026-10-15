import { createId } from '../utils/id';
import { normalizeActivity, normalizeCompany, normalizeInteraction, normalizeLead } from '../models/normalize';
import type { Activity, Company, Interaction, Lead, Stage } from '../models/types';

/**
 * Demonstration dataset. Every record is tagged `dataset: 'demo'`, carries a
 * "(demo)" suffix in its name and uses placeholder phone numbers that cannot
 * reach anyone, so it can never be mistaken for real commercial data. Demo
 * records are never exported in a backup and are shown only while the
 * demonstration mode is active.
 */

const DEMO_PHONE_PREFIX = '1190000';

interface DemoSeed {
  company: string;
  contact: string;
  segment: string;
  city: string;
  neighborhood: string;
  source: string;
  stageIndex: number;
  value: number;
  priority: Lead['priority'];
  createdDaysAgo: number;
  status: Company['status'];
}

const SEEDS: DemoSeed[] = [
  { company: 'Pet Shop Patas Felizes', contact: 'Ana Ribeiro', segment: 'Pet shop', city: 'Curitiba', neighborhood: 'Água Verde', source: 'Prospecção ativa', stageIndex: 0, value: 2400, priority: 'media', createdDaysAgo: 3, status: 'prospect' },
  { company: 'Cantina Dona Marta', contact: 'Marta Oliveira', segment: 'Restaurante', city: 'Curitiba', neighborhood: 'Batel', source: 'Indicação', stageIndex: 2, value: 3800, priority: 'alta', createdDaysAgo: 9, status: 'prospect' },
  { company: 'Barbearia Navalha de Ouro', contact: 'Rafael Dias', segment: 'Beleza e estética', city: 'São José dos Pinhais', neighborhood: 'Centro', source: 'Instagram', stageIndex: 3, value: 1900, priority: 'media', createdDaysAgo: 14, status: 'prospect' },
  { company: 'Floricultura Jardim Novo', contact: 'Helena Prado', segment: 'Loja', city: 'Curitiba', neighborhood: 'Portão', source: 'WhatsApp', stageIndex: 4, value: 2600, priority: 'alta', createdDaysAgo: 21, status: 'prospect' },
  { company: 'Studio Pilates Equilíbrio', contact: 'Camila Souza', segment: 'Saúde', city: 'Pinhais', neighborhood: 'Weissópolis', source: 'Site', stageIndex: 5, value: 4500, priority: 'alta', createdDaysAgo: 28, status: 'prospect' },
  { company: 'Mecânica Dois Irmãos', contact: 'Jorge Mendes', segment: 'Prestador de serviços', city: 'Colombo', neighborhood: 'Maracanã', source: 'Google', stageIndex: 6, value: 5200, priority: 'media', createdDaysAgo: 35, status: 'prospect' },
  { company: 'Padaria Grão Dourado', contact: 'Luiz Carvalho', segment: 'Restaurante', city: 'Curitiba', neighborhood: 'Cabral', source: 'Indicação', stageIndex: 7, value: 3200, priority: 'alta', createdDaysAgo: 48, status: 'cliente' },
  { company: 'Clínica Vet Bem Estar', contact: 'Patrícia Lima', segment: 'Pet shop', city: 'Curitiba', neighborhood: 'Santa Felicidade', source: 'Prospecção ativa', stageIndex: 7, value: 6100, priority: 'alta', createdDaysAgo: 62, status: 'cliente' },
  { company: 'Lava Rápido Cristal', contact: 'Diego Nunes', segment: 'Prestador de serviços', city: 'Araucária', neighborhood: 'Centro', source: 'Evento', stageIndex: 8, value: 1500, priority: 'baixa', createdDaysAgo: 70, status: 'inativo' },
  { company: 'Boutique Alma Leve', contact: 'Fernanda Rocha', segment: 'Loja', city: 'Curitiba', neighborhood: 'Rebouças', source: 'Instagram', stageIndex: 1, value: 2100, priority: 'baixa', createdDaysAgo: 6, status: 'prospect' },
  { company: 'Escola Infantil Pequeno Mundo', contact: 'Bianca Teixeira', segment: 'Educação', city: 'Curitiba', neighborhood: 'Bigorrilho', source: 'Site', stageIndex: 2, value: 7400, priority: 'alta', createdDaysAgo: 17, status: 'prospect' },
  { company: 'Hamburgueria Fogo Alto', contact: 'Tiago Moreira', segment: 'Restaurante', city: 'Curitiba', neighborhood: 'Água Verde', source: 'WhatsApp', stageIndex: 3, value: 2900, priority: 'media', createdDaysAgo: 11, status: 'prospect' },
];

function isoDaysAgo(days: number, hour = 10): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function isoDaysAhead(days: number, hour = 10): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
}

export interface DemoDataset {
  leads: Lead[];
  companies: Company[];
  activities: Activity[];
  interactions: Interaction[];
}

export function buildDemoDataset(stages: Stage[]): DemoDataset {
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const stageAt = (index: number) => ordered[Math.min(index, ordered.length - 1)];

  const leads: Lead[] = [];
  const companies: Company[] = [];
  const activities: Activity[] = [];
  const interactions: Interaction[] = [];

  SEEDS.forEach((seed, index) => {
    const phone = `${DEMO_PHONE_PREFIX}${String(index).padStart(4, '0')}`;
    const companyId = createId();
    const leadId = createId();
    const createdAt = isoDaysAgo(seed.createdDaysAgo);
    const stage = stageAt(seed.stageIndex);
    const isWon = stage.kind === 'ganha';
    const isLost = stage.kind === 'perdida';
    const lastInteractionAt = isoDaysAgo(Math.max(0, seed.createdDaysAgo - 2));

    companies.push(
      normalizeCompany({
        id: companyId,
        name: `${seed.company} (demo)`,
        segment: seed.segment,
        phone,
        whatsapp: phone,
        email: `contato@exemplo-demo-${index}.com.br`,
        address: 'Rua de Exemplo, 100',
        neighborhood: seed.neighborhood,
        city: seed.city,
        instagram: '',
        website: '',
        notes: 'Registro de demonstração.',
        status: seed.status,
        createdAt,
        updatedAt: lastInteractionAt,
        dataset: 'demo',
      }),
    );

    leads.push(
      normalizeLead({
        id: leadId,
        contactName: `${seed.contact} (demo)`,
        establishmentName: `${seed.company} (demo)`,
        segment: seed.segment,
        phone,
        whatsapp: phone,
        email: `contato@exemplo-demo-${index}.com.br`,
        instagram: '',
        website: '',
        neighborhood: seed.neighborhood,
        city: seed.city,
        source: seed.source,
        stageId: stage.id,
        potentialValue: seed.value,
        priority: seed.priority,
        companyId,
        notes: 'Lead de demonstração — dados fictícios.',
        createdAt,
        updatedAt: lastInteractionAt,
        lastInteractionAt,
        nextContactAt: isWon || isLost ? null : isoDaysAhead(index % 5),
        wonAt: isWon ? lastInteractionAt : null,
        lostAt: isLost ? lastInteractionAt : null,
        dataset: 'demo',
      }),
    );

    interactions.push(
      normalizeInteraction({
        id: createId(),
        leadId,
        companyId,
        type: 'sistema',
        description: 'Lead de demonstração criado.',
        occurredAt: createdAt,
        automatic: true,
        createdAt,
        dataset: 'demo',
      }),
      normalizeInteraction({
        id: createId(),
        leadId,
        companyId,
        type: index % 3 === 0 ? 'ligacao_realizada' : 'mensagem_enviada',
        description:
          index % 3 === 0
            ? 'Ligação de apresentação do estúdio (demonstração).'
            : 'Mensagem de apresentação enviada (demonstração).',
        occurredAt: lastInteractionAt,
        automatic: false,
        createdAt: lastInteractionAt,
        dataset: 'demo',
      }),
    );

    if (!isWon && !isLost) {
      activities.push(
        normalizeActivity({
          id: createId(),
          title: index % 2 === 0 ? 'Retornar contato' : 'Enviar proposta',
          type: index % 2 === 0 ? 'ligacao' : 'proposta',
          leadId,
          companyId,
          dueAt: index % 4 === 0 ? isoDaysAgo(2, 9) : isoDaysAhead(index % 6, 14),
          priority: seed.priority,
          notes: 'Atividade de demonstração.',
          done: false,
          doneAt: null,
          createdAt,
          updatedAt: createdAt,
          dataset: 'demo',
        }),
      );
    } else {
      activities.push(
        normalizeActivity({
          id: createId(),
          title: 'Reunião de fechamento',
          type: 'reuniao',
          leadId,
          companyId,
          dueAt: lastInteractionAt,
          priority: 'media',
          notes: 'Atividade de demonstração concluída.',
          done: true,
          doneAt: lastInteractionAt,
          createdAt,
          updatedAt: lastInteractionAt,
          dataset: 'demo',
        }),
      );
    }
  });

  return { leads, companies, activities, interactions };
}
