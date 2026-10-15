import { phoneDigits, normalizeText } from '../utils/format';
import type { Lead } from '../models/types';

export interface DuplicateGroup {
  key: string;
  reason: 'telefone' | 'e-mail';
  value: string;
  leads: Lead[];
}

/**
 * Groups leads that share a phone/WhatsApp number or an e-mail address.
 * Reported as a hint only — nothing is blocked or merged automatically,
 * because different contacts legitimately share a company number.
 */
export function findDuplicateGroups(leads: Lead[]): DuplicateGroup[] {
  const byPhone = new Map<string, Lead[]>();
  const byEmail = new Map<string, Lead[]>();

  for (const lead of leads) {
    const numbers = new Set(
      [lead.phone, lead.whatsapp].map((value) => phoneDigits(value)).filter((v) => v.length >= 10),
    );
    for (const number of numbers) {
      const bucket = byPhone.get(number) ?? [];
      if (!bucket.some((candidate) => candidate.id === lead.id)) bucket.push(lead);
      byPhone.set(number, bucket);
    }
    const email = normalizeText(lead.email);
    if (email.includes('@')) {
      const bucket = byEmail.get(email) ?? [];
      bucket.push(lead);
      byEmail.set(email, bucket);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [value, bucket] of byPhone) {
    if (bucket.length > 1) {
      groups.push({ key: `phone:${value}`, reason: 'telefone', value, leads: bucket });
    }
  }
  for (const [value, bucket] of byEmail) {
    if (bucket.length > 1) {
      groups.push({ key: `email:${value}`, reason: 'e-mail', value, leads: bucket });
    }
  }
  return groups.sort((a, b) => b.leads.length - a.leads.length);
}

/** Leads that already use one of the given contact points. */
export function findPossibleMatches(
  leads: Lead[],
  contact: { phone?: string; whatsapp?: string; email?: string },
  excludeId?: string,
): Lead[] {
  const numbers = new Set(
    [contact.phone, contact.whatsapp]
      .map((value) => phoneDigits(value || ''))
      .filter((value) => value.length >= 10),
  );
  const email = normalizeText(contact.email || '');
  if (numbers.size === 0 && !email.includes('@')) return [];

  return leads.filter((lead) => {
    if (excludeId && lead.id === excludeId) return false;
    const leadNumbers = [lead.phone, lead.whatsapp].map((value) => phoneDigits(value));
    if (leadNumbers.some((value) => value.length >= 10 && numbers.has(value))) return true;
    return Boolean(email) && normalizeText(lead.email) === email;
  });
}
