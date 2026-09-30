import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
const NOW = Date.UTC(2026, 8, 27, 12);
const get = Ref.getFunctionReference(refs.public.nina.conversation.get);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const messages = Ref.getFunctionReference(refs.public.nina.messages.list);
const input = {
  requestId: "one",
  modelId: "nakafa-lite",
  input: {
    kind: "message",
    prompt: { text: "Explain a limit" },
    page: { locale: "en", slug: "home" },
  },
};

async function fixture() {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits: 10 })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const receipt = Ref.decodeReturnsSync(
    refs.public.nina.turns.start,
    await owner.mutation(start, input)
  );
  return { t, owner, ...receipt };
}

describe("Nina conversation visibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(resolveNinaContext).mockReturnValue(
      openNinaLearningSession({
        capturedAt: new Date(NOW).toISOString(),
        source: "current-page",
        learning: {
          locale: "en",
          slug: "home",
          url: "https://nakafa.com/en/home",
          verified: false,
        },
      }).pipe(
        Effect.orDie,
        Effect.map((session) => ({
          page: {
            locale: "en" as const,
            slug: "home",
            url: "https://nakafa.com/en/home",
            verified: false,
            needsFetch: false,
            nina: session.context,
          },
          user: { role: "teacher" },
        }))
      )
    );
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("projects only public turn facts for anonymous readers of a shared chat", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      ctx.db.patch("chats", f.chatId, { visibility: "public" })
    );
    const conversation = Ref.decodeReturnsSync(
      refs.public.nina.conversation.get,
      await f.t.query(get, { chatId: f.chatId })
    );
    expect(conversation.turn).toEqual({
      order: 0,
      promptMessageId: f.promptMessageId,
      promptedAt: NOW,
      state: { status: "queued" },
      modelId: "nakafa-lite",
      credits: 2,
      usage: [],
    });
    const page = Ref.decodeReturnsSync(
      refs.public.nina.messages.list,
      await f.t.query(messages, {
        chatId: f.chatId,
        threadId: f.threadId,
        paginationOpts: { cursor: null, numItems: 20 },
      })
    );
    expect(page.page).toHaveLength(1);
    expect(page.page[0]?.metadata).toEqual(conversation.turn);
    expect(JSON.stringify(page)).not.toContain('"role":"teacher"');
    expect(JSON.stringify(page)).not.toContain("creditsResetAt");
    expect(JSON.stringify(conversation)).not.toContain("fingerprint");
  });

  it("denies anonymous readers of a private chat and follows the newest turn by order", async () => {
    const f = await fixture();
    await expect(f.t.query(get, { chatId: f.chatId })).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    });
    await f.owner.mutation(cancel, { chatId: f.chatId });
    const next = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, {
        ...input,
        chatId: f.chatId,
        requestId: "two",
      })
    );
    const conversation = Ref.decodeReturnsSync(
      refs.public.nina.conversation.get,
      await f.owner.query(get, { chatId: f.chatId })
    );
    expect(conversation.turn).toMatchObject({
      promptMessageId: next.promptMessageId,
      order: next.order,
      state: { status: "queued" },
    });
    expect(next.order).toBeGreaterThan(f.order);
  });

  it("reads an empty owned chat without inventing turn metadata", async () => {
    const f = await fixture();
    await f.owner.mutation(cancel, { chatId: f.chatId });
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    const conversation = Ref.decodeReturnsSync(
      refs.public.nina.conversation.get,
      await f.owner.query(get, { chatId: f.chatId })
    );
    expect(conversation.turn).toBeNull();
  });
});
