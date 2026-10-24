import { providers, state, Website } from "@alchemy.run/cloudflare";
import { Stack } from "alchemy";
import { Effect } from "effect";
import { deployedWorkerBindings, workerSettings } from "#www/worker";

/**
 * The Start app. Alchemy builds it with this app's own vite.config.ts, uploads the
 * client build as static assets, and makes the SSR bundle the Worker entry. The
 * React Server Components environment ships beside that entry. The runtime
 * settings and the bindings come from worker.ts, the same owner that
 * vite.config.ts reads.
 */
const Web = Website.Vite("Web", {
  compatibility: {
    date: workerSettings.compatibilityDate,
    flags: workerSettings.compatibilityFlags,
  },
  env: deployedWorkerBindings(),
  viteEnvironments: workerSettings.viteEnvironments,
});

export default Stack(
  "Nakafa",
  {
    providers: providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const web = yield* Web;

    return { url: web.url.as<string>() };
  })
);
