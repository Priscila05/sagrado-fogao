import { phoneDigits, isValidPhone, isValidEmail } from './format';

/**
 * Link builders. Every outbound URL is validated here so imported data can
 * never inject a `javascript:` / `data:` scheme into an anchor.
 */

const SAFE_SCHEMES = new Set(['http:', 'https:']);

/** Returns a safe absolute https(s) URL, or null when the input is unusable. */
export function safeExternalUrl(raw: string): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (!SAFE_SCHEMES.has(parsed.protocol)) return null;
  if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
  return parsed.toString();
}

/** tel: link for a valid Brazilian number. */
export function telLink(raw: string): string | null {
  if (!isValidPhone(raw)) return null;
  return `tel:+55${phoneDigits(raw)}`;
}

/** wa.me link for a valid Brazilian number. */
export function whatsappLink(raw: string, message?: string): string | null {
  if (!isValidPhone(raw)) return null;
  const base = `https://wa.me/55${phoneDigits(raw)}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function mailtoLink(raw: string, subject?: string): string | null {
  if (!isValidEmail(raw)) return null;
  const address = raw.trim();
  if (!subject) return `mailto:${address}`;
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}

/** Accepts "@perfil", "perfil" or a full instagram.com URL. */
export function instagramLink(raw: string): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  if (/instagram\.com/i.test(value)) return safeExternalUrl(value);
  const handle = value.replace(/^@/, '').replace(/\/+$/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  return `https://instagram.com/${handle}`;
}

/** Display form of an Instagram handle. */
export function instagramHandle(raw: string): string {
  const value = (raw || '').trim();
  if (!value) return '';
  const match = value.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (match) return `@${match[1]}`;
  return value.startsWith('@') ? value : `@${value}`;
}

/** Hostname only, for compact display of a website. */
export function displayUrl(raw: string): string {
  const url = safeExternalUrl(raw);
  if (!url) return (raw || '').trim();
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return raw;
  }
}
