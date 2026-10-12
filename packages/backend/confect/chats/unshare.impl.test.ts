import { Ref } from "@confect/core";
import { assert, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 9, 12, 8, 0, 0);
const closeLegacy = Ref.getFunctionReference(
  refs.internal.chats.unshare.closeLegacy
);
const getChat = Ref.getFunctionReference(refs.public.chats.queries.getChat);
const getShareToken = Ref.getFunctionReference(
  refs.public.chats.queries.getShareToken
);

/** Two learners with a chat of every kind a pass tells apart. */
async function fixture() {
  const t = createConvexTestWithBetterAuth();
  const { first, second } = await t.mutation(async (ctx) => ({
    first: await seedAuthenticatedUser(ctx, { now: NOW, suffix: "first" }),
    second: await seedAuthenticatedUser(ctx, { now: NOW, suffix: "second" }),
  }));
  const insert = (
    userId: typeof first.userId,
    visibility: "private" | "public"
  ) =>
    t.mutation((ctx) =>
      ctx.db.insert("chats", {
        threadId: "fixture-thread",
        type: "study",
        updatedAt: NOW,
        userId,
        visibility,
      })
    );
  const ids = {
    legacyFirst: await insert(first.userId, "public"),
    legacySecond: await insert(second.userId, "public"),
    privateFirst: await insert(first.userId, "private"),
    shared: await insert(first.userId, "private"),
  };
  const asFirst = t.withIdentity({
    subject: first.authUserId,
    sessionId: first.sessionId,
  });
  await asFirst.mutation(api.chats.mutations.updateChatVisibility, {
    chatId: ids.shared,
    visibility: "public",
  });
  /** The visibility of the four chats, in the order the fixture made them. */
  const visibilities = () =>
    t.query(async (ctx) =>
      Arr.map(
        await Promise.all(
          Arr.map(
            [ids.legacyFirst, ids.legacySecond, ids.privateFirst, ids.shared],
            (id) => ctx.db.get("chats", id)
          )
        ),
        (chat) => chat?.visibility
      )
    );
  return { t, asFirst, ids, insert, first, visibilities };
}

describe("chats/unshare", () => {
  it("counts the public chats without a token in a dry pass and writes nothing", async () => {
    const { t, visibilities } = await fixture();
    const before = ["public", "public", "private", "public"];
    expect(await visibilities()).toEqual(before);
    expect(await t.mutation(closeLegacy, { cursor: null, dry: true })).toEqual({
      closed: 0,
      legacy: 2,
      next: null,
      shared: 1,
    });
    expect(await visibilities()).toEqual(before);
  });

  it("sets the public chats without a token to private and leaves shared and private chats alone", async () => {
    const { t, asFirst, ids, visibilities } = await fixture();
    expect(await t.mutation(closeLegacy, { cursor: null, dry: false })).toEqual(
      { closed: 2, legacy: 2, next: null, shared: 1 }
    );
    expect(await visibilities()).toEqual([
      "private",
      "private",
      "private",
      "public",
    ]);
    // The shared chat keeps the token its owner can copy.
    const shareToken = await asFirst.query(getShareToken, {
      chatId: ids.shared,
    });
    assert(shareToken !== null);
    expect(
      await t.query(getChat, { chatId: ids.shared, shareToken })
    ).toMatchObject({ visibility: "public" });
    // A second pass finds nothing to close.
    expect(await t.mutation(closeLegacy, { cursor: null, dry: false })).toEqual(
      { closed: 0, legacy: 0, next: null, shared: 1 }
    );
  });

  it("reads every chat by the cursor of the call before", async () => {
    const { t, first, insert, visibilities } = await fixture();
    // More chats than one page holds, with the last public chat on the second page.
    for (let count = 0; count < 100; count += 1) {
      await insert(first.userId, "private");
    }
    const late = await insert(first.userId, "public");
    const totals = { calls: 0, closed: 0, legacy: 0, shared: 0 };
    let cursor: string | null = null;
    do {
      const page: Ref.Returns<typeof refs.internal.chats.unshare.closeLegacy> =
        await t.mutation(closeLegacy, { cursor, dry: false });
      totals.calls += 1;
      totals.closed += page.closed;
      totals.legacy += page.legacy;
      totals.shared += page.shared;
      cursor = page.next;
    } while (cursor !== null);
    expect(totals).toEqual({ calls: 2, closed: 3, legacy: 3, shared: 1 });
    expect(
      (await t.query((ctx) => ctx.db.get("chats", late)))?.visibility
    ).toBe("private");
    expect(await visibilities()).toEqual([
      "private",
      "private",
      "private",
      "public",
    ]);
  });
});
