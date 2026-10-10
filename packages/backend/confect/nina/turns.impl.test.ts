import { Ref } from "@confect/core";
import { saveMessage, toUIMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { DEFAULT_TITLE } from "@repo/backend/client/nina/presentation";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import {
  createConvexTestWithBetterAuth,
  seedAnalyticsConsent,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { showsText } from "@repo/backend/test/seal";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, DateTime, Effect } from "effect";

vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return {
    ...actual,
    saveMessage: vi.fn(actual.saveMessage),
    toUIMessages: vi.fn(actual.toUIMessages),
  };
});

const NOW = Date.UTC(2026, 8, 27, 12);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const getChat = Ref.getFunctionReference(refs.public.chats.queries.getChat);
const args = {
  requestId: "request-1",
  input: {
    kind: "message",
    prompt: { text: "Explain a limit." },
    page: { locale: "en", slug: "home" },
  },
};

async function fixture(credits = 10) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  return { t, identity, owner };
}

describe("native Nina admission", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(resolveNinaContext).mockReturnValue(
      openNinaLearningSession({
        capturedAt: DateTime.formatIso(DateTime.makeUnsafe(NOW)),
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
          user: {},
        }))
      )
    );
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ["a current browser tab", args, { chat_type: "study" }],
    [
      "an old browser tab that still sends the retired model",
      { ...args, modelId: "nakafa-lite" as const },
      { chat_type: "study", model_id: "nakafa-lite" },
    ],
  ])(
    "charges five credits, stores no model, and reports one consented send from %s",
    async (_tab, request, properties) => {
      const { t, identity, owner } = await fixture();
      await t.mutation((ctx) =>
        seedAnalyticsConsent(ctx, { userId: identity.userId, decidedAt: NOW })
      );
      await owner.mutation(start, request);
      await owner.mutation(start, request);
      const state = await t.query(async (ctx) => ({
        user: await ctx.db.get("users", identity.userId),
        turns: await ctx.db.query("ninaTurns").collect(),
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      }));
      expect(state.user?.credits).toBe(5);
      expect(state.turns).toHaveLength(1);
      expect(state.turns[0]).not.toHaveProperty("modelId");
      const events = Arr.filter(state.jobs, (job) =>
        job.name.includes("deliverProductEvent")
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.args).toEqual([
        expect.objectContaining({
          distinctId: identity.userId,
          event: "chat message sent",
          properties: encodeJsonText(properties),
        }),
      ]);
    }
  );

  it("atomically saves the prompt, reserves credits, and schedules one response for an idempotent retry", async () => {
    const { t, identity, owner } = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    expect(vi.mocked(resolveNinaContext).mock.lastCall?.[2]).toBe(
      DateTime.formatIso(DateTime.makeUnsafe(NOW))
    );
    expect(
      Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await owner.mutation(start, args)
      )
    ).toEqual(first);
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      turns: await ctx.db.query("ninaTurns").collect(),
      ledger: await ctx.db.query("creditTransactions").collect(),
      schedules: await ctx.db.system.query("_scheduled_functions").collect(),
      messages: await ctx.runQuery(
        components.nina.messages.listMessagesByThreadId,
        {
          threadId: first.threadId,
          paginationOpts: { cursor: null, numItems: 10 },
          order: "asc",
        }
      ),
    }));
    expect(state.user?.credits).toBe(5);
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({
      promptMessageId: first.promptMessageId,
      usage: [],
      state: { status: "queued" },
    });
    expect(
      Arr.filter(state.ledger, (row) => row.type === "usage")
    ).toHaveLength(1);
    expect(
      Arr.filter(state.schedules, (row) => row.name === "nina/response:run")
    ).toHaveLength(1);
    expect(state.messages.page).toHaveLength(1);
  });

  it("begins a chat with its default title sealed for the learner", async () => {
    const { t, owner } = await fixture();
    const receipt = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    const stored = await t.query((ctx) => ctx.db.get("chats", receipt.chatId));
    expect(stored?.title).toBeInstanceOf(ArrayBuffer);
    expect(showsText(stored?.title, DEFAULT_TITLE)).toBe(false);
    expect(
      await owner.query(getChat, { chatId: receipt.chatId })
    ).toMatchObject({ title: DEFAULT_TITLE });
  });

  it("rejects changed payloads sharing a request key and a concurrent turn on the same chat", async () => {
    const { owner } = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    await expect(
      owner.mutation(start, {
        ...args,
        input: { ...args.input, prompt: { text: "Different" } },
      })
    ).rejects.toMatchObject({ data: { code: "NINA_REQUEST_CONFLICT" } });
    await expect(
      owner.mutation(start, {
        ...args,
        requestId: "request-2",
        chatId: first.chatId,
      })
    ).rejects.toMatchObject({ data: { code: "NINA_BUSY" } });
  });

  it("rejects insufficient credits before signed context work and rolls back a context failure", async () => {
    const poor = await fixture(0);
    await expect(poor.owner.mutation(start, args)).rejects.toMatchObject({
      data: { code: "INSUFFICIENT_CREDITS" },
    });
    expect(resolveNinaContext).not.toHaveBeenCalled();
    const { t, owner, identity } = await fixture();
    vi.mocked(resolveNinaContext).mockReturnValueOnce(
      Effect.fail(
        new NinaTurnError({
          code: "NINA_CONTEXT_FAILED",
          message: "Unavailable",
        })
      )
    );
    await expect(owner.mutation(start, args)).rejects.toMatchObject({
      data: { code: "NINA_CONTEXT_FAILED" },
    });
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(state.user?.credits).toBe(10);
    expect(state.ledger).toEqual([]);
  });

  it("rolls back the component thread, chat and credit hold when prompt persistence fails", async () => {
    const { t, owner, identity } = await fixture();
    vi.mocked(saveMessage).mockRejectedValueOnce(
      new Error("component unavailable")
    );
    await expect(owner.mutation(start, args)).rejects.toMatchObject({
      data: { code: "NINA_WRITE_FAILED" },
    });
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      chats: await ctx.db.query("chats").collect(),
      ledger: await ctx.db.query("creditTransactions").collect(),
      threads: await ctx.runQuery(components.nina.threads.listThreadsByUserId, {
        userId: identity.userId,
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    }));
    expect(state.user?.credits).toBe(10);
    expect(state.chats).toEqual([]);
    expect(state.ledger).toEqual([]);
    expect(state.threads.page).toEqual([]);
  });

  it("does not accept another owner's chat or bypass the quota by refunding", async () => {
    const { t, owner } = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    const other = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "other" })
    );
    await expect(
      t
        .withIdentity({ subject: other.authUserId, sessionId: other.sessionId })
        .mutation(start, { ...args, chatId: first.chatId })
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await owner.mutation(cancel, { chatId: first.chatId });
    for (let index = 1; index < 5; index += 1) {
      const receipt = Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await owner.mutation(start, {
          ...args,
          requestId: `request-${index + 1}`,
        })
      );
      await owner.mutation(cancel, { chatId: receipt.chatId });
    }
    await expect(
      owner.mutation(start, { ...args, requestId: "sixth" })
    ).rejects.toMatchObject({ data: { code: "RATE_LIMITED" } });
  });
  it("rejects retry without a stored conversation before committing a credit hold", async () => {
    const f = await fixture();
    await expect(
      f.owner.mutation(start, { ...args, input: { kind: "retry", order: 0 } })
    ).rejects.toMatchObject({ data: { code: "NINA_RETRY_UNAVAILABLE" } });
    expect(
      await f.t.query((ctx) => ctx.db.query("creditTransactions").collect())
    ).toEqual([]);
  });

  it("retries an owned Agent text prompt without optional file metadata", async () => {
    const f = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, args)
    );
    await f.owner.mutation(cancel, { chatId: first.chatId });
    await f.t.mutation(async (ctx) => {
      const saved = await saveMessage(ctx, components.nina, {
        threadId: first.threadId,
        userId: f.identity.userId,
        prompt: "An owned text-only prompt.",
      });
      await ctx.db.patch("ninaTurns", first.turnId, {
        promptMessageId: saved.messageId,
      });
    });
    const retried = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, {
        ...args,
        chatId: first.chatId,
        requestId: "retry-text",
        input: { kind: "retry", order: first.order },
      })
    );
    expect(retried.prompt.text).toBe("An owned text-only prompt.");
  });

  it("retries a saved response without run context only after resolving the current page", async () => {
    const f = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, args)
    );
    await f.owner.mutation(cancel, { chatId: first.chatId });
    await f.t.mutation((ctx) =>
      ctx.db.patch("ninaTurns", first.turnId, {
        page: undefined,
        user: undefined,
      })
    );
    const retry = {
      ...args,
      chatId: first.chatId,
      requestId: "saved-prompt-retry",
      input: { kind: "retry", order: first.order },
    };
    await expect(f.owner.mutation(start, retry)).rejects.toMatchObject({
      data: { code: "NINA_RETRY_UNAVAILABLE" },
    });
    const retried = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, {
        ...retry,
        input: { ...retry.input, page: args.input.page },
      })
    );
    expect(retried.prompt.text).toBe(args.input.prompt.text);
    expect(vi.mocked(resolveNinaContext)).toHaveBeenLastCalledWith(
      args.input.page,
      expect.objectContaining({ _id: f.identity.userId }),
      DateTime.formatIso(DateTime.makeUnsafe(NOW)),
      first.chatId
    );
  });

  it.each(["new", "existing"] as const)(
    "refuses an unreadable %s component receipt without charging twice",
    async (state) => {
      const f = await fixture();
      if (state === "existing") {
        await f.owner.mutation(start, args);
      }
      vi.mocked(toUIMessages).mockReturnValueOnce([]);
      await expect(f.owner.mutation(start, args)).rejects.toMatchObject({
        data: { code: "NINA_WRITE_FAILED" },
      });
      const ledger = await f.t.query((ctx) =>
        ctx.db.query("creditTransactions").collect()
      );
      expect(ledger).toHaveLength(state === "new" ? 0 : 1);
    }
  );
});
