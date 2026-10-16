import { Ref } from "@confect/core";
import { saveMessage, toUIMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { DEFAULT_TITLE } from "@repo/backend/client/nina/presentation";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { activeTurns } from "@repo/backend/confect/nina/capacity";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import {
  START_DEADLINE,
  TURN_DEADLINE,
} from "@repo/backend/confect/nina/deadline";
import { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import {
  seedAnalyticsConsent,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import {
  args,
  cancel,
  contextFor,
  fixture,
  NOW,
  start,
} from "@repo/backend/test/nina/admission";
import { homePage } from "@repo/backend/test/nina/page";
import { sealThreadIn } from "@repo/backend/test/nina/seal";
import { showsText } from "@repo/backend/test/seal";
import { MATERIAL_CONTEXT_HINT_LENGTH } from "@repo/contents/route/material/context";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Duration, Effect } from "effect";

vi.mock("@repo/backend/confect/nina/capacity", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/capacity")>();
  return { ...actual, activeTurns: vi.fn(actual.activeTurns) };
});
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

const getChat = Ref.getFunctionReference(refs.public.chats.queries.getChat);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);

describe("native Nina admission", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("charges five credits and reports one consented send", async () => {
    const { t, identity, owner } = await fixture();
    await t.mutation((ctx) =>
      seedAnalyticsConsent(ctx, { userId: identity.userId, decidedAt: NOW })
    );
    await owner.mutation(start, args);
    await owner.mutation(start, args);
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      turns: await ctx.db.query("ninaTurns").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(state.user?.credits).toBe(5);
    expect(state.turns).toHaveLength(1);
    const events = Arr.filter(state.jobs, (job) =>
      job.name.includes("deliverProductEvent")
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.args).toEqual([
      expect.objectContaining({
        distinctId: identity.userId,
        event: "chat message sent",
        properties: encodeJsonText({ chat_type: "study" }),
      }),
    ]);
  });

  it("atomically saves the prompt, reserves credits, and schedules one response for an idempotent retry", async () => {
    const { t, identity, owner } = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
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
    // The page is stored once, as the resolver froze it.
    expect(state.turns[0]?.page).toEqual(homePage);
    expect(
      Arr.filter(state.ledger, (row) => row.type === "usage")
    ).toHaveLength(1);
    expect(
      Arr.filter(state.schedules, (row) => row.name === "nina/response:run")
    ).toHaveLength(1);
    // One check follows the run, for the moment it must have started. The
    // recovery sweep covers a turn that stays open past its deadline, so
    // admission schedules no settlement.
    expect(
      Arr.filter(state.schedules, (row) => row.name === "nina/lifecycle:expire")
    ).toEqual([
      expect.objectContaining({
        args: [{ turnId: first.turnId }],
        scheduledTime: NOW + Duration.toMillis(START_DEADLINE),
      }),
    ]);
    expect(
      Arr.filter(
        state.schedules,
        (row) => row.name === "nina/lifecycle:recover"
      )
    ).toEqual([]);
    expect(state.messages.page).toHaveLength(1);
  });

  it("starts a turn for a context hint of the longest length a page writes, and for a longer one", async () => {
    const { t, owner } = await fixture();
    const withHint = (requestId: string, length: number) => ({
      requestId,
      input: {
        ...args.input,
        page: { ...args.input.page, materialContextHint: "x".repeat(length) },
      },
    });
    await owner.mutation(
      start,
      withHint("request-longest", MATERIAL_CONTEXT_HINT_LENGTH)
    );
    // A client built before the page bounded its hint may send a longer one.
    await owner.mutation(
      start,
      withHint("request-longer", MATERIAL_CONTEXT_HINT_LENGTH + 1)
    );
    const turns = await t.query((ctx) => ctx.db.query("ninaTurns").collect());
    expect(turns).toHaveLength(2);
  });

  it("replays the prompt of a saved request from its sealed copy as from the plain copy", async () => {
    const { t, identity, owner } = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    const plain = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    await sealThreadIn(t, first.threadId, identity.userId);
    const sealed = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    expect(sealed.prompt).toEqual(plain.prompt);
    expect(sealed.prompt.text).not.toBe("");
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

  it("refuses a third open turn before any credit is held, and frees a place when one settles", async () => {
    const { t, owner, identity } = await fixture(20);
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, { ...args, requestId: "one" })
    );
    await owner.mutation(start, { ...args, requestId: "two" });
    await expect(
      owner.mutation(start, { ...args, requestId: "three" })
    ).rejects.toMatchObject({ data: { code: "RATE_LIMITED" } });
    const refused = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      chats: await ctx.db.query("chats").collect(),
      turns: await ctx.db.query("ninaTurns").collect(),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(refused.user?.credits).toBe(10);
    expect(refused.chats).toHaveLength(2);
    expect(refused.turns).toHaveLength(2);
    expect(refused.ledger).toHaveLength(2);
    expect(
      Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await owner.mutation(start, { ...args, requestId: "one" })
      )
    ).toEqual(first);

    await owner.mutation(cancel, { chatId: first.chatId });
    await owner.mutation(start, { ...args, requestId: "three" });
    expect(
      (await t.query((ctx) => ctx.db.query("ninaTurns").collect())).length
    ).toBe(3);
  });

  it("reads the learner's open turns once for an admission, and once more only after it settled a stopped turn", async () => {
    const { t, owner } = await fixture(20);
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, { ...args, requestId: "one" })
    );
    await owner.mutation(start, { ...args, requestId: "two" });
    // Nothing was stopped, so each of the two admissions read them once.
    expect(activeTurns).toHaveBeenCalledTimes(2);

    // A run took the first turn, so stopping it leaves it open until it settles.
    await t.mutation(claim, { turnId: first.turnId });
    await owner.mutation(cancel, { chatId: first.chatId });
    vi.mocked(activeTurns).mockClear();
    await owner.mutation(start, { ...args, requestId: "three" });
    // The stopped turn settled, so the places that were open were counted again.
    expect(activeTurns).toHaveBeenCalledTimes(2);
  });

  it("holds no place for an open turn past its deadline, so a settlement that keeps failing cannot lock the learner out", async () => {
    const { t, owner } = await fixture(20);
    await owner.mutation(start, { ...args, requestId: "one" });
    await owner.mutation(start, { ...args, requestId: "two" });
    const deadline = Duration.toMillis(TURN_DEADLINE);

    // Until its deadline passes, a turn can still run and holds its place.
    vi.setSystemTime(NOW + deadline);
    await expect(
      owner.mutation(start, { ...args, requestId: "three" })
    ).rejects.toMatchObject({ data: { code: "RATE_LIMITED" } });

    // Past it, the turn can no longer run and waits only for the sweep.
    vi.setSystemTime(NOW + deadline + 1);
    await owner.mutation(start, { ...args, requestId: "three" });
    expect(
      (await t.query((ctx) => ctx.db.query("ninaTurns").collect())).length
    ).toBe(3);
  });

  it("counts only the learner's own open turns", async () => {
    const { t, owner } = await fixture(20);
    await owner.mutation(start, { ...args, requestId: "one" });
    await owner.mutation(start, { ...args, requestId: "two" });
    const other = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, credits: 10, suffix: "other" })
    );
    await t
      .withIdentity({ subject: other.authUserId, sessionId: other.sessionId })
      .mutation(start, { ...args, requestId: "other" });
    expect(
      (await t.query((ctx) => ctx.db.query("ninaTurns").collect())).length
    ).toBe(3);
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
