import type {
  WorkerAccessConfig,
  WorkerDomainConfig,
  WorkerObservability,
  WorkerPlacement,
  WorkerRouteConfig,
} from "@alchemy.run/cloudflare";

/** The stage that serves nakafa.com to every visitor. */
export const PRODUCTION_STAGE = "prod";

/** The stage that serves staging.nakafa.com behind Cloudflare Access. */
export const STAGING_STAGE = "staging";

/** The zone that holds every public hostname of Nakafa, School hosts included. */
export const NAKAFA_ZONE = "nakafa.com";

/** The only accounts that may open staging through Cloudflare Access. */
export const STAGING_OWNER_EMAILS = [
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

/** Workers Logs record every invocation, and nothing is sampled away. */
export const WORKER_OBSERVABILITY: WorkerObservability = {
  enabled: true,
  logs: { enabled: true, invocationLogs: true },
};

/** How one Worker is reachable from the internet at one stage. */
export interface WorkerExposure {
  access?: WorkerAccessConfig;
  domain?: WorkerDomainConfig;
  routes: WorkerRouteConfig[];
  workersDev: boolean;
}

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
export function webExposure(stage: string): WorkerExposure {
  if (stage === PRODUCTION_STAGE) {
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
        policies: [
          {
            decision: "allow",
            include: STAGING_OWNER_EMAILS.map((email) => ({ email })),
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
export function productionHostExposure(host: string): WorkerExposure {
  return { routes: [hostRoute(host)], workersDev: false };
}
