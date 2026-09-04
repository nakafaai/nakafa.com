import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { Effect, Schema } from "effect";

const BuildTargetFailureReasonSchema = Schema.Literals([
  "anonymous-production",
  "invalid-target",
  "mixed-production",
  "untrusted-production",
]);
type BuildTargetFailureReason = Schema.Schema.Type<
  typeof BuildTargetFailureReasonSchema
>;

const buildTargetFailureMessages = {
  "anonymous-production":
    "Anonymous Convex Agent Mode cannot use the production content runtime.",
  "invalid-target":
    "The content runtime build target must use valid Convex URLs.",
  "mixed-production":
    "The content runtime query and HTTP targets cannot mix production with another deployment.",
  "untrusted-production":
    "Production content is restricted to the protected Vercel production build. Import the verified snapshot into isolated Convex Agent Mode for local or CI builds.",
} satisfies Record<BuildTargetFailureReason, string>;

const NAKAFA_GITHUB_OWNER = "nakafaai";
const NAKAFA_GITHUB_REPOSITORY = "nakafa.com";
const NAKAFA_PRODUCTION_BRANCH = "main";
const NAKAFA_WWW_VERCEL_PROJECT_ID = "prj_QfxvXBST46wuSTOXPn4PE32NqbF4";
const VERCEL_DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;
const GIT_COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

/** One Next process attempted to cross the protected production-content seam. */
export class UnsafeContentRuntimeBuildTargetError extends Schema.TaggedError<UnsafeContentRuntimeBuildTargetError>()(
  "UnsafeContentRuntimeBuildTargetError",
  {
    reason: BuildTargetFailureReasonSchema,
  }
) {
  get message() {
    return buildTargetFailureMessages[this.reason];
  }
}

export interface ContentRuntimeBuildTarget {
  readonly agentMode: "anonymous" | undefined;
  readonly convexSiteUrl: string | undefined;
  readonly convexUrl: string;
  readonly vercel: "1" | undefined;
  readonly vercelDeploymentId: string | undefined;
  readonly vercelEnvironment: string | undefined;
  readonly vercelGitCommitRef: string | undefined;
  readonly vercelGitCommitSha: string | undefined;
  readonly vercelGitProvider: string | undefined;
  readonly vercelGitRepoOwner: string | undefined;
  readonly vercelGitRepoSlug: string | undefined;
  readonly vercelProjectId: string | undefined;
  readonly vercelTargetEnvironment: string | undefined;
}

function buildTargetFailure(reason: BuildTargetFailureReason) {
  return new UnsafeContentRuntimeBuildTargetError({ reason });
}

function decodeTargetUrl(value: string) {
  return Effect.try({
    catch: () => buildTargetFailure("invalid-target"),
    try: () => new URL(value),
  }).pipe(
    Effect.filterOrFail(
      (url) =>
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.username.length === 0 &&
        url.password.length === 0 &&
        url.hostname.length > 0,
      () => buildTargetFailure("invalid-target")
    )
  );
}

function deploymentFromHostname(hostname: string, suffix: string) {
  if (!hostname.endsWith(suffix)) {
    return;
  }
  const deployment = hostname.slice(0, -suffix.length);
  return deployment.length === 0 || deployment.includes(".")
    ? undefined
    : deployment;
}

function isLoopbackHostname(hostname: string) {
  return (
    hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "localhost"
  );
}

function isProtectedVercelProduction(target: ContentRuntimeBuildTarget) {
  return (
    target.vercel === "1" &&
    target.vercelEnvironment === "production" &&
    target.vercelTargetEnvironment === "production" &&
    target.vercelProjectId === NAKAFA_WWW_VERCEL_PROJECT_ID &&
    target.vercelGitProvider === "github" &&
    target.vercelGitRepoOwner === NAKAFA_GITHUB_OWNER &&
    target.vercelGitRepoSlug === NAKAFA_GITHUB_REPOSITORY &&
    target.vercelGitCommitRef === NAKAFA_PRODUCTION_BRANCH &&
    GIT_COMMIT_SHA_PATTERN.test(target.vercelGitCommitSha ?? "") &&
    VERCEL_DEPLOYMENT_ID_PATTERN.test(target.vercelDeploymentId ?? "")
  );
}

