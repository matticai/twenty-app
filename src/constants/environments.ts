// Which 1eye environment this build of the app talks to. The choice is made when the app is built
// (`ONEEYE_ENV=local twenty app apply ...`) and becomes the default of the app's ONEEYE_API_URL variable.
// With nothing set the build is production, so a plain build or publish can never point at a laptop.

export type OneEyeEnvironment = 'prod' | 'dev' | 'local';

export type EnvironmentUrls = {
  /** Base URL of the 1eye API (pairing, disconnect). */
  apiUrl: string;
};

export const ENVIRONMENTS: Record<OneEyeEnvironment, EnvironmentUrls> = {
  prod: { apiUrl: 'https://api.1eye.ai' },
  dev: { apiUrl: 'https://dev.api.1eye.ai' },
  // The Twenty server runs in Docker, so its functions reach a service on the host through
  // host.docker.internal; plain localhost would be the container itself. When Twenty runs directly
  // on the host, override with ONEEYE_API_URL=http://localhost:8000.
  local: { apiUrl: 'http://host.docker.internal:8000' },
};

const isEnvironment = (value: string): value is OneEyeEnvironment => value in ENVIRONMENTS;

const checkUrl = (name: string, value: string, environment: OneEyeEnvironment): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL: ${value}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`${name} must be an http(s) URL`);
  // Production traffic carries pairing codes and signed requests: https only.
  if (environment === 'prod' && url.protocol !== 'https:') throw new Error(`${name} must use https in the prod environment`);
  if (url.username || url.password) throw new Error(`${name} must not contain credentials`);
  return value.replace(/\/+$/, '');
};

// resolveEnvironment picks the URLs for a build. An unknown ONEEYE_ENV fails the build loudly rather
// than silently falling back to another environment.
export const resolveEnvironment = (
  env: string | undefined,
  overrides: { apiUrl?: string } = {},
): { environment: OneEyeEnvironment } & EnvironmentUrls => {
  const name = (env ?? '').trim() === '' ? 'prod' : (env as string).trim();
  if (!isEnvironment(name)) {
    throw new Error(`ONEEYE_ENV must be one of ${Object.keys(ENVIRONMENTS).join(', ')} (got "${name}")`);
  }
  const base = ENVIRONMENTS[name];
  return {
    environment: name,
    apiUrl: checkUrl('ONEEYE_API_URL', overrides.apiUrl?.trim() || base.apiUrl, name),
  };
};
