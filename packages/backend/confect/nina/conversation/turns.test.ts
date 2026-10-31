import { Ref } from "@confect/core";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createNinaTest } from "@repo/backend/test/nina";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 8, 27, 12);
const get = Ref.getFunctionReference(refs.public.nina.conversation.get);
const turns = Ref.getFunctionReference(refs.public.nina.conversation.turns);
const messagesPage = Ref.getFunctionReference(refs.public.nina.messages.page);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const share = Ref.getFunctionReference(
  refs.public.chats.mutations.updateChatVisibility
);
const token = Ref.getFunctionReference(refs.public.chats.queries.getShareToken);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** A page of the turns that ended, as a reader of the chat is told them, newest first. */
async function turnsOf(
  reader: Pick<Awaited<ReturnType<typeof createNinaTest>>["t"], "query">,
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

describe("Nina conversation turns", () => {
  it("tells the owner everything about a turn that ended, through the turns that ended, and a reader who holds the share link only where it stands", async () => {
    const f = await createNinaTest({ now: NOW });
    const queued = (await f.inspect()).turn;
    assert(queued !== null);
    // What the turn cost, what Nina kept from it and what she suggests next.
    const ownerFacts = {
      remembered: 1,
      suggestions: ["How does a limit relate to continuity?"],
      tokens: { input: 1200, output: 340, total: 1540 },
      usage: [
        {
          agent: "nina",
          calls: 1,
          cost: 0.002,
          input: 1200,
          model: "model-one",
          output: 340,
          provider: "provider-one",
        },
      ],
    } satisfies Partial<Docs["ninaTurns"]>;
    // The admission of the turn records when its prompt was sent.
    await f.t.mutation((ctx) =>
      ctx.db.patch("ninaTurns", f.turnId, { promptedAt: NOW, ...ownerFacts })
    );
    // The turn ends, so the conversation and the turns tell the same of it.
    // The admission commits first, so the end has its own moment.
    const endedAt = NOW + 1000;
    vi.setSystemTime(endedAt);
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
      order: queued.order,
      promptMessageId: f.promptMessageId,
      promptedAt: NOW,
      state: { status: "failed", finishedAt: endedAt, reason: "interrupted" },
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
        ended: await turnsOf(reader, { chatId: f.chatId, ...access }),
      };
    };

    // The owner is told everything, by the chat id and through the share link.
    for (const access of [{}, { shareToken }]) {
      const { conversation, ended } = await read(f.owner, access);
      const known = { ...where, credits: 10, ...ownerFacts };
      expect(conversation.turn).toEqual(known);
      expect(ended).toEqual([known]);
    }
    // A reader with no account, and a learner with another account, are told
    // where the turn stands and nothing of what it cost or what Nina kept.
    for (const reader of [f.t, asStranger]) {
      const { conversation, ended } = await read(reader, { shareToken });
      expect(conversation.turn).toEqual(where);
      expect(ended).toEqual([where]);
      const told = encodeJsonText({ conversation, ended });
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

  it("tells no turn in the page of messages, so only the conversation tells the turn that runs", async () => {
    const f = await createNinaTest({ now: NOW });
    await f.owner.mutation(share, { chatId: f.chatId, visibility: "public" });
    const shareToken = await f.owner.query(token, { chatId: f.chatId });
    assert(shareToken !== null);
    const listed = {
      chatId: f.chatId,
      threadId: f.threadId,
      paginationOpts: { cursor: null, numItems: 20 },
    };
    const lean = Ref.decodeReturnsSync(
      refs.public.nina.messages.page,
      await f.t.query(messagesPage, { ...listed, shareToken })
    );
    expect(lean.page).toHaveLength(1);
    expect(lean.page[0]).not.toHaveProperty("metadata");
    expect(await turnsOf(f.t, { chatId: f.chatId, shareToken })).toEqual([]);
  });

  it("reads the messages of a chat and no turn, so a turn can change without the page being read again", async () => {
    const f = await createNinaTest({ now: NOW });
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
    const f = await createNinaTest({ history: 3, now: NOW });
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
    const f = await createNinaTest({ now: NOW });
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
    const f = await createNinaTest({ history: 1, now: NOW });
    for (const access of [{}, { shareToken: "A".repeat(43) }]) {
      await expect(
        turnsOf(f.t, { chatId: f.chatId, ...access })
      ).rejects.toMatchObject({ data: { code: "CHAT_NOT_FOUND" } });
    }
  });
});
