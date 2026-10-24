import { providers, state, Website, Worker } from "@alchemy.run/cloudflare";
import { PRODUCTION_DEPLOY_STAGE } from "@repo/utilities/stage";
import { RemovalPolicy, Stack, Stage } from "alchemy";
import { Effect } from "effect";
import { requireNonEmptyBindings } from "#www/deploy/bindings";
import { deployNakafaBots } from "#www/deploy/bots";
import { deployNakafaDns, deployNakafaIdZone } from "#www/deploy/dns";
import { edgeWorkerBindings } from "#www/deploy/edge";
import {
  productionHostExposure,
  WORKER_OBSERVABILITY,
  WORKER_PLACEMENT,
  webExposure,
} from "#www/deploy/stage";
import {
  deployedWorkerBindings,
  workerEnvironment,
  workerSettings,
} from "#www/worker";

/**
 * The Nakafa stack. The stage decides who reaches the web Worker: production
 * serves nakafa.com and every School host and owns the zone's records, staging
 * serves staging.nakafa.com behind Cloudflare Access, and any other stage gets
 * only its workers.dev URL.
 *
 * Alchemy builds the app with this app's own vite.config.ts, uploads the client
 * build as static assets, and makes the SSR bundle the Worker entry. The runtime
 * settings and the bindings come from worker.ts, the same owner that
 * vite.config.ts reads. Every Worker binds the stage it deploys as
 * NAKAFA_DEPLOY_STAGE, which is the production identity of the runtime.
 *
 * Production Workers and the DNS records are retained: a stack change that drops
 * one leaves the cloud object in place, and never deletes it.
 */
export default Stack(
  "Nakafa",
  {
    providers: providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;
    const isProduction = stage === PRODUCTION_DEPLOY_STAGE;

    // An empty bound value fails the deploy here, before any Worker changes.
    yield* requireNonEmptyBindings(workerEnvironment());

    // Production declares the zones first: the web Worker attaches nakafa.com by zone name.
    if (isProduction) {
      const zone = yield* deployNakafaDns().pipe(RemovalPolicy.retain());
      yield* deployNakafaBots(zone).pipe(RemovalPolicy.retain());
      yield* deployNakafaIdZone().pipe(RemovalPolicy.retain());
    }

    const web = yield* Website.Vite("Web", {
      compatibility: {
        date: workerSettings.compatibilityDate,
        flags: workerSettings.compatibilityFlags,
      },
      env: { ...deployedWorkerBindings(), NAKAFA_DEPLOY_STAGE: stage },
      viteEnvironments: workerSettings.viteEnvironments,
      observability: WORKER_OBSERVABILITY,
      placement: WORKER_PLACEMENT,
      ...webExposure(stage),
    }).pipe(RemovalPolicy.retain(isProduction));

    if (isProduction) {
      yield* Worker("Api", {
        main: "../api/worker.ts",
        assets: "../api/public",
        compatibility: { date: workerSettings.compatibilityDate },
        env: edgeWorkerBindings("NAKAFA_API_EDGE_SECRET"),
        observability: WORKER_OBSERVABILITY,
        placement: WORKER_PLACEMENT,
        ...productionHostExposure("api.nakafa.com"),
      }).pipe(RemovalPolicy.retain());
      yield* Worker("Mcp", {
        main: "../mcp/worker.ts",
        assets: "../mcp/public",
        compatibility: { date: workerSettings.compatibilityDate },
        env: edgeWorkerBindings("NAKAFA_MCP_EDGE_SECRET"),
        observability: WORKER_OBSERVABILITY,
        placement: WORKER_PLACEMENT,
        ...productionHostExposure("mcp.nakafa.com"),
      }).pipe(RemovalPolicy.retain());
    }

    return { url: web.url.as<string>() };
  })
);
