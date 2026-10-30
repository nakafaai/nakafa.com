import type {
  WorkerLimits,
  WorkerObservability,
  WorkerPlacement,
  WorkerRouteConfig,
} from "@alchemy.run/cloudflare";
import { PRODUCTION_DEPLOY_STAGE } from "@repo/utilities/stage";
import { Array as Arr } from "effect";

/** The stage that serves staging.nakafa.com behind Cloudflare Access. */
const STAGING_STAGE = "staging";

/** The zone that holds every public hostname of Nakafa, School hosts included. */
export const NAKAFA_ZONE = "nakafa.com";

/** The only accounts that may open staging through Cloudflare Access. */
const STAGING_OWNER_EMAILS = [
  "nabilakbarazzima@gmail.com",
  "nakafaai@gmail.com",
] as const;

/**
 * Every Worker runs near the US East Convex production deployment, which
 * keeps its database round trips short.
 */
export const WORKER_PLACEMENT: WorkerPlacement = {
  mode: "targeted",
  region: "aws:us-east-1",
};

/**
 * The Cloudflare name of a Worker: `nakafa-<service>` in production and
 * `nakafa-<service>-<stage>` in every other stage. Without a name Alchemy derives
 * one with a random suffix. Alchemy plans a changed name as a replacement, which
 * cannot take over a route or custom domain the old Worker holds, so a rename of
 * a deployed Worker follows the procedure in ADR 0037.
 */
export function workerName(service: string, stage: string) {
  if (stage === PRODUCTION_DEPLOY_STAGE) {
    return `nakafa-${service}`;
  }
  return `nakafa-${service}-${stage}`;
}

/**
 * The CPU caps that stop a runaway invocation before it bills on Workers Paid
 * (ADR 0037). Each is a multiple of what the Worker used from 23 to 30 October
 * 2026 in Workers Logs, so no answer that ran then would stop:
 *
 * - web: 101,560 invocations, p99.9 660 ms, and the maximum 1,420 ms on 30 October;
 * - the relays (api, mcp, the CAS front): at most 29 ms over 430 invocations;
 * - the CAS engine: at most 608 ms over 20 solves in production, and p99.9
 *   2,736 ms over 1,400 solves on its probe stage, where a symbolic solve is the work.
 */
export const WEB_LIMITS: WorkerLimits = { cpuMs: 2000 };
export const RELAY_LIMITS: WorkerLimits = { cpuMs: 500 };
export const CAS_ENGINE_LIMITS: WorkerLimits = { cpuMs: 10_000 };

/** Workers Logs record every invocation, and nothing is sampled away. */
export const WORKER_OBSERVABILITY: WorkerObservability = {
  enabled: true,
  logs: { enabled: true, invocationLogs: true },
};

/**
 * A route for one hostname. Cloudflare sends a request to the most specific
 * matching route, so an exact host route beats the School wildcard of the web
 * Worker, and a Worker's own hostname keeps its traffic.
 */
function hostRoute(host: string): WorkerRouteConfig {
  return { pattern: `${host}/*`, zoneName: NAKAFA_ZONE };
}

/**
 * The web Worker. Production owns the apex as a custom domain and every School
 * host through one proxied wildcard route. Staging is one exact host behind
 * Access. Every other stage (a pull request, for example) gets workers.dev.
 */
export function webExposure(stage: string) {
  if (stage === PRODUCTION_DEPLOY_STAGE) {
    return {
      domain: { name: NAKAFA_ZONE, zoneName: NAKAFA_ZONE },
      routes: [{ pattern: `*.${NAKAFA_ZONE}/*`, zoneName: NAKAFA_ZONE }],
      workersDev: false,
    };
  }
  if (stage === STAGING_STAGE) {
    return {
      routes: [hostRoute(`staging.${NAKAFA_ZONE}`)],
      workersDev: false,
      access: {
        name: workerName("web", stage),
        policies: [
          {
            decision: "allow" as const,
            include: Arr.map(STAGING_OWNER_EMAILS, (email) => ({ email })),
          },
        ],
      },
    };
  }
  return { routes: [], workersDev: true };
}

/**
 * A production API or MCP Worker on its own exact host. Other stages do not
 * deploy these Workers, so they get no route.
 */
export function productionHostExposure(host: string) {
  return { routes: [hostRoute(host)], workersDev: false };
}

/**
 * The CAS front. Production serves its own host, and every other stage gets only
 * its workers.dev URL, so a probe stage never touches the zone.
 */
export function casFrontExposure(stage: string) {
  if (stage === PRODUCTION_DEPLOY_STAGE) {
    return productionHostExposure("cas.nakafa.com");
  }
  return { routes: [], workersDev: true };
}
