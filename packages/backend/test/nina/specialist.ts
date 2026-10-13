import { RegisteredFunction } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import type {
  ActionCtx,
  QueryRunner,
  VectorSearch,
} from "@repo/backend/confect/_generated/services";
import type { Gateway } from "@repo/backend/confect/gateway/handle";
import type {
  CapabilityArtifact,
  CapabilityProgress,
} from "@repo/backend/confect/nina/capability/progress";
import type {
  ResearchAgentData,
  TaskAgentData,
} from "@repo/backend/confect/nina/contract/agent";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { GatewayTest } from "@repo/backend/test/gateway";
import { ninaUsage } from "@repo/backend/test/nina";
import type { MockLanguageModelV4 } from "ai/test";
import { DateTime, Effect, MutableList } from "effect";

export const specialistRequest = {
  context: {
    currentDate: "2026-09-27",
    slug: "home",
    url: "https://nakafa.com/en/home",
    verified: false,
  },
  locale: "en",
  task: "Verify the requested evidence.",
} satisfies Omit<TaskAgentData, "userId">;

/** The learning session of the home page, which a scripted turn of a specialist or a capability runs under. */
export const openHomeSession = openNinaLearningSession({
  capturedAt: "2026-09-27T12:00:00Z",
  source: "current-page",
  learning: {
    locale: "en",
    slug: "home",
    url: "https://nakafa.com/en/home",
    verified: false,
  },
});

/**
 * The data of a research run besides its user, progress and usage: no link from
 * the learner, and words that differ from the task its model reads.
 */
export const researchRequest = {
  ...specialistRequest,
  sourceReferences: [],
  toolCallId: "research",
  words: "requested evidence",
} satisfies Omit<ResearchAgentData, "userId">;

/** Executes the real Agent component in its native action context over the test gateway. */
export async function runSpecialist<A, E>(
  program: (
    userId: Docs["users"]["_id"]
  ) => Effect.Effect<A, E, ActionCtx | Gateway | QueryRunner | VectorSearch>
) {
  const t = createConvexTestWithBetterAuth();
  const { userId } = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, {
      // The real clock, which the credit ledger also reads. A fixed past time
      // would trigger the free plan's daily credit reset.
      now: DateTime.toEpochMillis(DateTime.nowUnsafe()),
    })
  );
  return t.action((ctx) =>
    Effect.runPromise(
      program(userId).pipe(
        Effect.provide([
          GatewayTest,
          RegisteredFunction.actionLayer(schema, ctx),
        ])
      )
    )
  );
}

export function recordProgress() {
  const artifacts = MutableList.make<CapabilityArtifact>();
  const publish: CapabilityProgress = Effect.fn("test.nina.publish")(
    (artifact) =>
      Effect.sync(() => {
        MutableList.append(artifacts, artifact);
      })
  );
  return { artifacts, publish };
}

export function providerStep(
  content: Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>["content"],
  finish: "stop" | "tool-calls" | "length" = "stop"
) {
  return {
    content,
    finishReason: { unified: finish, raw: finish },
    usage: ninaUsage,
    warnings: [],
  };
}
