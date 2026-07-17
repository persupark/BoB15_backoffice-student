import { describe, it, expect } from 'vitest';
import { LocalAesGcmProvider } from '@boblog/shared';
import { TEST_MASTER_KEY } from './helpers.js';

describe('LocalAesGcmProvider (제7조 봉투암호화)', () => {
  const p = new LocalAesGcmProvider(TEST_MASTER_KEY);

  it('필드 암복호 왕복', () => {
    const dek = p.generateDek();
    const ct = p.encryptField(dek, '010-1234-5678');
    expect(ct).toMatch(/^enc:v1:/);
    expect(ct).not.toContain('1234');
    expect(p.decryptField(dek, ct)).toBe('010-1234-5678');
  });

  it('DEK 래핑/해제 왕복', () => {
    const dek = p.generateDek();
    const wrapped = p.wrapDek(dek);
    expect(wrapped).toMatch(/^wdek:v1:/);
    expect(p.unwrapDek(wrapped).equals(dek)).toBe(true);
  });

  it('암호문 변조 시 복호화 실패 (GCM 무결성)', () => {
    const dek = p.generateDek();
    const ct = p.encryptField(dek, 'secret');
    const buf = Buffer.from(ct.slice('enc:v1:'.length), 'base64');
    buf[buf.length - 1] ^= 0xff;
    expect(() => p.decryptField(dek, 'enc:v1:' + buf.toString('base64'))).toThrow();
  });

  it('다른 DEK로는 복호화 불가 (crypto-shred 근거)', () => {
    const ct = p.encryptField(p.generateDek(), 'secret');
    expect(() => p.decryptField(p.generateDek(), ct)).toThrow();
  });

  it('마스터키는 32바이트 강제', () => {
    expect(() => new LocalAesGcmProvider('c2hvcnQ=')).toThrow(/32 bytes/);
  });
});
