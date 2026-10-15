import { describe, expect, it } from 'vitest';
import {
  formatPhone,
  isValidEmail,
  isValidPhone,
  normalizeText,
  parseCurrencyInput,
  phoneDigits,
} from './format';
import {
  instagramHandle,
  instagramLink,
  mailtoLink,
  safeExternalUrl,
  telLink,
  whatsappLink,
} from './links';
import { parseCsv, toCsv } from './csv';
import {
  addDays,
  dayKey,
  fromDateInputValue,
  isBeforeToday,
  isOverdue,
  relativeDayLabel,
  toDateInputValue,
} from './date';

describe('formatação brasileira', () => {
  it('formata telefones fixos e celulares', () => {
    expect(formatPhone('41999998888')).toBe('(41) 99999-8888');
    expect(formatPhone('4133334444')).toBe('(41) 3333-4444');
    expect(formatPhone('+55 41 99999-8888')).toBe('(41) 99999-8888');
  });

  it('valida telefones com 10 ou 11 dígitos', () => {
    expect(isValidPhone('(41) 99999-8888')).toBe(true);
    expect(isValidPhone('4133334444')).toBe(true);
    expect(isValidPhone('99999')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });

  it('remove o código do país ao extrair dígitos', () => {
    expect(phoneDigits('+55 (41) 99999-8888')).toBe('41999998888');
  });

  it('interpreta valores em reais digitados de várias formas', () => {
    expect(parseCurrencyInput('R$ 1.234,56')).toBeCloseTo(1234.56);
    expect(parseCurrencyInput('2500')).toBe(2500);
    expect(parseCurrencyInput('1234.56')).toBeCloseTo(1234.56);
    expect(parseCurrencyInput('abc')).toBe(0);
  });

  it('valida e-mails', () => {
    expect(isValidEmail('contato@empresa.com.br')).toBe(true);
    expect(isValidEmail('contato@empresa')).toBe(false);
    expect(isValidEmail('sem-arroba.com')).toBe(false);
  });

  it('normaliza texto para busca sem acento', () => {
    expect(normalizeText('Açaí da Praça')).toBe('acai da praca');
  });
});

describe('links seguros', () => {
  it('recusa esquemas perigosos vindos de dados importados', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>')).toBeNull();
    expect(safeExternalUrl('vbscript:msgbox')).toBeNull();
  });

  it('aceita domínios e completa o protocolo', () => {
    expect(safeExternalUrl('empresa.com.br')).toBe('https://empresa.com.br/');
    expect(safeExternalUrl('https://monter.studio/x')).toBe('https://monter.studio/x');
    expect(safeExternalUrl('semponto')).toBeNull();
  });

  it('monta tel, WhatsApp e mailto apenas com dados válidos', () => {
    expect(telLink('41999998888')).toBe('tel:+5541999998888');
    expect(telLink('123')).toBeNull();
    expect(whatsappLink('(41) 99999-8888')).toBe('https://wa.me/5541999998888');
    expect(whatsappLink('41999998888', 'Olá!')).toBe('https://wa.me/5541999998888?text=Ol%C3%A1!');
    expect(mailtoLink('a@b.com.br')).toBe('mailto:a@b.com.br');
    expect(mailtoLink('invalido')).toBeNull();
  });

  it('entende perfis do Instagram em diferentes formatos', () => {
    expect(instagramLink('@monter')).toBe('https://instagram.com/monter');
    expect(instagramLink('https://instagram.com/monter')).toBe('https://instagram.com/monter');
    expect(instagramLink('perfil inválido!')).toBeNull();
    expect(instagramHandle('https://instagram.com/monter')).toBe('@monter');
  });
});

describe('CSV', () => {
  it('escreve com ponto e vírgula e neutraliza fórmulas', () => {
    const csv = toCsv(['Nome', 'Obs'], [['=SOMA(A1)', 'tem ; ponto e vírgula']]);
    expect(csv).toContain("'=SOMA(A1)");
    expect(csv).toContain('"tem ; ponto e vírgula"');
  });

  it('lê arquivos com aspas, vírgulas e quebras de linha', () => {
    const text = 'Nome;Obs\n"Pet, Shop";"linha 1\nlinha 2"\n';
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(['Nome', 'Obs']);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('Pet, Shop');
    expect(rows[0][1]).toBe('linha 1\nlinha 2');
  });

  it('detecta separador vírgula', () => {
    const { headers, rows } = parseCsv('a,b,c\n1,2,3\n');
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows[0]).toEqual(['1', '2', '3']);
  });
});

describe('datas', () => {
  it('reconhece atraso e datas anteriores a hoje', () => {
    expect(isOverdue(addDays(new Date(), -1).toISOString())).toBe(true);
    expect(isOverdue(addDays(new Date(), 1).toISOString())).toBe(false);
    expect(isBeforeToday(addDays(new Date(), -2).toISOString())).toBe(true);
    expect(isBeforeToday(new Date().toISOString())).toBe(false);
  });

  it('descreve datas relativas em português', () => {
    expect(relativeDayLabel(new Date().toISOString())).toBe('hoje');
    expect(relativeDayLabel(addDays(new Date(), 1).toISOString())).toBe('amanhã');
    expect(relativeDayLabel(addDays(new Date(), -1).toISOString())).toBe('ontem');
    expect(relativeDayLabel(addDays(new Date(), 3).toISOString())).toBe('em 3 dias');
  });

  it('converte entre ISO e valores de input', () => {
    const iso = fromDateInputValue('2026-03-10');
    expect(iso).not.toBeNull();
    expect(toDateInputValue(iso)).toBe('2026-03-10');
    expect(dayKey('2026-03-10T12:00:00')).toBe('2026-03-10');
    expect(fromDateInputValue('data-invalida')).toBeNull();
  });
});
