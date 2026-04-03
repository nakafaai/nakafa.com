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
import { convexTest } from "convex-test";

const betterAuthModules = import.meta.glob(["./betterAuth/**/*.ts"]);
const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/** Builds a Convex test instance with the Better Auth component registered. */
export function createConvexTestWithBetterAuth() {
  const t = convexTest(schema, convexModules);
  t.registerComponent("betterAuth", authSchema, betterAuthModules);
  return t;
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
