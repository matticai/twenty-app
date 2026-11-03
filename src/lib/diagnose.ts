import type { DataGateway, SchemaProvider } from 'src/lib/gateway';

// A self-test of the two reads the sync endpoint depends on, run as the application's own role: reading the
// workspace schema (describe_schema) and reading records (matching). It reports which step fails and why, so
// a 502 from the endpoint, whose body Twenty may hide, can be explained. Messages are bounded and carry no
// record data: the checks read metadata and probe for one id that does not exist.

export type DiagnosticStep = {
  step: 'schema' | 'records';
  ok: boolean;
  detail?: string;
  error?: string;
  /** When the schema read fails: the Field attributes the app's token can query, to see what differs. */
  availableFieldAttributes?: string[];
};

export type DiagnosticResult = { ok: boolean; steps: DiagnosticStep[] };

const MAX_ERROR = 300;

export const describeError = (e: unknown): string => {
  const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return message.slice(0, MAX_ERROR);
};

export const runDiagnostics = async (deps: {
  schema: SchemaProvider;
  gateway: Pick<DataGateway, 'findPeopleByOneeyeId'>;
  /** Optional: lists the Field attributes the app can query, used only when the schema read fails. */
  introspect?: () => Promise<string[]>;
}): Promise<DiagnosticResult> => {
  const steps: DiagnosticStep[] = [];

  try {
    const schema = await deps.schema.load();
    const own = [...schema.person, ...schema.company].filter((f) => f.name.startsWith('oneeye')).map((f) => f.name);
    steps.push({
      step: 'schema',
      ok: true,
      detail: `person fields: ${schema.person.length}, company fields: ${schema.company.length}, 1eye fields: ${own.join(', ') || 'none'}`,
    });
  } catch (e) {
    const step: DiagnosticStep = { step: 'schema', ok: false, error: describeError(e) };
    try {
      if (deps.introspect) step.availableFieldAttributes = await deps.introspect();
    } catch {
      // introspection is a best-effort extra; the original error is what matters
    }
    steps.push(step);
  }

  try {
    const found = await deps.gateway.findPeopleByOneeyeId('__diagnose__');
    steps.push({ step: 'records', ok: true, detail: `read ok (${found.length} matches for a probe id)` });
  } catch (e) {
    steps.push({ step: 'records', ok: false, error: describeError(e) });
  }

  return { ok: steps.every((s) => s.ok), steps };
};
