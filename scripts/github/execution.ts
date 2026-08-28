import { Effect } from "effect";
import { requireQueueExact, requireQueueFingerprint } from "./guard.ts";

const PRODUCTION_FINGERPRINT =
  "e9dd88a68cbe98fe64de918c27678380a9cd21af020f2c2473b1d48c11ef3baf";
const QUALITY_FINGERPRINT =
  "558e0a397b8bc8d8f5b81b147460a718f909fec914531d00fd2d31cf808869cc";

/** Validates every command and setting executed by acceptance jobs. */
export const validateQueueExecution = Effect.fn("GithubQueue.execution")(
  function* (
    quality: Readonly<Record<string, unknown>>,
    production: Readonly<Record<string, unknown>>
  ) {
    yield* requireQueueFingerprint(
      JSON.stringify(quality),
      QUALITY_FINGERPRINT,
      "Quality execution"
    );
    yield* requireQueueFingerprint(
      JSON.stringify(production),
      PRODUCTION_FINGERPRINT,
      "Production execution"
    );
    yield* requireQueueExact(
      production.needs,
      "production-scope",
      "Production lost its scope dependency."
    );
    yield* requireQueueExact(
      production.if,
      "needs.production-scope.outputs.required == 'true' && needs.production-scope.outputs.trusted == 'true'",
      "Production changed its signed admission condition."
    );
  }
);
