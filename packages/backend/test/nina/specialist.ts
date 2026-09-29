import { RegisteredFunction } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import type {
  ActionCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import type {
  CapabilityArtifact,
  CapabilityProgress,
} from "@repo/backend/confect/nina/capability/progress";
import { ModelIdSchema } from "@repo/backend/confect/nina/config/model";
import type { TaskAgentDataSchema } from "@repo/backend/confect/nina/contract/agent";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { ninaUsage } from "@repo/backend/test/nina";
import type { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

export const specialistRequest = {
  context: {
    currentDate: "2026-09-27",
    slug: "home",
    url: "https://nakafa.com/en/home",
    verified: false,
  },
  locale: "en",
  modelId: ModelIdSchema.make("nakafa-lite"),
  task: "Verify the requested evidence.",
} satisfies Omit<typeof TaskAgentDataSchema.Type, "userId">;

/** Executes the real Agent component in its native action context. */
export async function runSpecialist<A, E>(
  program: (
    userId: Docs["users"]["_id"]
  ) => Effect.Effect<A, E, ActionCtx | QueryRunner>
) {
  const t = createConvexTestWithBetterAuth();
  const { userId } = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: Date.now() })
  );
  return t.action((ctx) =>
    Effect.runPromise(
      program(userId).pipe(
        Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
      )
    )
  );
}

export function recordProgress() {
  const artifacts: CapabilityArtifact[] = [];
  const publish: CapabilityProgress = Effect.fn("test.nina.publish")(
    (artifact) =>
      Effect.sync(() => {
        artifacts.push(artifact);
      })
  );
  return { artifacts, publish };
}

export function providerStep(
  content: Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>["content"],
  finish: "stop" | "tool-calls" = "stop"
) {
  return {
    content,
    finishReason: { unified: finish, raw: finish },
    usage: ninaUsage,
    warnings: [],
  };
}
