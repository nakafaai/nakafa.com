import {
  ConvexCli,
  type DevelopmentCliError,
  requireDevelopment,
  runConvex,
} from "@repo/backend/scripts/development/cli";
import {
  Deployment,
  makeDeployment,
} from "@repo/backend/scripts/nina/deployment";
import { gateError } from "@repo/backend/scripts/nina/error";
import { Effect, Layer } from "effect";
import { SecureRandom } from "effect/crypto";
import { ChildProcessSpawner } from "effect/process";

/** Gives a failure of the Convex CLI the gate's own type, with the message it already has. */
const asGateFailure = (error: DevelopmentCliError) => gateError(error.message);

/**
 * The deployment that the caller's configuration names, reached through the
 * Convex CLI. It refuses to exist for production or for no deployment at all,
 * so nothing in the gate can run before that check. Every command runs with the
 * settings that check returned, so the CLI goes to the deployment the check
 * looked at, and not to one that a `.env` file names. A failure of the CLI is a
 * failure of the gate.
 */
export const DeploymentLive = Layer.effect(
  Deployment,
  Effect.gen(function* () {
    const settings = yield* requireDevelopment().pipe(
      Effect.mapError(asGateFailure)
    );
    const cli = yield* ConvexCli;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const random = yield* SecureRandom.SecureRandom;
    return makeDeployment(
      (operation, args, sensitiveValues) =>
        runConvex(operation, args, sensitiveValues).pipe(
          Effect.mapError(asGateFailure),
          Effect.provideService(ConvexCli, {
            ...cli,
            env: { ...cli.env, ...settings },
          }),
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            spawner
          )
        ),
      random
    );
  })
);
