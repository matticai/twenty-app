// Normalizers matching the 1eye backend (core-lib pkg/twenty values.go), so a company or buyer
// is identified the same way on both sides.

export const normalizeEmail = (raw: string | undefined | null): string | null => {
  const email = (raw ?? '').trim().toLowerCase();
  if (email === '' || /\s|[<>(),;:\\"]/.test(email)) return null;
  const parts = email.split('@');
  if (parts.length !== 2 || parts[0] === '' || !parts[1]?.includes('.')) return null;
  return email;
};

// normalizeDomain reduces a URL or host to a bare lowercase domain: no protocol, path, port,
// query or leading "www.". Returns null when nothing domain-like remains.
export const normalizeDomain = (raw: string | undefined | null): string | null => {
  let d = (raw ?? '').trim().toLowerCase();
  if (d === '') return null;
  if (!d.includes('://')) d = `//${d}`;
  let host: string;
  try {
    const url = new URL(d, 'https://placeholder.invalid');
    if (url.username || url.password) return null;
    host = url.hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  if (host === '' || !host.includes('.') || /[\s@]/.test(host)) return null;
  return host;
};
