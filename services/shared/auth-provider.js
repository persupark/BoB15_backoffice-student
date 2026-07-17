import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

/**
 * AuthProvider 인터페이스 (제6조 안전한 인증)
 * LocalAuthProvider — bcrypt 비밀번호 + TOTP MFA.
 * 동일 시그니처를 유지하면 SSO/MFA를 외부 IdP(OIDC 등)로 위임하는 구현으로 교체 가능.
 */
export const LocalAuthProvider = {
  hashPassword: (pw) => bcrypt.hash(pw, 10),
  verifyPassword: (pw, hash) => bcrypt.compare(pw, hash),
  generateTotpSecret: () => authenticator.generateSecret(),
  totpKeyUri: (label, secret) => authenticator.keyuri(label, 'boblog', secret),
  verifyTotp: (token, secret) => {
    try {
      return authenticator.check(String(token ?? '').trim(), secret);
    } catch {
      return false;
    }
  },
};
