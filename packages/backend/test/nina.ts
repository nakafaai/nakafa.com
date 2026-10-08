import { RegisteredConvexFunction } from "@confect/server";
import { createThread, saveMessage, saveMessages } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import schema from "@repo/backend/confect/_generated/schema";
import { ModelId } from "@repo/backend/confect/gateway/model";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import { NakafaToolInputSchema } from "@repo/backend/confect/nina/contract/tools";
import { reserveCredits } from "@repo/backend/confect/nina/credits/ledger";
import { NinaSuggestions } from "@repo/backend/confect/nina/presentation.spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { MockLanguageModelV4 } from "ai/test";
import { DateTime, Effect, Schema } from "effect";

const encodePlainJson = Schema.encodeSync(
  Schema.fromJsonString(Schema.Unknown)
);
const encodeNakafaToolInput = Schema.encodeSync(
  Schema.fromJsonString(NakafaToolInputSchema)
);
const encodeSuggestions = Schema.encodeSync(
  Schema.fromJsonString(Schema.Struct({ suggestions: NinaSuggestions }))
);

/**
 * A real component thread with a reserved turn and its authenticated owner.
 * `history` complete earlier turns precede the reserved prompt.
 */
export async function createNinaTest({
  history = 0,
  now = DateTime.toEpochMillis(DateTime.nowUnsafe()),
  prompt: text = "Explain a limit.",
  needsFetch = false,
}: {
  history?: number;
  now?: number;
  prompt?: string;
  needsFetch?: boolean;
} = {}) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now, credits: 10 })
  );
  const saved = await t.mutation(async (ctx) => {
    const user = await ctx.db.get("users", identity.userId);
    if (!user) {
      return Promise.reject(new Error("Fixture user missing"));
    }
    const reservation = await Effect.runPromise(
      reserveCredits(user, ModelId.make("nakafa-lite")).pipe(
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    );
    const threadId = await createThread(ctx, components.nina, {
      userId: identity.userId,
    });
    for (let order = 0; order < history; order += 1) {
      await saveMessages(ctx, components.nina, {
        threadId,
        order,
        messages: [
          { role: "user", content: `Earlier question ${order}` },
          { role: "assistant", content: `Earlier answer ${order}` },
        ],
      });
    }
    const prompt = await saveMessage(ctx, components.nina, {
      threadId,
      prompt: text,
    });
    const chatId = await ctx.db.insert("chats", {
      userId: identity.userId,
      threadId,
      type: "study",
      visibility: "private",
      updatedAt: now,
    });
    const session = await Effect.runPromise(
      openNinaLearningSession({
        capturedAt: new Date(now).toISOString(),
        learning: {
          locale: "en",
          slug: "home",
          url: "https://nakafa.com/en/home",
          verified: false,
        },
        source: "current-page",
      })
    );
    const turnId = await ctx.db.insert("ninaTurns", {
      ...reservation,
      phase: "active",
      threadId,
      chatId,
      requestId: "one",
      fingerprint: "fingerprint",
      promptMessageId: prompt.messageId,
      order: prompt.message.order,
      usage: [],
      user: {},
      page: {
        locale: "en",
        slug: "home",
        url: "https://nakafa.com/en/home",
        verified: false,
        needsFetch,
        nina: session.context,
      },
      state: { status: "queued" },
    });
    await ctx.db.patch("chats", chatId, { activeTurnId: turnId });
    return { turnId, threadId, chatId, promptMessageId: prompt.messageId };
  });
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  return { ...saved, t, owner, identity };
}

type ModelStream = Awaited<
  ReturnType<MockLanguageModelV4["doStream"]>
>["stream"];
type StreamPart = ModelStream extends ReadableStream<infer Part> ? Part : never;
export const ninaUsage = {
  inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 4, text: 3, reasoning: 1 },
};

export function ninaStream(parts: StreamPart[]) {
  return {
    stream: new ReadableStream<StreamPart>({
      start(controller) {
        for (const part of parts) {
          controller.enqueue(part);
        }
        controller.close();
      },
    }),
  };
}

export const ninaToolInput = {
  request: "Read the page",
  objective: "Gather evidence",
  deliverables: ["definition"],
};

export function ninaModel(
  withTool = false,
  failed = false,
  input: object = ninaToolInput
) {
  const final = ninaStream(
    failed
      ? [{ type: "error", error: new Error("Provider unavailable") }]
      : [
          { type: "stream-start", warnings: [] },
          { type: "reasoning-start", id: "reason" },
          {
            type: "reasoning-delta",
            id: "reason",
            delta: "Check the evidence.",
          },
          { type: "reasoning-end", id: "reason" },
          { type: "text-start", id: "answer" },
          {
            type: "text-delta",
            id: "answer",
            delta: "A limit describes the value approached.",
          },
          { type: "text-end", id: "answer" },
          {
            type: "source",
            sourceType: "url",
            id: "source-1",
            url: "https://example.com/limits",
            title: "Limits",
          },
          {
            type: "finish",
            usage: ninaUsage,
            finishReason: { unified: "stop", raw: "stop" },
          },
        ]
  );
  return new MockLanguageModelV4({
    doStream: withTool
      ? [
          ninaStream([
            { type: "stream-start", warnings: [] },
            {
              type: "tool-call",
              toolCallId: "read-1",
              toolName: "nakafa",
              input: encodePlainJson(input),
            },
            {
              type: "finish",
              usage: ninaUsage,
              finishReason: { unified: "tool-calls", raw: "tool-calls" },
            },
          ]),
          final,
        ]
      : final,
    doGenerate: ({ responseFormat, prompt }) => {
      let text = "Understanding A Function Limit";
      if (encodePlainJson(prompt).includes("Repair the arguments for")) {
        text = encodeNakafaToolInput(ninaToolInput);
      } else if (responseFormat?.type === "json") {
        text = encodeSuggestions({
          suggestions: ["How does this relate to continuity?"],
        });
      }
      return Promise.resolve({
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: ninaUsage,
        warnings: [],
      });
    },
  });
}
