import { withAnalyticsSink } from "@repo/backend/scripts/content/acceptance/analytics";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { leaseLocalRuntime } from "@repo/backend/scripts/content/acceptance/lease";
import {
  discardSignedResponses,
  initializeLocalRuntime,
  leaseReservedLocalRuntime,
  localApplicationEnvironment,
  releaseLocalRuntime,
  reserveLocalRuntime,
} from "@repo/backend/scripts/content/acceptance/local";
import {
  runBuildCommand,
  withLocalBackend,
} from "@repo/backend/scripts/content/acceptance/process";
import { publishAcceptanceSource } from "@repo/backend/scripts/content/acceptance/publication";
import { Effect, Exit, Option } from "effect";

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

/**
 * Convex runs functions on dedicated hosts, but acceptance shares one machine
 * between the local backend and the app. The build runs below the backend's
 * CPU priority so prerender workers cannot starve queries past Convex's
 * one-second limit, while the served app keeps normal priority for browsers.
 *
 * The build calls Turborepo directly. The root build script runs the policy
 * checks first, which prove nothing about the built app, and every CI leg
 * would repeat what the Quality job already runs on the same commit.
 * @see https://man7.org/linux/man-pages/man1/nice.1.html
 */
const applicationCommands = {
  build: ["nice", "-n", "10", "pnpm", "exec", "turbo", "run", "build"],
  start: ["pnpm", "run", "start"],
} as const;

/** Starts only the owned native database for a normal app build or start. */
export const runAcceptance = Effect.fn("acceptance.run")(function* (
  root: string,
  operation: "build" | "start",
  args: readonly string[]
) {
  const reserved = yield* leaseReservedLocalRuntime(root);
  if (Option.isNone(reserved)) {
    return yield* acceptanceRuntimeError(
      "Run pnpm acceptance:prepare before building or starting acceptance."
    );
  }
  const runtime = reserved.value;
  const command = runBuildCommand(
    root,
    [...applicationCommands[operation], ...args],
    localApplicationEnvironment(runtime)
  );
  if (operation === "build") {
    // The cache is cleared once the backend is ready, right before the build
    // reads it, so nothing written while the backend started can survive.
    return yield* withLocalBackend(
      runtime,
      discardSignedResponses(root).pipe(Effect.andThen(command))
    );
  }
  // The served app proxies analytics to the stand-in reserved at prepare. It
  // claims its port first, so an occupied port fails before Convex starts.
  return yield* withAnalyticsSink(
    runtime.analytics,
    withLocalBackend(runtime, command)
  );
}, Effect.scoped);
