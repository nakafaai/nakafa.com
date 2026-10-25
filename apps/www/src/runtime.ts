import {
  CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
  isProtectedProduction,
} from "@repo/backend/content/deployment";
import { readEnvironment } from "@repo/utilities/env";
import { DeployStageSchema, deployStageKeys } from "@repo/utilities/stage";
import { Effect, Schema } from "effect";

/** The deploy identity: the Alchemy stage that the stack binds when it deploys this Worker. */
const DeployIdentitySchema = Schema.Struct({
  stage: DeployStageSchema,
});

const FailureSchema = Schema.Literals([
  "anonymous-production",
  "invalid-target",
  "mixed-production",
  "untrusted-production",
]);
type Failure = typeof FailureSchema.Type;

const messages = {
  "anonymous-production":
    "Anonymous Convex Agent Mode cannot use the production content runtime.",
  "invalid-target": "The content runtime build target must use valid URLs.",
  "mixed-production":
    "The content runtime query and HTTP targets cannot mix deployments.",
  "untrusted-production":
    "Production content is restricted to the protected production stage. Use an isolated Convex deployment for local builds.",
} satisfies Record<Failure, string>;

/** One server process attempted to cross the protected production-content seam. */
export class UnsafeRuntimeError extends Schema.TaggedError<UnsafeRuntimeError>()(
  "UnsafeRuntimeError",
  { reason: FailureSchema }
) {
  get message() {
    return messages[this.reason];
  }
}

const RuntimeTargetSchema = Schema.Struct({
  agent: Schema.UndefinedOr(Schema.Literal("anonymous")),
  query: Schema.String,
  site: Schema.UndefinedOr(Schema.String),
  deploy: DeployIdentitySchema,
});
type RuntimeTarget = typeof RuntimeTargetSchema.Type;

function failure(reason: Failure) {
  return new UnsafeRuntimeError({ reason });
}

function normalize(hostname: string) {
  return hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
}

function isLoopback(hostname: string) {
  return (
    hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "localhost"
  );
}

function decode(value: string) {
  return Effect.try({
    catch: () => failure("invalid-target"),
    try: () => new URL(value),
  }).pipe(
    Effect.filterOrFail(
      (url) =>
        url.username.length === 0 &&
        url.password.length === 0 &&
        url.hostname.length > 0 &&
        (url.protocol === "https:" ||
          (url.protocol === "http:" && isLoopback(normalize(url.hostname)))),
      () => failure("invalid-target")
    )
  );
}

function deployment(hostname: string, suffix: string) {
  if (!hostname.endsWith(suffix)) {
    return;
  }
  const name = hostname.slice(0, -suffix.length);
  return name.length === 0 || name.includes(".") ? undefined : name;
}

function isLoopbackPair(query: string, site: string | undefined) {
  return isLoopback(query) && (site === undefined || isLoopback(site));
}

const validateProtectedTarget = Effect.fn(
  "www.runtime.validateProtectedTarget"
)(function* (
  target: RuntimeTarget,
  queryDeployment: string | undefined,
  siteDeployment: string | undefined
) {
  if (target.agent === "anonymous") {
    return yield* failure("anonymous-production");
  }
  if (
    queryDeployment !== CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT ||
    (target.site !== undefined &&
      siteDeployment !== CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT)
  ) {
    return yield* failure("untrusted-production");
  }
});

/** Blocks production-backed app commands before route discovery begins. */
export const assertRuntimeTarget = Effect.fn("www.runtime.assertTarget")(
  function* (target: RuntimeTarget) {
    const queryUrl = yield* decode(target.query);
    const siteUrl =
      target.site === undefined ? undefined : yield* decode(target.site);
    const queryHost = normalize(queryUrl.hostname);
    const siteHost =
      siteUrl === undefined ? undefined : normalize(siteUrl.hostname);
    const queryDeployment = deployment(queryHost, ".convex.cloud");
    const siteDeployment =
      siteHost === undefined ? undefined : deployment(siteHost, ".convex.site");

    if (isProtectedProduction(target.deploy)) {
      return yield* validateProtectedTarget(
        target,
        queryDeployment,
        siteDeployment
      );
    }

    const queryIsProduction =
      queryDeployment === CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT;
    const siteIsProduction =
      siteDeployment === CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT;
    if (
      (siteHost !== undefined && queryIsProduction !== siteIsProduction) ||
      (queryDeployment !== undefined &&
        siteDeployment !== undefined &&
        queryDeployment !== siteDeployment)
    ) {
      return yield* failure("mixed-production");
    }
    if (target.agent === "anonymous") {
      if (isLoopbackPair(queryHost, siteHost)) {
        return;
      }
      return yield* failure("anonymous-production");
    }
    if (
      isLoopbackPair(queryHost, siteHost) ||
      (queryDeployment !== undefined &&
        queryDeployment !== CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT &&
        (siteHost === undefined || siteDeployment === queryDeployment))
    ) {
      return;
    }
    return yield* failure("untrusted-production");
  }
);

const optionalText = Schema.UndefinedOr(Schema.String);

/** Reads and validates the content runtime used by the app configuration. */
export function readRuntimeConfig() {
  const { NAKAFA_DEPLOY_STAGE } = deployStageKeys();
  const env = readEnvironment(
    {
      CONVEX_AGENT_MODE: Schema.UndefinedOr(Schema.Literal("anonymous")),
      VITE_CONVEX_SITE_URL: optionalText,
      VITE_CONVEX_URL: Schema.String,
    },
    {
      CONVEX_AGENT_MODE: process.env.CONVEX_AGENT_MODE,
      VITE_CONVEX_SITE_URL: process.env.VITE_CONVEX_SITE_URL,
      VITE_CONVEX_URL: process.env.VITE_CONVEX_URL,
    }
  );
  const target = {
    agent: env.CONVEX_AGENT_MODE,
    query: env.VITE_CONVEX_URL,
    site: env.VITE_CONVEX_SITE_URL,
    deploy: { stage: NAKAFA_DEPLOY_STAGE },
  } satisfies RuntimeTarget;
  Effect.runSync(assertRuntimeTarget(target));
  return {
    agent: target.agent,
    query: target.query,
    site: target.site,
    stage: target.deploy.stage,
  };
}
