import posthogTest from "@posthog/convex/test";
import { components } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import type { AudioContentLookup } from "@repo/backend/convex/contents/validators";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/convex/credits/constants";
import type { AudioContentType } from "@repo/backend/convex/lib/validators/audio";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import aggregateSchema from "@repo/backend/node_modules/@convex-dev/aggregate/src/component/schema";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";

const betterAuthModules = import.meta.glob(["./betterAuth/**/*.ts"]);
const aggregateModules = import.meta.glob([
  "../node_modules/@convex-dev/aggregate/src/component/**/*.ts",
]);
const DEFAULT_SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

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
  posthogTest.register(t);
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

function getAudioContentTypeForTestRoute(route: string): AudioContentType {
  if (route.startsWith("articles/")) {
    return "article";
  }

  if (route.startsWith("subject/")) {
    return "subject";
  }

  throw new Error(`Expected audio content route, received ${route}.`);
}

/** Builds graph-backed audio source test data from the content route contract. */
export function getTestAudioContent(input: {
  contentHash?: AudioContentLookup["contentHash"];
  locale: Locale;
  route: AudioContentLookup["route"];
}) {
  const graph = createLearningGraphIdentityFromRoute({
    locale: input.locale,
    route: input.route,
  });

  if (!graph) {
    throw new Error(
      `Expected graph identity for ${input.locale}/${input.route}.`
    );
  }

  return {
    ...graph,
    contentHash: input.contentHash ?? `${input.locale}-${input.route}-hash`,
    content_id: graph.assetId,
    contentType: getAudioContentTypeForTestRoute(input.route),
    locale: input.locale,
    route: input.route,
  };
}

/** Builds graph-backed audio table identity fields from a route fixture. */
export function getTestAudioIdentity(input: {
  locale: Locale;
  route: AudioContentLookup["route"];
}) {
  const source = getTestAudioContent(input);

  return {
    alignmentId: source.alignmentId,
    assetId: source.assetId,
    conceptId: source.conceptId,
    content_id: source.content_id,
    contentType: source.contentType,
    learningObjectId: source.learningObjectId,
    lensId: source.lensId,
    locale: source.locale,
    route: source.route,
  };
}
