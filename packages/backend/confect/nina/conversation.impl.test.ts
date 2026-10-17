import { Ref } from "@confect/core";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { DEFAULT_TITLE } from "@repo/backend/client/nina/presentation";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { contextFor } from "@repo/backend/test/nina/admission";
import { encodeJsonText } from "@repo/utilities/json";

vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
const NOW = Date.UTC(2026, 8, 27, 12);
const get = Ref.getFunctionReference(refs.public.nina.conversation.get);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const messages = Ref.getFunctionReference(refs.public.nina.messages.page);
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
      contextFor("home", { role: "teacher" })
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
      refs.public.nina.messages.page,
      await f.t.query(messages, { ...listed, shareToken })
    );
    expect(page.page).toHaveLength(1);
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
      state: { status: "queued" },
      usage: [],
    };
    const listed = {
      chatId: f.chatId,
      threadId: f.threadId,
      paginationOpts: { cursor: null, numItems: 20 },
    };
    const read = async (
      reader: typeof f.owner,
      access: { shareToken?: string }
    ) => {
      const conversation = Ref.decodeReturnsSync(
        refs.public.nina.conversation.get,
        await reader.query(get, { chatId: f.chatId, ...access })
      );
      const page = Ref.decodeReturnsSync(
        refs.public.nina.messages.page,
        await reader.query(messages, { ...listed, ...access })
      );
      return { conversation, page };
    };

    // The owner is told everything, by the chat id and through the share link.
    for (const access of [{}, { shareToken }]) {
      const { conversation, page } = await read(f.owner, access);
      const known = { ...where, credits: 5, ...ownerFacts };
      expect(conversation.turn).toEqual(known);
      expect(page.page).toHaveLength(1);
    }
    // A reader with no account, and a learner with another account, are told
    // where the turn stands and nothing of what it cost or what Nina kept.
    for (const reader of [f.t, asStranger]) {
      const { conversation, page } = await read(reader, { shareToken });
      expect(conversation.turn).toEqual(where);
      expect(page.page).toHaveLength(1);
      const told = encodeJsonText({ conversation, page });
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
