import { providers, state, Website } from "@alchemy.run/cloudflare";
import { Stack, Stage } from "alchemy";
import { Effect, Schema } from "effect";
import { deployedWorkerBindings, workerSettings } from "#www/worker";

/**
 * The Alchemy stage names the deploy. A stage with no name is refused here, so a
 * deploy never reaches the Worker without the stage that decides its reporting.
 */
const DeployStageSchema = Schema.Trimmed.check(Schema.isNonEmpty());

/**
 * The Start app. Alchemy builds it with this app's own vite.config.ts, uploads the
 * client build as static assets, and makes the SSR bundle the Worker entry. The
 * React Server Components environment ships beside that entry. The runtime
 * settings and the bindings come from worker.ts, the same owner that
 * vite.config.ts reads. The bindings take the deploy stage from the stage that
 * Alchemy deploys, so the Worker's stage is never left to the deploying shell.
 */
export default Stack(
  "Nakafa",
  {
    providers: providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const deployStage = yield* Schema.decodeEffect(DeployStageSchema)(
      yield* Stage
    ).pipe(Effect.orDie);
    const web = yield* Website.Vite("Web", {
      compatibility: {
        date: workerSettings.compatibilityDate,
        flags: workerSettings.compatibilityFlags,
      },
      env: deployedWorkerBindings(deployStage),
      viteEnvironments: workerSettings.viteEnvironments,
    });

    return { url: web.url.as<string>() };
  })
);
