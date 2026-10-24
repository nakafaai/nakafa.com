import { providers, state, Website, Worker } from "@alchemy.run/cloudflare";
import { Stack, Stage } from "alchemy";
import { Effect } from "effect";
import { deployNakafaDns } from "#www/deploy/dns";
import { edgeWorkerBindings } from "#www/deploy/edge";
import {
  PRODUCTION_STAGE,
  productionHostExposure,
  WORKER_OBSERVABILITY,
  WORKER_PLACEMENT,
  webExposure,
} from "#www/deploy/stage";
import { deployedWorkerBindings, workerSettings } from "#www/worker";

/**
 * The Nakafa stack. The stage decides who reaches the web Worker: production
 * serves nakafa.com and every School host and owns the zone's records, staging
 * serves staging.nakafa.com behind Cloudflare Access, and any other stage gets
 * only its workers.dev URL.
 *
 * Alchemy builds the app with this app's own vite.config.ts, uploads the client
 * build as static assets, and makes the SSR bundle the Worker entry. The runtime
 * settings and the bindings come from worker.ts, the same owner that
 * vite.config.ts reads.
 */
export default Stack(
  "Nakafa",
  {
    providers: providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;

    const web = yield* Website.Vite("Web", {
      compatibility: {
        date: workerSettings.compatibilityDate,
        flags: workerSettings.compatibilityFlags,
      },
      env: deployedWorkerBindings(),
      viteEnvironments: workerSettings.viteEnvironments,
      observability: WORKER_OBSERVABILITY,
      placement: WORKER_PLACEMENT,
      ...webExposure(stage),
    });

    if (stage === PRODUCTION_STAGE) {
      yield* deployNakafaDns();

      yield* Worker("Api", {
        main: "../api/worker.ts",
        assets: "../api/public",
        compatibility: { date: workerSettings.compatibilityDate },
        env: edgeWorkerBindings("NAKAFA_API_EDGE_SECRET"),
        observability: WORKER_OBSERVABILITY,
        placement: WORKER_PLACEMENT,
        ...productionHostExposure("api.nakafa.com"),
      });
      yield* Worker("Mcp", {
        main: "../mcp/worker.ts",
        assets: "../mcp/public",
        compatibility: { date: workerSettings.compatibilityDate },
        env: edgeWorkerBindings("NAKAFA_MCP_EDGE_SECRET"),
        observability: WORKER_OBSERVABILITY,
        placement: WORKER_PLACEMENT,
        ...productionHostExposure("mcp.nakafa.com"),
      });
    }

    return { url: web.url.as<string>() };
  })
);
