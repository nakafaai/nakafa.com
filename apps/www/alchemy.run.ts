import { providers, state, Website, Worker } from "@alchemy.run/cloudflare";
import { PRODUCTION_DEPLOY_STAGE } from "@repo/utilities/stage";
import { RemovalPolicy, Stack, Stage } from "alchemy";
import { Effect } from "effect";
import { deployNakafaBots } from "#www/deploy/bots";
import { deployCas } from "#www/deploy/cas";
import { deployNakafaDns, deployNakafaIdZone } from "#www/deploy/dns";
import { edgeWorkerBindings } from "#www/deploy/edge";
import { readActiveContentRelease } from "#www/deploy/release";
import {
  productionHostExposure,
  WORKER_OBSERVABILITY,
  WORKER_PLACEMENT,
  webExposure,
  workerName,
} from "#www/deploy/stage";
import { deployedWorkerBindings, workerSettings } from "#www/worker";

/**
 * The Nakafa stack. The stage decides who reaches the web Worker: production
 * serves nakafa.com and every School host and owns the zone's records, staging
 * serves staging.nakafa.com behind Cloudflare Access, and any other stage gets
 * only its workers.dev URL. The CAS math service deploys in every stage, and
 * production gives it cas.nakafa.com.
 *
 * Alchemy builds the app with this app's own vite.config.ts, uploads the client
 * build as static assets, and makes the SSR bundle the Worker entry. The runtime
 * settings and the bindings come from worker.ts, the same owner that
 * vite.config.ts reads. Every Worker binds the stage it deploys as
 * NAKAFA_DEPLOY_STAGE, which is the production identity of the runtime, and
 * takes its readable name from workerName. The web Worker also binds the active
 * content release as NAKAFA_CONTENT_RELEASE: Alchemy rebuilds a Vite Worker only
 * when its files or its bindings change, so an activation's deploy of an unchanged
 * commit rebuilds the static pages of the new release (ADR 0038 D8).
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

    // Reads every bound value before any resource changes, so a required value that a reader refuses fails the deploy here.
    const bindings = deployedWorkerBindings();
    // The stack's program fails only on configuration, so a release that cannot be
    // read ends the deploy with its whole cause before any resource changes.
    const release = yield* readActiveContentRelease().pipe(Effect.orDie);

    // Production declares the zones first: the web Worker attaches nakafa.com by zone name.
    if (isProduction) {
      const zone = yield* deployNakafaDns().pipe(RemovalPolicy.retain());
      yield* deployNakafaBots(zone).pipe(RemovalPolicy.retain());
      yield* deployNakafaIdZone().pipe(RemovalPolicy.retain());
    }

    const web = yield* Website.Vite("Web", {
      name: workerName("web", stage),
      // A path with no asset reaches the Worker, a browser navigation included
      // (worker.ts names the flag and the asset settings).
      assets: workerSettings.assets,
      compatibility: {
        date: workerSettings.compatibilityDate,
        flags: workerSettings.compatibilityFlags,
      },
      env: {
        ...bindings,
        NAKAFA_CONTENT_RELEASE: release,
        NAKAFA_DEPLOY_STAGE: stage,
      },
      viteEnvironments: workerSettings.viteEnvironments,
      observability: WORKER_OBSERVABILITY,
      placement: WORKER_PLACEMENT,
      ...webExposure(stage),
    }).pipe(RemovalPolicy.retain(isProduction));

    if (isProduction) {
      yield* Worker("Api", {
        name: workerName("api", stage),
        main: "../api/worker.ts",
        assets: "../api/public",
        compatibility: { date: workerSettings.compatibilityDate },
        env: edgeWorkerBindings("NAKAFA_API_EDGE_SECRET"),
        observability: WORKER_OBSERVABILITY,
        placement: WORKER_PLACEMENT,
        ...productionHostExposure("api.nakafa.com"),
      }).pipe(RemovalPolicy.retain());
      yield* Worker("Mcp", {
        name: workerName("mcp", stage),
        main: "../mcp/worker.ts",
        assets: "../mcp/public",
        compatibility: { date: workerSettings.compatibilityDate },
        env: edgeWorkerBindings("NAKAFA_MCP_EDGE_SECRET"),
        observability: WORKER_OBSERVABILITY,
        placement: WORKER_PLACEMENT,
        ...productionHostExposure("mcp.nakafa.com"),
      }).pipe(RemovalPolicy.retain());
    }

    yield* deployCas(stage, isProduction);

    return { url: web.url.as<string>() };
  })
);
