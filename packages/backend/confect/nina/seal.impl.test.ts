import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { showsText } from "@repo/backend/test/seal";
import { Array as Arr, Predicate } from "effect";

const sealPlain = Ref.getFunctionReference(refs.internal.nina.seal.sealPlain);
const saveSummary = Ref.getFunctionReference(refs.internal.nina.summaries.save);
const readSummary = Ref.getFunctionReference(refs.internal.nina.summaries.read);

const NOW = Date.UTC(2026, 9, 10, 12);
const FIRST_PASS = { chats: 0, summaries: 0 } as const;
const PAGE = 100;
const ALGEBRA = "Latihan aljabar linear";
const PHYSICS = "Fisika gerak lurus";
const CHEMISTRY = "Kimia asam dan basa";
const ALGEBRA_SUMMARY = "- Aljabar linear, matriks dua kali dua.";
const PHYSICS_SUMMARY = "- Gerak lurus beraturan.";
const CHEMISTRY_SUMMARY = "- Larutan asam kuat.";
const ORPHAN_SUMMARY = "- Ringkasan tanpa obrolan.";
const USAGE = { calls: 1, input: 10, output: 5 };

/** Two learners, writers for the old stored forms, and readers of the tables. */
async function fixture() {
  const t = createConvexTestWithBetterAuth();
  const [first, second] = await t.mutation((ctx) =>
    Promise.all([
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "seal-first" }),
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "seal-second" }),
    ])
  );
  const as = (who: typeof first) =>
    t.withIdentity({ sessionId: who.sessionId, subject: who.authUserId });
  /** A chat as written before October 2026: its title is plain text. */
  const addChat = (who: typeof first, title?: string) =>
    t.mutation((ctx) =>
      ctx.db.insert("chats", {
        threadId: "fixture-thread",
        type: "study",
        updatedAt: NOW,
        userId: who.userId,
        visibility: "private",
        ...(title === undefined ? {} : { title }),
      })
    );
  /** A summary as written before October 2026: its text is plain. */
  const addSummary = (chatId: Id<"chats">, text: string) =>
    t.mutation((ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId,
        text,
        throughOrder: 3,
        updatedAt: NOW,
        usage: USAGE,
      })
    );
  const snapshot = () =>
    t.query(async (ctx) => ({
      chats: await ctx.db.query("chats").collect(),
      keys: await ctx.db.query("vaultKeys").collect(),
      summaries: await ctx.db.query("ninaSummaries").collect(),
    }));
  const chatOf = (chatId: Id<"chats">) =>
    t.query((ctx) => ctx.db.get("chats", chatId));
  return { addChat, addSummary, as, chatOf, first, second, snapshot, t };
}

/** Chats and summaries in every stored form the migration meets. */
async function mixed() {
  const f = await fixture();
  const plain = await f.addChat(f.first, ALGEBRA);
  const sealed = await f.addChat(f.first);
  await f.as(f.first).mutation(api.chats.mutations.updateChatTitle, {
    chatId: sealed,
    title: PHYSICS,
  });
  const untitled = await f.addChat(f.first);
  const other = await f.addChat(f.second, CHEMISTRY);
  const gone = await f.addChat(f.second);
  await f.addSummary(plain, ALGEBRA_SUMMARY);
  await f.t.mutation(saveSummary, {
    chatId: sealed,
    text: PHYSICS_SUMMARY,
    throughOrder: 3,
    usage: { input: 10, output: 5 },
  });
  await f.addSummary(other, CHEMISTRY_SUMMARY);
  await f.addSummary(gone, ORPHAN_SUMMARY);
  await f.t.mutation((ctx) => ctx.db.delete("chats", gone));
  return { ...f, other, plain, sealed, untitled };
}

/** The bytes of a sealed value, none for plain text. */
const bytesOf = (value: string | ArrayBuffer | undefined) =>
  value === undefined || Predicate.isString(value)
    ? undefined
    : new Uint8Array(value);

