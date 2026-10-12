import {
  ConvexCli,
  requireDevelopment,
  runConvex,
} from "@repo/backend/scripts/nina/convex";
import {
  Deployment,
  makeDeployment,
} from "@repo/backend/scripts/nina/deployment";
import { Crypto, Effect, Layer } from "effect";
import { ChildProcessSpawner } from "effect/process";

/**
 * The deployment that the caller's configuration names, reached through the
 * Convex CLI. It refuses to exist for production or for no deployment at all,
 * so nothing in the gate can run before that check. Every command runs with the
 * settings that check returned, so the CLI goes to the deployment the check
 * looked at, and not to one that a `.env` file names.
 */
export const DeploymentLive = Layer.effect(
  Deployment,
  Effect.gen(function* () {
    const settings = yield* requireDevelopment();
    const cli = yield* ConvexCli;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const crypto = yield* Crypto.Crypto;
    return makeDeployment(
      (operation, args, sensitiveValues) =>
        runConvex(operation, args, sensitiveValues).pipe(
          Effect.provideService(ConvexCli, {
            ...cli,
            env: { ...cli.env, ...settings },
          }),
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            spawner
          )
        ),
      crypto
    );
  })
);
