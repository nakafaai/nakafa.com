import { describe, expect, it } from "@effect/vitest";
import { CHAT_SEARCH_WINDOW } from "@repo/backend/confect/chats/list";
import type { ChatView } from "@repo/backend/confect/chats/view";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { showsText } from "@repo/backend/test/seal";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 9, 10, 12);
const paginationOpts = { cursor: null, numItems: 10 };
const ALGEBRA = "Latihan aljabar linear";
const PHYSICS = "Fisika gerak lurus";
const BOOLEAN = "Aljabar boolean";
const STRANGER = "Aljabar dasar";
const LEGACY = "Aljabar lama";

/**
 * One learner with four chats and a stranger with one. Every title is set
 * through the public rename, so each is stored the way a real write stores it.
 */
async function fixture() {
  const t = createConvexTestWithBetterAuth();
  const [owner, stranger] = await t.mutation((ctx) =>
    Promise.all([
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "list-owner" }),
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "list-stranger" }),
    ])
  );
  const as = (who: typeof owner) =>
    t.withIdentity({ sessionId: who.sessionId, subject: who.authUserId });
  const add = async (
    who: typeof owner,
    visibility: Doc<"chats">["visibility"],
    title?: string
  ) => {
    const chatId = await t.mutation((ctx) =>
      ctx.db.insert("chats", {
        threadId: "fixture-thread",
        type: "study",
        updatedAt: NOW,
        userId: who.userId,
        visibility,
      })
    );
    if (title !== undefined) {
      await as(who).mutation(api.chats.mutations.updateChatTitle, {
        chatId,
        title,
      });
    }
    return chatId;
  };
  await add(owner, "private", ALGEBRA);
  await add(owner, "public", PHYSICS);
  await add(owner, "public");
  await add(owner, "public", BOOLEAN);
  await add(stranger, "public", STRANGER);
  return { asOwner: as(owner), asStranger: as(stranger), owner, stranger, t };
}

/** The titles a page shows, in order. */
const titles = (page: readonly ChatView[]) =>
  Arr.map(page, (chat) => chat.title);

