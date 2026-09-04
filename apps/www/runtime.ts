import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { convexKeys } from "@repo/backend/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { Effect, Schema } from "effect";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const DEPLOYMENT_PATTERN = /^dpl_[A-Za-z0-9]+$/;
const GITHUB_OWNER = "nakafaai";
const GITHUB_REPOSITORY = "nakafa.com";
const PRODUCTION_BRANCH = "main";
const PROJECT_ID = "prj_QfxvXBST46wuSTOXPn4PE32NqbF4";

interface VercelIdentity {
  readonly deployment: string | undefined;
  readonly environment: string | undefined;
  readonly git: {
    readonly branch: string | undefined;
    readonly commit: string | undefined;
    readonly owner: string | undefined;
    readonly provider: string | undefined;
    readonly repository: string | undefined;
  };
  readonly marker: "1" | undefined;
  readonly project: string | undefined;
  readonly target: string | undefined;
}

interface BuildIdentity {
  readonly query: string | undefined;
  readonly site: string | undefined;
}

function isProtectedProduction(identity: VercelIdentity) {
  return [
    identity.marker === "1",
    identity.environment === "production",
    identity.target === "production",
    identity.project === PROJECT_ID,
    identity.git.provider === "github",
    identity.git.owner === GITHUB_OWNER,
    identity.git.repository === GITHUB_REPOSITORY,
    identity.git.branch === PRODUCTION_BRANCH,
    DEPLOYMENT_PATTERN.test(identity.deployment ?? ""),
    COMMIT_PATTERN.test(identity.git.commit ?? ""),
  ].every(Boolean);
}

const FailureSchema = Schema.Literals([
  "anonymous-production",
  "invalid-target",
  "mixed-production",
  "unisolated-production",
  "untrusted-production",
]);
type Failure = Schema.Schema.Type<typeof FailureSchema>;

const messages = {
  "anonymous-production":
    "Anonymous Convex Agent Mode cannot use the production content runtime.",
  "invalid-target": "The content runtime build target must use valid URLs.",
  "mixed-production":
    "The content runtime query and HTTP targets cannot mix deployments.",
  "unisolated-production":
    "The protected Vercel build must read content from an isolated local Convex snapshot.",
  "untrusted-production":
    "Production content is restricted to the protected Vercel production build. Import the verified snapshot into isolated Convex Agent Mode for local or CI builds.",
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

export interface RuntimeTarget {
  readonly agent: "anonymous" | undefined;
  readonly build: BuildIdentity;
  readonly query: string;
  readonly site: string | undefined;
  readonly vercel: VercelIdentity;
}

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

const validateBuildIdentity = Effect.fn("www.runtime.validateBuild")(function* (
  build: BuildIdentity
) {
  if (build.query === undefined && build.site === undefined) {
    return;
  }
  if (build.query === undefined || build.site === undefined) {
    return yield* failure("unisolated-production");
  }
  const queryUrl = yield* decode(build.query);
  const siteUrl = yield* decode(build.site);
  if (
    !isLoopbackPair(normalize(queryUrl.hostname), normalize(siteUrl.hostname))
  ) {
    return yield* failure("unisolated-production");
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
    yield* validateBuildIdentity(target.build);

    if (isProtectedProduction(target.vercel)) {
      if (target.agent === "anonymous") {
        return yield* failure("anonymous-production");
      }
      if (
        queryDeployment !== CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT ||
        (siteHost !== undefined &&
          siteDeployment !== CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT)
      ) {
        return yield* failure("untrusted-production");
      }
      if (target.build.query === undefined) {
        return yield* failure("unisolated-production");
      }
      return;
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

/** Reads and validates the content runtime used by Next configuration. */
export function readRuntimeConfig() {
  const env = createEnv({
    extends: [convexKeys()],
    server: {
      CONTENT_BUILD_SITE_URL: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
      CONTENT_BUILD_URL: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
      CONVEX_AGENT_MODE: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.Literal("anonymous"))
      ),
      VERCEL: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.Literal("1"))
      ),
      VERCEL_DEPLOYMENT_ID: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
      VERCEL_ENV: Schema.toStandardSchemaV1(Schema.UndefinedOr(Schema.String)),
      VERCEL_GIT_COMMIT_REF: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
      VERCEL_GIT_COMMIT_SHA: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
      VERCEL_GIT_PROVIDER: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
      VERCEL_GIT_REPO_OWNER: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
      VERCEL_GIT_REPO_SLUG: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
      VERCEL_PROJECT_ID: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
      VERCEL_TARGET_ENV: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
    },
    client: {
      NEXT_PUBLIC_CONVEX_SITE_URL: Schema.toStandardSchemaV1(
        Schema.UndefinedOr(Schema.String)
      ),
    },
    runtimeEnv: {
      CONTENT_BUILD_SITE_URL: process.env.CONTENT_BUILD_SITE_URL,
      CONTENT_BUILD_URL: process.env.CONTENT_BUILD_URL,
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
    },
  });
  const target = {
    agent: env.CONVEX_AGENT_MODE,
    build: {
      query: env.CONTENT_BUILD_URL,
      site: env.CONTENT_BUILD_SITE_URL,
    },
    query: env.NEXT_PUBLIC_CONVEX_URL,
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
    build: target.build,
    query: target.query,
    site: target.site,
    vercel: target.vercel.marker,
  };
}
