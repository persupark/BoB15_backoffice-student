import crypto from 'node:crypto';

/**
 * CryptoProvider 인터페이스 (제7조 암호화)
 *   generateDek() / wrapDek(dek) / unwrapDek(wrapped) / encryptField(dek, plain) / decryptField(dek, blob)
 *
 * LocalAesGcmProvider — 회원별 DEK(AES-256-GCM)를 만들고 마스터키(env)로 래핑하는
 * 봉투암호화. DEK 파기(=dek_wrapped 삭제)만으로 데이터가 복구 불능이 되는 crypto-shred 구조.
 * 동일 시그니처를 유지하면 래핑/해제를 KMS·Vault 등 외부 키관리로 위임하는 구현으로 교체 가능.
 */
export class LocalAesGcmProvider {
  #master;

  constructor(masterKeyB64) {
    const key = Buffer.from(masterKeyB64 ?? '', 'base64');
    if (key.length !== 32) throw new Error('MASTER_KEY_B64 must decode to 32 bytes');
    this.#master = key;
  }

  generateDek() {
    return crypto.randomBytes(32);
  }

  wrapDek(dek) {
    return `wdek:v1:${seal(this.#master, dek).toString('base64')}`;
  }

  unwrapDek(wrapped) {
    const b64 = expectPrefix(wrapped, 'wdek:v1:');
    return open(this.#master, Buffer.from(b64, 'base64'));
  }

  encryptField(dek, plaintext) {
    if (plaintext === null || plaintext === undefined) return null;
    return `enc:v1:${seal(dek, Buffer.from(String(plaintext), 'utf8')).toString('base64')}`;
  }

  decryptField(dek, blob) {
    if (blob === null || blob === undefined) return null;
    const b64 = expectPrefix(blob, 'enc:v1:');
    return open(dek, Buffer.from(b64, 'base64')).toString('utf8');
  }
}

function seal(key, data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

function open(key, buf) {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function expectPrefix(value, prefix) {
  if (typeof value !== 'string' || !value.startsWith(prefix)) {
    throw new Error(`invalid ciphertext format (expected ${prefix}…)`);
  }
  return value.slice(prefix.length);
}
