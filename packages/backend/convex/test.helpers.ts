import aggregateTest from "@convex-dev/aggregate/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import posthogTest from "@posthog/convex/test";
import {
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import { components } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/convex/credits/constants";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import aggregateSchema from "@repo/backend/node_modules/@convex-dev/aggregate/src/component/schema";
import { convexTest, type TestConvex } from "convex-test";

const betterAuthModules = import.meta.glob(["./betterAuth/**/*.ts"]);
const aggregateModules = import.meta.glob([
  "../node_modules/@convex-dev/aggregate/src/component/**/*.ts",
]);
const DEFAULT_SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Registers the learning popularity ranking aggregate in tests that exercise
 * ranked counter writes or queries without booting the full app deployment.
 */
export function registerLearningPopularityAggregate(
  t: TestConvex<typeof schema>
) {
  aggregateTest.register(t, "learningPopularityRankings");
}

/** Builds a Convex test instance with the Better Auth component registered. */
export function createConvexTestWithBetterAuth() {
  const t = convexTest(schema, convexModules);
  t.registerComponent("betterAuth", authSchema, betterAuthModules);
  t.registerComponent(
    "forumPostsByAuthorSequence",
    aggregateSchema,
    aggregateModules
  );
  t.registerComponent(
    "forumPostsBySequence",
    aggregateSchema,
    aggregateModules
  );
  registerLearningPopularityAggregate(t);
  rateLimiterTest.register(t, "agentRateLimiter");
  posthogTest.register(t);
  return t;
}

/** Seeds one analytics decision with matching current and provenance state. */
export async function seedAnalyticsConsent(
  ctx: MutationCtx,
  {
    decidedAt,
    granted = true,
    userId,
  }: {
    decidedAt: number;
    granted?: boolean;
    userId: Doc<"users">["_id"];
  }
) {
  const decision = {
    category: ANALYTICS_CONSENT_CATEGORY,
    decidedAt,
    granted,
    mechanism: ANALYTICS_CONSENT_MECHANISM,
    noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
    userId,
  };

  await ctx.db.insert("accountConsentDecisions", decision);

  return await ctx.db.insert("accountConsents", decision);
}

/** Seeds one authenticated Better Auth user and the matching app user row. */
export async function seedAuthenticatedUser(
  ctx: MutationCtx,
  {
    now,
    suffix = "test-user",
    credits = DEFAULT_USER_CREDITS,
    creditsResetAt = now,
    email = `${suffix}@example.com`,
    name = `User ${suffix}`,
    plan = DEFAULT_USER_PLAN,
    role,
    sessionDurationMs = DEFAULT_SESSION_DURATION_MS,
    sessionToken = `session-${suffix}`,
  }: {
    credits?: Doc<"users">["credits"];
    creditsResetAt?: Doc<"users">["creditsResetAt"];
    email?: Doc<"users">["email"];
    name?: Doc<"users">["name"];
    now: number;
    plan?: Doc<"users">["plan"];
    role?: Doc<"users">["role"];
    sessionDurationMs?: number;
    sessionToken?: string;
    suffix?: string;
  }
) {
  const authUser = await ctx.runMutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        createdAt: now,
        email,
        emailVerified: true,
        name,
        updatedAt: now,
      },
    },
    select: ["_id", "email", "name"],
  });
  const session = await ctx.runMutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        createdAt: now,
        expiresAt: now + sessionDurationMs,
        token: sessionToken,
        updatedAt: now,
        userId: authUser._id,
      },
    },
    select: ["_id"],
  });

  const userId = await ctx.db.insert("users", {
    authId: authUser._id,
    credits,
    creditsResetAt,
    email: authUser.email,
    name: authUser.name,
    plan,
    ...(role ? { role } : {}),
  });

  return {
    authUserId: authUser._id,
    sessionId: session._id,
    userId,
  };
}