describe("chat lists with sealed titles", () => {
  it("stores every title sealed, so a table export shows no title", async () => {
    const f = await fixture();
    const stored = await f.t.query((ctx) => ctx.db.query("chats").collect());
    expect(stored).toHaveLength(5);
    for (const chat of Arr.filter(stored, (row) => row.title !== undefined)) {
      expect(chat.title).toBeInstanceOf(ArrayBuffer);
      for (const text of [ALGEBRA, PHYSICS, BOOLEAN, STRANGER]) {
        expect(showsText(chat.title, text)).toBe(false);
      }
    }
  });

  it("opens the titles of the owner's list, newest first, page after page", async () => {
    const f = await fixture();
    const all = await f.asOwner.query(api.chats.queries.getOwnChats, {
      paginationOpts,
    });
    expect(titles(all.page)).toEqual([BOOLEAN, undefined, PHYSICS, ALGEBRA]);
    const first = await f.asOwner.query(api.chats.queries.getOwnChats, {
      paginationOpts: { cursor: null, numItems: 3 },
    });
    expect(titles(first.page)).toEqual([BOOLEAN, undefined, PHYSICS]);
    expect(first.isDone).toBe(false);
    const second = await f.asOwner.query(api.chats.queries.getOwnChats, {
      paginationOpts: { cursor: first.continueCursor, numItems: 3 },
    });
    expect(titles(second.page)).toEqual([ALGEBRA]);
    expect(second.isDone).toBe(true);
  });

  it.each([
    ["a word of a title", "aljabar", undefined, [BOOLEAN, ALGEBRA]],
    ["the start of a word", "alja", undefined, [BOOLEAN, ALGEBRA]],
    ["any letter case", "ALJABAR", undefined, [BOOLEAN, ALGEBRA]],
    ["several words", "aljabar linear", undefined, [ALGEBRA]],
    ["words in any order", "linear LATIHAN", undefined, [ALGEBRA]],
    ["no title", "kimia", undefined, []],
    ["a visibility", "aljabar", "public", [BOOLEAN]],
    ["a blank query", "   ", undefined, [BOOLEAN, undefined, PHYSICS, ALGEBRA]],
  ] as const)("searches by %s", async (_name, q, visibility, expected) => {
    const f = await fixture();
    const result = await f.asOwner.query(api.chats.queries.getOwnChats, {
      paginationOpts,
      q,
      ...(visibility === undefined ? {} : { visibility }),
    });
    expect(titles(result.page)).toEqual(expected);
  });

  it("searches a plain title written before October 2026 like a sealed one", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      ctx.db.insert("chats", {
        threadId: "fixture-thread",
        title: LEGACY,
        type: "study",
        updatedAt: NOW,
        userId: f.owner.userId,
        visibility: "private",
      })
    );
    const result = await f.asOwner.query(api.chats.queries.getOwnChats, {
      paginationOpts,
      q: "aljabar",
    });
    expect(titles(result.page)).toEqual([LEGACY, BOOLEAN, ALGEBRA]);
  });

  it("reads a bounded window per search page and reaches older chats through the cursor", async () => {
    const f = await fixture();
    await f.t.mutation(async (ctx) => {
      for (let index = 0; index < CHAT_SEARCH_WINDOW; index += 1) {
        await ctx.db.insert("chats", {
          threadId: "fixture-thread",
          title: `Obrolan ${index}`,
          type: "study",
          updatedAt: NOW,
          userId: f.owner.userId,
          visibility: "private",
        });
      }
    });
    const newest = await f.asOwner.query(api.chats.queries.getOwnChats, {
      paginationOpts,
      q: `Obrolan ${CHAT_SEARCH_WINDOW - 1}`,
    });
    expect(titles(newest.page)).toEqual([`Obrolan ${CHAT_SEARCH_WINDOW - 1}`]);
    expect(newest.isDone).toBe(false);
    // The four older chats lie past the first window: the page says so.
    const first = await f.asOwner.query(api.chats.queries.getOwnChats, {
      paginationOpts,
      q: "aljabar",
    });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    expect(first.continueCursor).not.toBe("");
    const second = await f.asOwner.query(api.chats.queries.getOwnChats, {
      paginationOpts: { cursor: first.continueCursor, numItems: 10 },
      q: "aljabar",
    });
    expect(titles(second.page)).toEqual([BOOLEAN, ALGEBRA]);
    expect(second.isDone).toBe(true);
  });

  it("returns every match of a window whatever page size was asked, and ends at the oldest chat", async () => {
    const f = await fixture();
    const result = await f.asOwner.query(api.chats.queries.getOwnChats, {
      paginationOpts: { cursor: null, numItems: 1 },
      q: "aljabar",
    });
    expect(titles(result.page)).toEqual([BOOLEAN, ALGEBRA]);
    expect(result.isDone).toBe(true);
  });

  it("searches only the titles of the learner who asks", async () => {
    const f = await fixture();
    const own = await f.asStranger.query(api.chats.queries.getOwnChats, {
      paginationOpts,
      q: "aljabar",
    });
    expect(titles(own.page)).toEqual([STRANGER]);
    const other = await f.t.query(api.chats.queries.getChats, {
      paginationOpts,
      q: "aljabar",
      userId: f.stranger.userId,
    });
    expect(titles(other.page)).toEqual([STRANGER]);
  });

  it("shows anyone the opened titles of a learner's public chats and searches them", async () => {
    const f = await fixture();
    const list = await f.t.query(api.chats.queries.getChats, {
      paginationOpts,
      type: "study",
      userId: f.owner.userId,
    });
    expect(titles(list.page)).toEqual([BOOLEAN, undefined, PHYSICS]);
    const found = await f.t.query(api.chats.queries.getChats, {
      paginationOpts,
      q: "fisika",
      userId: f.owner.userId,
    });
    expect(titles(found.page)).toEqual([PHYSICS]);
    const hidden = await f.t.query(api.chats.queries.getChats, {
      paginationOpts,
      q: "latihan",
      userId: f.owner.userId,
    });
    expect(hidden.page).toEqual([]);
  });
});
