import { Ref } from "@confect/core";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import {
  DEFAULT_TITLE,
  NINA_MESSAGES_PAGE_SIZE,
} from "@repo/backend/client/nina/presentation";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createNinaTest } from "@repo/backend/test/nina";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, DateTime, Effect } from "effect";

vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
const NOW = Date.UTC(2026, 8, 27, 12);
const get = Ref.getFunctionReference(refs.public.nina.conversation.get);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const messages = Ref.getFunctionReference(refs.public.nina.messages.list);
const messagesPage = Ref.getFunctionReference(refs.public.nina.messages.page);
const turns = Ref.getFunctionReference(refs.public.nina.conversation.turns);
const share = Ref.getFunctionReference(
  refs.public.chats.mutations.updateChatVisibility
);
const token = Ref.getFunctionReference(refs.public.chats.queries.getShareToken);
const input = {
  requestId: "one",
  input: {
    kind: "message",
    prompt: { text: "Explain a limit" },
    page: { locale: "en", slug: "home" },
  },
};

/** A page of the turns that ended, as a reader of the chat is told them, newest first. */
async function turnsOf(
  reader: Pick<ReturnType<typeof createConvexTestWithBetterAuth>, "query">,
  args: { chatId: Id<"chats">; shareToken?: string },
  numItems = 20
) {
  return Ref.decodeReturnsSync(
    refs.public.nina.conversation.turns,
    await reader.query(turns, {
      ...args,
      paginationOpts: { cursor: null, numItems },
    })
  ).page;
}

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
  return { t, owner, userId: identity.userId, ...receipt };
}

