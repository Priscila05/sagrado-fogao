import { Globe, Instagram, Mail, MessageCircle, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { instagramLink, mailtoLink, safeExternalUrl, telLink, whatsappLink } from '../../utils/links';

interface Contact {
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  instagram?: string;
}

interface ActionDefinition {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Anchors that leave the browser (tel:, mailto:) must not open a tab. */
  sameTab?: boolean;
}

/**
 * Builds the outbound actions available for a contact. Only links that are
 * actually valid are returned — no decorative buttons that lead nowhere.
 */
export function buildContactActions(contact: Contact): ActionDefinition[] {
  const actions: ActionDefinition[] = [];

  const tel = telLink(contact.phone || '');
  if (tel) actions.push({ key: 'ligar', label: 'Ligar', href: tel, icon: Phone, sameTab: true });

  const whats = whatsappLink(contact.whatsapp || contact.phone || '');
  if (whats) actions.push({ key: 'whatsapp', label: 'WhatsApp', href: whats, icon: MessageCircle });

  const mail = mailtoLink(contact.email || '');
  if (mail) actions.push({ key: 'email', label: 'E-mail', href: mail, icon: Mail, sameTab: true });

  const site = safeExternalUrl(contact.website || '');
  if (site) actions.push({ key: 'site', label: 'Site', href: site, icon: Globe });

  const insta = instagramLink(contact.instagram || '');
  if (insta) actions.push({ key: 'instagram', label: 'Instagram', href: insta, icon: Instagram });

  return actions;
}

/**
 * Renders the contact actions. Opening a link is not an interaction: the
 * `onOpened` callback lets the page offer to log it, and the user confirms.
 */
export function ContactActions({
  contact,
  onOpened,
  size = 'md',
}: {
  contact: Contact;
  onOpened?: (key: string) => void;
  size?: 'sm' | 'md';
}) {
  const actions = buildContactActions(contact);

  if (actions.length === 0) {
    return (
      <p className="text-xs text-muted">
        Nenhum contato válido cadastrado. Adicione telefone, e-mail ou site para liberar as ações.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <a
          key={action.key}
          href={action.href}
          target={action.sameTab ? undefined : '_blank'}
          rel={action.sameTab ? undefined : 'noopener noreferrer'}
          onClick={() => onOpened?.(action.key)}
          className={[
            'focus-ring inline-flex items-center gap-1.5 rounded-md border border-line bg-surface font-medium text-ink transition-all duration-150 ease-swift',
            'hover:border-line-strong hover:bg-sunken active:translate-y-px',
            size === 'sm' ? 'h-8 px-2.5 text-sm' : 'h-9 px-3 text-base',
          ].join(' ')}
        >
          <action.icon className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
          {action.label}
        </a>
      ))}
    </div>
  );
}

/** Single-icon variant used inside dense lists and pipeline cards. */
export function ContactIconLinks({ contact }: { contact: Contact }) {
  const actions = buildContactActions(contact).slice(0, 4);
  if (actions.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      {actions.map((action) => (
        <a
          key={action.key}
          href={action.href}
          target={action.sameTab ? undefined : '_blank'}
          rel={action.sameTab ? undefined : 'noopener noreferrer'}
          title={action.label}
          aria-label={action.label}
          onClick={(event) => event.stopPropagation()}
          className="focus-ring rounded p-1.5 text-subtle transition-colors hover:bg-sunken hover:text-ink"
        >
          <action.icon className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
