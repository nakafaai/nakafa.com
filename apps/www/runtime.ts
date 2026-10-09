import {
  CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
  isProtectedProduction,
} from "@repo/backend/content/deployment";
import { convexKeys } from "@repo/backend/keys";
import { InvalidEnvironmentError } from "@repo/utilities/env";
import { Config, ConfigProvider, Effect, Schema } from "effect";

const VercelIdentitySchema = Schema.Struct({
  deployment: Schema.UndefinedOr(Schema.String),
  environment: Schema.UndefinedOr(Schema.String),
  git: Schema.Struct({
    branch: Schema.UndefinedOr(Schema.String),
    commit: Schema.UndefinedOr(Schema.String),
    owner: Schema.UndefinedOr(Schema.String),
    provider: Schema.UndefinedOr(Schema.String),
    repository: Schema.UndefinedOr(Schema.String),
  }),
  marker: Schema.UndefinedOr(Schema.Literal("1")),
  project: Schema.UndefinedOr(Schema.String),
  target: Schema.UndefinedOr(Schema.String),
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
    "Production content is restricted to the protected Vercel production build. Use an isolated Convex deployment for local or CI builds.",
} satisfies Record<Failure, string>;

/** One Next process attempted to cross the protected production-content seam. */
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
  vercel: VercelIdentitySchema,
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

/** Blocks production-backed Next commands before route discovery begins. */
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

    if (isProtectedProduction(target.vercel)) {
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
const runtimeEnvConfig = {
  CONVEX_AGENT_MODE: Config.schema(
    Schema.UndefinedOr(Schema.Literal("anonymous")),
    "CONVEX_AGENT_MODE"
  ),
  NEXT_PUBLIC_CONVEX_SITE_URL: Config.schema(
    optionalText,
    "NEXT_PUBLIC_CONVEX_SITE_URL"
  ),
  VERCEL: Config.schema(Schema.UndefinedOr(Schema.Literal("1")), "VERCEL"),
  VERCEL_DEPLOYMENT_ID: Config.schema(optionalText, "VERCEL_DEPLOYMENT_ID"),
  VERCEL_ENV: Config.schema(optionalText, "VERCEL_ENV"),
  VERCEL_GIT_COMMIT_REF: Config.schema(optionalText, "VERCEL_GIT_COMMIT_REF"),
  VERCEL_GIT_COMMIT_SHA: Config.schema(optionalText, "VERCEL_GIT_COMMIT_SHA"),
  VERCEL_GIT_PROVIDER: Config.schema(optionalText, "VERCEL_GIT_PROVIDER"),
  VERCEL_GIT_REPO_OWNER: Config.schema(optionalText, "VERCEL_GIT_REPO_OWNER"),
  VERCEL_GIT_REPO_SLUG: Config.schema(optionalText, "VERCEL_GIT_REPO_SLUG"),
  VERCEL_PROJECT_ID: Config.schema(optionalText, "VERCEL_PROJECT_ID"),
  VERCEL_TARGET_ENV: Config.schema(optionalText, "VERCEL_TARGET_ENV"),
};

/** Reads and validates the content runtime used by Next configuration. */
export function readRuntimeConfig() {
  const convex = convexKeys();
  const values = {
    CONVEX_AGENT_MODE: process.env.CONVEX_AGENT_MODE,
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    VERCEL: process.env.VERCEL,
    VERCEL_DEPLOYMENT_ID: process.env.VERCEL_DEPLOYMENT_ID,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    VERCEL_GIT_PROVIDER: process.env.VERCEL_GIT_PROVIDER,
    VERCEL_GIT_REPO_OWNER: process.env.VERCEL_GIT_REPO_OWNER,
    VERCEL_GIT_REPO_SLUG: process.env.VERCEL_GIT_REPO_SLUG,
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
    VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
  } satisfies Record<keyof typeof runtimeEnvConfig, string | undefined>;
  const env = Effect.runSync(
    Config.all(runtimeEnvConfig)
      .parse(ConfigProvider.fromUnknown(values, { preserveEmptyStrings: true }))
      .pipe(
        Effect.mapError(
          (error) => new InvalidEnvironmentError({ details: error.message })
        )
      )
  );
  const target = {
    agent: env.CONVEX_AGENT_MODE,
    query: convex.NEXT_PUBLIC_CONVEX_URL,
    site: env.NEXT_PUBLIC_CONVEX_SITE_URL,
    vercel: {
      deployment: env.VERCEL_DEPLOYMENT_ID,
      environment: env.VERCEL_ENV,
      git: {
        branch: env.VERCEL_GIT_COMMIT_REF,
        commit: env.VERCEL_GIT_COMMIT_SHA,
        owner: env.VERCEL_GIT_REPO_OWNER,
        provider: env.VERCEL_GIT_PROVIDER,
        repository: env.VERCEL_GIT_REPO_SLUG,
      },
      marker: env.VERCEL,
      project: env.VERCEL_PROJECT_ID,
      target: env.VERCEL_TARGET_ENV,
    },
  } satisfies RuntimeTarget;
  Effect.runSync(assertRuntimeTarget(target));
  return {
    agent: target.agent,
    query: target.query,
    site: target.site,
    vercel: target.vercel.marker,
  };
}