describe("Nina conversation visibility", () => {
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
    await f.owner.mutation(share, {
      chatId: f.chatId,
      visibility: "public",
    });
    const shareToken = await f.owner.query(token, { chatId: f.chatId });
    assert(shareToken !== null);
    // The chat id alone opens nothing, and neither does the wrong token.
    for (const refused of [{}, { shareToken: "A".repeat(43) }]) {
      await expect(
        f.t.query(get, { chatId: f.chatId, ...refused })
      ).rejects.toMatchObject({ data: { code: "CHAT_NOT_FOUND" } });
    }
    const conversation = Ref.decodeReturnsSync(
      refs.public.nina.conversation.get,
      await f.t.query(get, { chatId: f.chatId, shareToken })
    );
    // The title was sealed for its owner when the chat began; the shared page
    // opens it with the owner's key.
    expect(conversation.chat.title).toBe(DEFAULT_TITLE);
    expect(conversation.turn).toEqual({
      order: 0,
      promptMessageId: f.promptMessageId,
      promptedAt: NOW,
      state: { status: "queued" },
      usage: [],
    });
    const listed = {
      chatId: f.chatId,
      threadId: f.threadId,
      paginationOpts: { cursor: null, numItems: 20 },
    };
    await expect(f.t.query(messages, listed)).rejects.toMatchObject({
      data: { code: "CHAT_NOT_FOUND" },
    });
    const page = Ref.decodeReturnsSync(
      refs.public.nina.messages.list,
      await f.t.query(messages, { ...listed, shareToken })
    );
    expect(page.page).toHaveLength(1);
    expect(page.page[0]?.metadata).toEqual(conversation.turn);
    // The page of messages tells no turn, and the turn runs, so only the
    // conversation tells it.
    const lean = Ref.decodeReturnsSync(
      refs.public.nina.messages.page,
      await f.t.query(messagesPage, { ...listed, shareToken })
    );
    expect(lean.page[0]).not.toHaveProperty("metadata");
    expect(await turnsOf(f.t, { chatId: f.chatId, shareToken })).toEqual([]);
    expect(encodeJsonText(page)).not.toContain('"role":"teacher"');
    expect(encodeJsonText(page)).not.toContain("creditsResetAt");
    expect(encodeJsonText(conversation)).not.toContain("fingerprint");
  });

  it("tells the owner everything about a turn, and a reader who holds the share link only where it stands", async () => {
    const f = await fixture();
    // What the turn cost, what Nina kept from it and what she suggests next.
    const ownerFacts = {
      remembered: 1,
      suggestions: ["How does a limit relate to continuity?"],
      tokens: { input: 1200, output: 340, total: 1540 },
      usage: [
        {
          agent: "nina" as const,
          calls: 1,
          cost: 0.002,
          input: 1200,
          model: "model-one",
          output: 340,
          provider: "provider-one",
        },
      ],
    };
    await f.t.mutation((ctx) =>
      ctx.db.patch("ninaTurns", f.turnId, ownerFacts)
    );
    // The turn ends, so the conversation and the turns tell the same of it.
    await f.t.mutation(recover, { turnId: f.turnId });
    await f.owner.mutation(share, {
      chatId: f.chatId,
      visibility: "public",
    });
    const shareToken = await f.owner.query(token, { chatId: f.chatId });
    assert(shareToken !== null);
    const stranger = await f.t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "stranger" })
    );
    const asStranger = f.t.withIdentity({
      sessionId: stranger.sessionId,
      subject: stranger.authUserId,
    });
    const where = {
      order: f.order,
      promptMessageId: f.promptMessageId,
      promptedAt: NOW,
      state: { status: "failed", finishedAt: NOW, reason: "interrupted" },
      usage: [],
    };
    const read = async (
      reader: typeof f.owner,
      access: { shareToken?: string }
    ) => {
      const conversation = Ref.decodeReturnsSync(
        refs.public.nina.conversation.get,
        await reader.query(get, { chatId: f.chatId, ...access })
      );
      return {
        conversation,
        turns: await turnsOf(reader, { chatId: f.chatId, ...access }),
      };
    };

    // The owner is told everything, by the chat id and through the share link.
    for (const access of [{}, { shareToken }]) {
      const { conversation, turns } = await read(f.owner, access);
      const known = { ...where, credits: 5, ...ownerFacts };
      expect(conversation.turn).toEqual(known);
      expect(turns).toEqual([known]);
    }
    // A reader with no account, and a learner with another account, are told
    // where the turn stands and nothing of what it cost or what Nina kept.
    for (const reader of [f.t, asStranger]) {
      const { conversation, turns } = await read(reader, { shareToken });
      expect(conversation.turn).toEqual(where);
      expect(turns).toEqual([where]);
      const told = encodeJsonText({ conversation, turns });
      for (const owned of [
        "model-one",
        "provider-one",
        "continuity",
        "1540",
        "credits",
        "remembered",
      ]) {
        expect(told).not.toContain(owned);
      }
    }
  });

  it("reads the messages of a chat and no turn, so a turn can change without the page being read again", async () => {
    const f = await fixture();
    await f.owner.mutation(share, { chatId: f.chatId, visibility: "public" });
    const shareToken = await f.owner.query(token, { chatId: f.chatId });
    assert(shareToken !== null);
    const documentsRead = () =>
      f.t.query(async (ctx) => {
        await ctx.runQuery(messagesPage, {
          chatId: f.chatId,
          paginationOpts: { cursor: null, numItems: 20 },
          shareToken,
          threadId: f.threadId,
        });
        return (await ctx.meta.getTransactionMetrics()).documentsRead.used;
      });
    const withTurn = await documentsRead();
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    // The page used to read the row of the turn of each message it held.
    expect(await documentsRead()).toBe(withTurn);
  });

  it("lists the turns that ended, newest first, and reads the turn that runs not at all", async () => {
    const f = await createNinaTest({ history: 3 });
    await f.owner.mutation(share, { chatId: f.chatId, visibility: "public" });
    const shareToken = await f.owner.query(token, { chatId: f.chatId });
    assert(shareToken !== null);
    // Orders 0 to 2 ended. Order 3 is queued.
    expect(
      Arr.map(await turnsOf(f.owner, { chatId: f.chatId }), (t) => t.order)
    ).toEqual([2, 1, 0]);
    const documentsRead = await f.t.query(async (ctx) => {
      await ctx.runQuery(turns, {
        chatId: f.chatId,
        paginationOpts: { cursor: null, numItems: 20 },
        shareToken,
      });
      return (await ctx.meta.getTransactionMetrics()).documentsRead.used;
    });
    // The chat, its share, and the three turns that ended.
    expect(documentsRead).toBe(5);
  });

  it("cuts a page of turns to the page size however many the caller asks for, and reaches the rest through the cursor", async () => {
    const f = await createNinaTest();
    // One turn more than a page ended after the turn the fixture admitted.
    await f.t.mutation(async (ctx) => {
      for (let order = 1; order <= NINA_MESSAGES_PAGE_SIZE + 1; order += 1) {
        await ctx.db.insert("ninaTurns", {
          chatId: f.chatId,
          order,
          phase: "settled",
          promptMessageId: f.promptMessageId,
          state: { finishedAt: NOW, status: "complete" },
          threadId: f.threadId,
          usage: [],
          userId: f.identity.userId,
        });
      }
    });
    const asked = Ref.decodeReturnsSync(
      refs.public.nina.conversation.turns,
      await f.owner.query(turns, {
        chatId: f.chatId,
        paginationOpts: { cursor: null, numItems: 1_000_000 },
      })
    );
    expect(asked.page).toHaveLength(NINA_MESSAGES_PAGE_SIZE);
    expect(asked.isDone).toBe(false);
    const rest = Ref.decodeReturnsSync(
      refs.public.nina.conversation.turns,
      await f.owner.query(turns, {
        chatId: f.chatId,
        paginationOpts: {
          cursor: asked.continueCursor,
          numItems: NINA_MESSAGES_PAGE_SIZE,
        },
      })
    );
    expect(Arr.map(rest.page, (t) => t.order)).toEqual([1]);
  });

  it("answers a reader without the token of the link as it answers for a chat that is not there", async () => {
    const f = await createNinaTest({ history: 1 });
    for (const access of [{}, { shareToken: "A".repeat(43) }]) {
      await expect(
        turnsOf(f.t, { chatId: f.chatId, ...access })
      ).rejects.toMatchObject({ data: { code: "CHAT_NOT_FOUND" } });
    }
  });

  it("names the owner's account and the turn that runs to the owner, and to a reader who holds the share link neither", async () => {
    const f = await fixture();
    await f.owner.mutation(share, {
      chatId: f.chatId,
      visibility: "public",
    });
    const shareToken = await f.owner.query(token, { chatId: f.chatId });
    assert(shareToken !== null);
    const stranger = await f.t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "stranger" })
    );
    const asStranger = f.t.withIdentity({
      sessionId: stranger.sessionId,
      subject: stranger.authUserId,
    });
    const chatOf = async (
      reader: typeof f.owner,
      access: { shareToken?: string }
    ) => (await reader.query(get, { chatId: f.chatId, ...access })).chat;

    // The turn that was admitted is the one that runs, so the owner is told it
    // along with the account, by the chat id and through the share link.
    for (const access of [{}, { shareToken }]) {
      expect(await chatOf(f.owner, access)).toMatchObject({
        activeTurnId: f.turnId,
        userId: f.userId,
      });
    }
    // A reader with no account, and a learner with another account, are told
    // what it takes to show the chat and to read its messages, and no more.
    for (const reader of [f.t, asStranger]) {
      expect(await chatOf(reader, { shareToken })).toEqual({
        _creationTime: expect.any(Number),
        _id: f.chatId,
        threadId: f.threadId,
        title: DEFAULT_TITLE,
        type: "study",
        updatedAt: NOW,
        visibility: "public",
      });
    }
  });

  it("denies anonymous readers of a private chat and follows the newest turn by order", async () => {
    const f = await fixture();
    await expect(f.t.query(get, { chatId: f.chatId })).rejects.toMatchObject({
      data: { code: "CHAT_NOT_FOUND" },
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

  it("shows a queued or running turn as it is until the learner stops it", async () => {
    const f = await fixture();
    const read = async () =>
      Ref.decodeReturnsSync(
        refs.public.nina.conversation.get,
        await f.owner.query(get, { chatId: f.chatId })
      ).turn?.state;
    expect(await read()).toEqual({ status: "queued" });
    await f.t.mutation(claim, { turnId: f.turnId });
    expect(await read()).toEqual({ status: "running", startedAt: NOW });
  });

  it("shows a turn as cancelled from the moment the learner stopped it, before its run has exited", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(NOW + 5000);
    await f.owner.mutation(cancel, { chatId: f.chatId });
    vi.setSystemTime(NOW + 9000);
    const read = async () =>
      Ref.decodeReturnsSync(
        refs.public.nina.conversation.get,
        await f.owner.query(get, { chatId: f.chatId })
      );

    // The turn itself stays open until its run exits, but the page already
    // shows it cancelled, at the time of the stop.
    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId))
    ).toMatchObject({ phase: "active", state: { status: "running" } });
    expect((await read()).turn).toEqual({
      order: f.order,
      promptMessageId: f.promptMessageId,
      promptedAt: NOW,
      state: { status: "cancelled", finishedAt: NOW + 5000 },
      credits: 5,
      usage: [],
    });

    // Settling the turn keeps the time of the stop, so the state the page shows
    // does not move.
    await f.t.mutation(recover, { turnId: f.turnId });
    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId))
    ).toMatchObject({ phase: "settled" });
    expect((await read()).turn?.state).toEqual({
      status: "cancelled",
      finishedAt: NOW + 5000,
    });
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
