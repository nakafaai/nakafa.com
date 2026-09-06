import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  initializeLocalRuntime,
  leaseLocalRuntime,
  localApplicationEnvironment,
  readLocalRuntime,
  releaseLocalRuntime,
  reserveLocalRuntime,
} from "@repo/backend/scripts/content/acceptance/local";
import {
  runBuildCommand,
  withLocalBackend,
} from "@repo/backend/scripts/content/acceptance/process";
import { publishAcceptanceSource } from "@repo/backend/scripts/content/acceptance/publication";
import { Effect, Exit } from "effect";

/** Creates one signed local acceptance database without touching a cloud deployment. */
export const prepareAcceptance = Effect.fn("acceptance.prepare")(function* (
  root: string
) {
  const reservation = yield* reserveLocalRuntime(root);
  return yield* Effect.gen(function* () {
    yield* leaseLocalRuntime(root);
    const runtime = yield* initializeLocalRuntime(root);
    yield* withLocalBackend(runtime, publishAcceptanceSource(root, runtime));
  }).pipe(
    Effect.scoped,
    Effect.onExit((exit) =>
      Exit.isFailure(exit) ? releaseLocalRuntime(reservation) : Effect.void
    )
  );
});

/** Starts only the owned native database for a normal app build or start. */
export const runAcceptance = Effect.fn("acceptance.run")(function* (
  root: string,
  operation: "build" | "start",
  args: readonly string[]
) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run pnpm acceptance:prepare before building or starting acceptance."
    );
  }
  yield* leaseLocalRuntime(root);
  yield* withLocalBackend(
    runtime,
    runBuildCommand(
      root,
      ["pnpm", "run", operation, ...args],
      localApplicationEnvironment(runtime)
    )
  );
}, Effect.scoped);
