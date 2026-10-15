import {
  CircleDot,
  FileText,
  Handshake,
  MessageSquare,
  PhoneCall,
  PhoneOff,
  Reply,
  Settings2,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { INTERACTION_TYPE_LABEL, type Interaction, type InteractionType } from '../../models/types';
import { formatDateTime } from '../../utils/date';
import { Button } from '../ui/Button';

const ICONS: Record<InteractionType, LucideIcon> = {
  ligacao_realizada: PhoneCall,
  nao_atendeu: PhoneOff,
  mensagem_enviada: MessageSquare,
  resposta_recebida: Reply,
  reuniao: Users,
  proposta: FileText,
  negociacao: Handshake,
  observacao: CircleDot,
  sistema: Settings2,
};

/** Reverse-chronological history of a lead or company. */
export function Timeline({
  interactions,
  onDelete,
}: {
  interactions: Interaction[];
  onDelete?: (interaction: Interaction) => void;
}) {
  return (
    <ol className="relative flex flex-col">
      {interactions.map((interaction, index) => {
        const Icon = ICONS[interaction.type];
        const last = index === interactions.length - 1;
        return (
          <li key={interaction.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? (
              <span
                className="absolute left-[13px] top-7 bottom-0 w-px bg-line"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={[
                'relative z-10 mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border',
                interaction.automatic
                  ? 'border-line bg-sunken text-subtle'
                  : 'border-accent/25 bg-accent-soft text-accent',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium text-ink">
                  {INTERACTION_TYPE_LABEL[interaction.type]}
                </p>
                <time
                  className="text-2xs text-subtle tnum"
                  dateTime={interaction.occurredAt}
                >
                  {formatDateTime(interaction.occurredAt)}
                </time>
                {onDelete && !interaction.automatic ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-1.5 text-2xs"
                    onClick={() => onDelete(interaction)}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
                {interaction.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
