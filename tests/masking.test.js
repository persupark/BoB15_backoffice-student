import { describe, it, expect } from 'vitest';
import { masking } from '@boblog/shared';

describe('마스킹 (제12조 표시제한 기본값)', () => {
  it('이름', () => {
    expect(masking.maskName('홍길동')).toBe('홍*동');
    expect(masking.maskName('김수')).toBe('김*');
    expect(masking.maskName('남궁민수')).toBe('남**수');
  });
  it('전화번호', () => {
    expect(masking.maskPhone('010-1234-5678')).toBe('010-****-5678');
    expect(masking.maskPhone('01012345678')).toBe('010-****-5678');
  });
  it('이메일', () => {
    expect(masking.maskEmail('gildong@example.com')).toBe('gi*****@example.com');
    expect(masking.maskEmail('a@b.io')).toBe('a*@b.io');
  });
  it('카드', () => {
    expect(masking.maskCard('4321')).toBe('****-****-****-4321');
  });
});
