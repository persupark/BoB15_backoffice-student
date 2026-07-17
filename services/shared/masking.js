// 개인정보 표시 마스킹 (제12조 출력·복사물 통제의 기본값)

export function maskName(name) {
  if (!name) return '';
  const chars = [...name];
  if (chars.length === 1) return '*';
  if (chars.length === 2) return chars[0] + '*';
  return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
}

export function maskPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return '***';
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function maskEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

export function maskCard(last4) {
  return last4 ? `****-****-****-${last4}` : '';
}

export function maskBirth(date) {
  if (!date) return '';
  const iso = date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
  return `${iso.slice(0, 4)}-**-**`;
}

export function maskCi() {
  return '****************';
}