describe("nina/seal", () => {
  it("seals every plain title and summary under the key of its owner and leaves the rest", async () => {
    const f = await mixed();
    const sealedBefore = bytesOf((await f.chatOf(f.sealed))?.title);
    expect(sealedBefore).toBeDefined();
    expect((await f.snapshot()).keys).toHaveLength(1);

    expect(await f.t.mutation(sealPlain, FIRST_PASS)).toEqual({
      chats: { next: null, sealed: 2 },
      summaries: { next: null, sealed: 2 },
    });

    for (const [chatId, text] of [
      [f.plain, ALGEBRA],
      [f.sealed, PHYSICS],
      [f.other, CHEMISTRY],
    ] as const) {
      const title = (await f.chatOf(chatId))?.title;
      expect(title).toBeInstanceOf(ArrayBuffer);
      expect(showsText(title, text)).toBe(false);
    }
    // A sealed row is not rewritten, and a chat without a title gets none.
    expect(bytesOf((await f.chatOf(f.sealed))?.title)).toEqual(sealedBefore);
    expect(await f.chatOf(f.untitled)).not.toHaveProperty("title");

    const { keys, summaries } = await f.snapshot();
    const texts = Arr.map(summaries, (summary) => summary.text);
    // A summary whose chat is gone has no owner key to seal it with.
    expect(Arr.filter(texts, Predicate.isString)).toEqual([ORPHAN_SUMMARY]);
    for (const text of [ALGEBRA_SUMMARY, PHYSICS_SUMMARY, CHEMISTRY_SUMMARY]) {
      expect(Arr.some(texts, (stored) => showsText(stored, text))).toBe(false);
    }
    // The first learner's key was reused and the second learner's was created.
    expect(Arr.map(keys, (key) => key.userId)).toEqual([
      f.first.userId,
      f.second.userId,
    ]);
  });

  it("opens what it sealed for the learner who owns the chat", async () => {
    const f = await mixed();
    await f.t.mutation(sealPlain, FIRST_PASS);
    const getChat = api.chats.queries.getChat;
    expect(
      await f.as(f.first).query(getChat, { chatId: f.plain })
    ).toMatchObject({ title: ALGEBRA });
    expect(
      await f.as(f.first).query(getChat, { chatId: f.sealed })
    ).toMatchObject({ title: PHYSICS });
    expect(
      await f.as(f.second).query(getChat, { chatId: f.other })
    ).toMatchObject({ title: CHEMISTRY });
    expect(await f.t.query(readSummary, { chatId: f.plain })).toEqual({
      text: ALGEBRA_SUMMARY,
      throughOrder: 3,
    });
    expect(await f.t.query(readSummary, { chatId: f.sealed })).toEqual({
      text: PHYSICS_SUMMARY,
      throughOrder: 3,
    });
    expect(await f.t.query(readSummary, { chatId: f.other })).toEqual({
      text: CHEMISTRY_SUMMARY,
      throughOrder: 3,
    });
    // Another learner still cannot read a private chat.
    await expect(
      f.as(f.second).query(getChat, { chatId: f.plain })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("seals nothing on a second pass and leaves every row as it was", async () => {
    const f = await mixed();
    await f.t.mutation(sealPlain, FIRST_PASS);
    const sealed = await f.snapshot();
    expect(await f.t.mutation(sealPlain, FIRST_PASS)).toEqual({
      chats: { next: null, sealed: 0 },
      summaries: { next: null, sealed: 0 },
    });
    expect(await f.snapshot()).toEqual(sealed);
  });

  it("scans one page of each table and resumes from the cursor it returns", async () => {
    const f = await fixture();
    await f.t.mutation(async (ctx) => {
      for (let index = 0; index <= PAGE; index += 1) {
        const chatId = await ctx.db.insert("chats", {
          threadId: "fixture-thread",
          title: `Obrolan ${index}`,
          type: "study",
          updatedAt: NOW,
          userId: f.first.userId,
          visibility: "private",
        });
        await ctx.db.insert("ninaSummaries", {
          chatId,
          text: `- Ringkasan ${index}.`,
          throughOrder: 3,
          updatedAt: NOW,
          usage: USAGE,
        });
      }
    });
    const rows = await f.snapshot();
    expect(rows.chats).toHaveLength(PAGE + 1);

    const page = await f.t.mutation(sealPlain, FIRST_PASS);
    expect(page.chats.sealed).toBe(PAGE);
    expect(page.summaries.sealed).toBe(PAGE);
    expect(page.chats.next).toBe(rows.chats[PAGE - 1]?._creationTime);
    expect(page.summaries.next).toBe(rows.summaries[PAGE - 1]?._creationTime);
    const midway = await f.snapshot();
    expect(
      Arr.filter(midway.chats, (chat) => Predicate.isString(chat.title))
    ).toHaveLength(1);

    expect(
      await f.t.mutation(sealPlain, {
        chats: page.chats.next,
        summaries: page.summaries.next,
      })
    ).toEqual({
      chats: { next: null, sealed: 1 },
      summaries: { next: null, sealed: 1 },
    });
    const done = await f.snapshot();
    expect(
      Arr.filter(done.chats, (chat) => Predicate.isString(chat.title))
    ).toEqual([]);
    expect(
      Arr.filter(done.summaries, (summary) => Predicate.isString(summary.text))
    ).toEqual([]);
    // One key serves every row of the learner.
    expect(done.keys).toHaveLength(1);
  });

  it("leaves a table alone when its cursor is null", async () => {
    const f = await mixed();
    expect(
      await f.t.mutation(sealPlain, { chats: null, summaries: 0 })
    ).toEqual({
      chats: { next: null, sealed: 0 },
      summaries: { next: null, sealed: 2 },
    });
    const { chats } = await f.snapshot();
    expect(
      Arr.filter(
        Arr.map(chats, (chat) => chat.title),
        Predicate.isString
      )
    ).toEqual([ALGEBRA, CHEMISTRY]);
    expect(
      await f.t.mutation(sealPlain, { chats: 0, summaries: null })
    ).toEqual({
      chats: { next: null, sealed: 2 },
      summaries: { next: null, sealed: 0 },
    });
  });
});
