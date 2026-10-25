import { DurableObject, Worker } from "@alchemy.run/cloudflare";
import { RemovalPolicy } from "alchemy";
import { Config, Effect, Schema } from "effect";
import {
  casFrontExposure,
  WORKER_OBSERVABILITY,
  WORKER_PLACEMENT,
} from "#www/deploy/stage";
import { workerSettings } from "#www/worker";

/**
 * The engine's compatibility date. Python Workers run Python 3.14 from 2026-09-08,
 * but the packages that the stack vendors for the engine are built for Python 3.13,
 * so the engine stays on the last date before that change.
 */
const CAS_ENGINE_COMPATIBILITY_DATE = "2026-09-07";

/**
 * The CAS math service. A Python engine runs each calculation in a Durable Object,
 * and a TypeScript front answers cas.nakafa.com and forwards to the engine. Both
 * Workers run on the Free plan. The front binds the engine's class by script name.
 *
 * The engine has no route and no workers.dev URL, so only the front is public.
 */
export const deployCas = Effect.fn("deploy.cas")(function* (
  stage: string,
  isProduction: boolean
) {
  // An unset or empty key fails the deploy here, before either Worker changes.
  const apiKey = yield* Config.schema(
    Schema.Redacted(Schema.NonEmptyString),
    "MATH_CAS_API_KEY"
  );

  const engine = yield* Worker("CasEngine", {
    main: "../cas/entry.py",
    compatibility: { date: CAS_ENGINE_COMPATIBILITY_DATE },
    env: { CAS_SOLVER: DurableObject("CasSolver") },
    observability: WORKER_OBSERVABILITY,
    placement: WORKER_PLACEMENT,
    workersDev: false,
  }).pipe(RemovalPolicy.retain(isProduction));

  yield* Worker("CasFront", {
    main: "../cas/front/worker.ts",
    compatibility: { date: workerSettings.compatibilityDate },
    env: {
      CAS_SOLVER: DurableObject("CasSolver", {
        scriptName: engine.workerName,
      }),
      MATH_CAS_API_KEY: apiKey,
    },
    observability: WORKER_OBSERVABILITY,
    placement: WORKER_PLACEMENT,
    ...casFrontExposure(stage),
  }).pipe(RemovalPolicy.retain(isProduction));
});
