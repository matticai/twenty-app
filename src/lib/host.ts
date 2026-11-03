// The host of a URL for display and diagnostics (never the path, query or credentials).
export const hostOf = (url: string): string => {
  try {
    return new URL(url).host || '';
  } catch {
    return '';
  }
};
