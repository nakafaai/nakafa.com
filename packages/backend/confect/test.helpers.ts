import agentTest from "@convex-dev/agent/test";
import authTest from "@convex-dev/auth/test";
import authGoogleTest from "@convex-dev/auth/components/google/test";
import authPasswordTest from "@convex-dev/auth/components/password/test";
import authUsernameTest from "@convex-dev/auth/components/username/test";
import aggregateTest from "@convex-dev/aggregate/test";
import presenceTest from "@convex-dev/presence/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import posthogTest from "@posthog/convex/test";
import {
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import { components } from "@repo/backend/confect/_generated/components";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/confect/credits/constants";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { convexTest, type TestConvex } from "convex-test";

/** The lifetimes of a test session, as `auth/core` configures them. */
const TEST_SESSION_LIFETIMES = {
  accessTokenTtlSeconds: 15 * 60,
  refreshInactivityTimeoutSeconds: 7 * 24 * 60 * 60,
  sessionMaxLifetimeSeconds: 90 * 24 * 60 * 60,
};

/**
 * Registers the learning popularity ranking aggregate in tests that exercise
 * ranked counter writes or queries without booting the full app deployment.
 */
export function registerLearningPopularityAggregate(
  t: TestConvex<typeof schema>
) {
  aggregateTest.register(t, "learningPopularityRankings");
}

/** Builds a Convex test instance with the Convex Auth components registered. */
export function createConvexTestWithAuth() {
  const t = convexTest(schema, convexModules);
  authTest.registerCore(t);
  authGoogleTest.registerGoogleOauth(t);
  authPasswordTest.registerPassword(t);
  authUsernameTest.registerUsername(t);
  registerLearningPopularityAggregate(t);
  rateLimiterTest.register(t, "agentRateLimiter");
  agentTest.register(t, "nina");
  posthogTest.register(t);
  presenceTest.register(t);
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

/**
 * Seeds one app user and a live Convex Auth session of it, as a sign-in makes
 * one, and answers the user and the session. A test calls as that session with
 * `t.withIdentity({ subject: sessionId })`: an access token's subject is its
 * session, and the session middleware resolves the user through it.
 */
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
  }: {
    credits?: Doc<"users">["credits"];
    creditsResetAt?: Doc<"users">["creditsResetAt"];
    email?: Doc<"users">["email"];
    name?: Doc<"users">["name"];
    now: number;
    plan?: Doc<"users">["plan"];
    role?: Doc<"users">["role"];
    suffix?: string;
  }
) {
  const userId = await ctx.db.insert("users", {
    credits,
    creditsResetAt,
    email,
    mascot: MASCOT_CODE,
    name,
    plan,
    ...(role
      ? {
          role,
        }
      : {}),
  });
  const tokens = await ctx.runMutation(
    components.auth.public._internal_dangerous_signIn,
    {
      ...TEST_SESSION_LIFETIMES,
      claims: { method: "test", profile: {} },
      componentPath: "test",
      userId,
    }
  );
  return {
    sessionId: authTest.sessionIdentity(tokens).subject,
    userId,
  };
}
