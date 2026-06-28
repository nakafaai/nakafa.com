import { Context, type Effect } from "effect";

/**
 * Request-scoped diagnostics seam for NinaHarness.
 *
 * App adapters can attach deployment-specific logging, analytics, and error
 * capture without exposing those callbacks through the public harness input.
 */
export class NinaReporter extends Context.Tag("NinaReporter")<
  NinaReporter,
  {
    readonly report: (input: {
      readonly error: unknown;
      readonly source: string;
    }) => Effect.Effect<void>;
  }
>() {}
