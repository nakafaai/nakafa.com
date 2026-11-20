import agentTest from "@convex-dev/agent/test";
import aggregateTest from "@convex-dev/aggregate/test";
import authGoogleTest from "@convex-dev/auth/components/google/test";
import authPasswordTest from "@convex-dev/auth/components/password/test";
import authUsernameTest from "@convex-dev/auth/components/username/test";
import authTest from "@convex-dev/auth/test";
import presenceTest from "@convex-dev/presence/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
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
import { registerPostHog } from "@repo/backend/test/posthog";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";

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
  registerPostHog(t);
  presenceTest.register(t);
  return t;
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