function isIsolatedLoopbackTarget(
  queryHostname: string,
  siteHostname: string | undefined
) {
  return (
    isLoopbackHostname(queryHostname) &&
    (siteHostname === undefined || isLoopbackHostname(siteHostname))
  );
}

function isTaskOwnedConvexCloudTarget(
  queryHostname: string,
  siteHostname: string | undefined
) {
  const queryDeployment = deploymentFromHostname(
    queryHostname,
    ".convex.cloud"
  );
  const siteDeployment =
    siteHostname === undefined
      ? undefined
      : deploymentFromHostname(siteHostname, ".convex.site");
  return (
    queryDeployment !== undefined &&
    queryDeployment !== CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT &&
    (siteHostname === undefined || siteDeployment === queryDeployment)
  );
}

function usesDefaultProductionDeployment(
  queryHostname: string,
  siteHostname: string | undefined
) {
  return {
    query:
      deploymentFromHostname(queryHostname, ".convex.cloud") ===
      CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
    site:
      siteHostname !== undefined &&
      deploymentFromHostname(siteHostname, ".convex.site") ===
        CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
  };
}

function hasMixedDefaultDeployments(
  queryHostname: string,
  siteHostname: string | undefined
) {
  if (siteHostname === undefined) {
    return false;
  }
  const queryDeployment = deploymentFromHostname(
    queryHostname,
    ".convex.cloud"
  );
  const siteDeployment = deploymentFromHostname(siteHostname, ".convex.site");
  return (
    queryDeployment !== undefined &&
    siteDeployment !== undefined &&
    queryDeployment !== siteDeployment
  );
}

function normalizeConvexHostname(hostname: string) {
  return hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
}

/**
 * Prevents local, PR, and preview Next commands from traversing production.
 * This applies to dev, start, type generation, and build configuration loads.
 *
 * Vercel's main-only production build remains the temporary trusted consumer
 * until it also imports the immutable release snapshot.
 */
export const assertContentRuntimeBuildTarget = Effect.fn(
  "www.contentRuntime.assertBuildTarget"
)(function* (target: ContentRuntimeBuildTarget) {
  const convexUrl = yield* decodeTargetUrl(target.convexUrl);
  const convexSiteUrl =
    target.convexSiteUrl === undefined
      ? undefined
      : yield* decodeTargetUrl(target.convexSiteUrl);
  const queryHostname = normalizeConvexHostname(convexUrl.hostname);
  const siteHostname =
    convexSiteUrl === undefined
      ? undefined
      : normalizeConvexHostname(convexSiteUrl.hostname);
  const usesProduction = usesDefaultProductionDeployment(
    queryHostname,
    siteHostname
  );

  if (
    (siteHostname !== undefined &&
      usesProduction.query !== usesProduction.site) ||
    hasMixedDefaultDeployments(queryHostname, siteHostname)
  ) {
    return yield* buildTargetFailure("mixed-production");
  }
  if (isProtectedVercelProduction(target)) {
    if (target.agentMode === "anonymous") {
      return yield* buildTargetFailure("anonymous-production");
    }
    return;
  }
  if (target.agentMode === "anonymous") {
    if (isIsolatedLoopbackTarget(queryHostname, siteHostname)) {
      return;
    }
    return yield* buildTargetFailure("anonymous-production");
  }
  if (
    isIsolatedLoopbackTarget(queryHostname, siteHostname) ||
    isTaskOwnedConvexCloudTarget(queryHostname, siteHostname)
  ) {
    return;
  }
  return yield* buildTargetFailure("untrusted-production");
});
