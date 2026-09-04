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
  readonly vercelEnvironment: string | undefined;
  readonly vercelGitCommitSha: string | undefined;
}

function buildTargetFailure(reason: BuildTargetFailureReason) {
  return new UnsafeContentRuntimeBuildTargetError({ reason });
}

function decodeTargetUrl(value: string) {
  return Effect.try({
    catch: () => buildTargetFailure("invalid-target"),
    try: () => new URL(value),
  });
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
  const usesProductionQuery =
    queryHostname === `${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud`;
  const usesProductionSite =
    siteHostname === `${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.site`;

  if (
    siteHostname !== undefined &&
    usesProductionQuery !== usesProductionSite
  ) {
    return yield* buildTargetFailure("mixed-production");
  }
  if (!(usesProductionQuery || usesProductionSite)) {
    return;
  }
  if (target.agentMode === "anonymous") {
    return yield* buildTargetFailure("anonymous-production");
  }

  const isProtectedVercelProduction =
    target.vercel === "1" &&
    target.vercelEnvironment === "production" &&
    (target.vercelGitCommitSha?.trim().length ?? 0) > 0;
  if (!isProtectedVercelProduction) {
    return yield* buildTargetFailure("untrusted-production");
  }
});
