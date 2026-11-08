import type { ConvexCall } from "@repo/backend/scripts/content/acceptance/convex";
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
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Effect, Layer, Schema, String as Str } from "effect";
import { SecureRandom } from "effect/crypto";
import { ChildProcessSpawner } from "effect/process";

/** The arguments of the Convex CLI's `run` for one call. */
const cliArgumentsOf = (call: typeof ConvexCall.Type) => [
  "run",
  ...(call.component === undefined ? [] : ["--component", call.component]),
  ...(call.identity === undefined
    ? []
    : ["--identity", encodeJsonText(call.identity)]),
  call.path,
  encodeJsonText(call.args),
];

/** What the Convex CLI printed for a call, as its value. The CLI prints nothing for a null result. */
const answerOf = (printed: string) =>
  Str.isEmpty(Str.trim(printed))
    ? Effect.succeed(null)
    : Schema.decodeEffect(JsonTextSchema)(printed);

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
      (operation, call, sensitiveValues) =>
        runConvex(operation, cliArgumentsOf(call), sensitiveValues).pipe(
          Effect.mapError(asGateFailure),
          Effect.flatMap((printed) =>
            answerOf(printed).pipe(
              Effect.mapError(() =>
                gateError(`${operation} printed no JSON value.`)
              )
            )
          ),
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
