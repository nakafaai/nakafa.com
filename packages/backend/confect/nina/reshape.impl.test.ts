import { Ref } from "@confect/core";
import { assert, describe, expect, it } from "@effect/vitest";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { PAGE_SIZE } from "@repo/backend/confect/nina/reshape.spec";
import { createNinaTest } from "@repo/backend/test/nina";
import { oldestFields, oldPage } from "@repo/backend/test/nina/legacy";
import { homePage, lessonPage } from "@repo/backend/test/nina/page";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 9, 13, 12);
const rewrite = Ref.getFunctionReference(refs.internal.nina.reshape.rewrite);

/**
 * A chat with the turns of every kind a pass tells apart. Four are in the old
 * shape: the active turn the fixture queues, a settled turn with the page of a
 * lesson, a settled turn of a pinned chat (which stored `pinned-chat` and
 * `same-context`), and the oldest kind, which holds the copy of its context on
 * the turn and has no page. Two are not: a settled turn written now, and a
 * settled turn that never had a page.
 */
async function fixture() {
  const f = await createNinaTest({ legacy: true, now: NOW });
  /** Stores one settled turn of the chat at `order`, with the fields a test gives it. */
  const settle = (
    order: number,
    fields: Pick<Partial<Docs["ninaTurns"]>, "page" | "snapshot" | "transition">
  ) =>
    f.t.mutation((ctx) =>
      ctx.db.insert("ninaTurns", {
        phase: "settled",
        chatId: f.chatId,
        userId: f.identity.userId,
        threadId: f.threadId,
        promptMessageId: `prompt-${order}`,
        order,
        usage: [],
        state: { status: "complete", finishedAt: NOW },
        ...fields,
      })
    );
  const ids = {
    active: f.turnId,
    lesson: await settle(100, { page: oldPage(lessonPage) }),
    pinned: await settle(101, { page: oldPage(homePage, { pinned: true }) }),
    oldest: await settle(102, oldestFields(homePage)),
    current: await settle(103, { page: lessonPage }),
    bare: await settle(104, {}),
  };
  const row = async (id: Docs["ninaTurns"]["_id"]) => {
    const turn = await f.t.query((ctx) => ctx.db.get("ninaTurns", id));
    assert.ok(turn, "Expected the turn to be stored.");
    return turn;
  };
  const everyRow = () =>
    f.t.query((ctx) => ctx.db.query("ninaTurns").collect());
  return { ...f, everyRow, ids, row, settle };
}

describe("nina/reshape", () => {
  it("counts the turns in the old shape in a dry pass and writes nothing", async () => {
    const f = await fixture();
    const before = await f.everyRow();

    expect(await f.t.mutation(rewrite, { cursor: null, dry: true })).toEqual({
      next: null,
      old: 4,
      rewritten: 0,
    });
    expect(await f.everyRow()).toEqual(before);
  });

  it("rewrites each turn in the old shape into the new shape, keeps the rest of it, and leaves the other turns alone", async () => {
    const f = await fixture();
    const { active, bare, current, lesson, oldest, pinned } = f.ids;
    const activeBefore = await f.row(active);
    const lessonBefore = await f.row(lesson);
    const { snapshot, transition, ...oldestKept } = await f.row(oldest);
    const untouched = [await f.row(current), await f.row(bare)];
    // The oldest turn does hold what the pass removes from it.
    expect(snapshot).toBeDefined();
    expect(transition).toBeDefined();

    expect(await f.t.mutation(rewrite, { cursor: null, dry: false })).toEqual({
      next: null,
      old: 4,
      rewritten: 4,
    });

    // A turn in the old shape keeps all it stored but what nothing reads.
    expect(await f.row(active)).toEqual({ ...activeBefore, page: homePage });
    expect(await f.row(lesson)).toEqual({ ...lessonBefore, page: lessonPage });
    expect((await f.row(pinned)).page).toEqual(homePage);
    expect(await f.row(oldest)).toEqual(oldestKept);
    // A turn in the new shape, and a turn with no page, are not touched.
    expect([await f.row(current), await f.row(bare)]).toEqual(untouched);
    // A second pass finds nothing to rewrite.
    expect(await f.t.mutation(rewrite, { cursor: null, dry: false })).toEqual({
      next: null,
      old: 0,
      rewritten: 0,
    });
  });

  it("makes the stored turns smaller", async () => {
    const f = await fixture();
    const sized = async () =>
      Arr.map(
        [
          await f.row(f.ids.active),
          await f.row(f.ids.lesson),
          await f.row(f.ids.oldest),
        ],
        (turn) => encodeJsonText(turn).length
      );
    const before = await sized();

    await f.t.mutation(rewrite, { cursor: null, dry: false });

    expect(
      Arr.zipWith(await sized(), before, (after, then) => after < then)
    ).toEqual([true, true, true]);
  });

  it("reads every turn by the cursor of the call before, a page at a time", async () => {
    const f = await fixture();
    // More turns than one page holds, with the last old turn on the second page.
    for (let order = 200; order < 200 + PAGE_SIZE; order += 1) {
      await f.settle(order, {});
    }
    const late = await f.settle(300, { page: oldPage(lessonPage) });

    const first = await f.t.mutation(rewrite, { cursor: null, dry: true });
    // The first page holds the fixture's four old turns and ends before the late one.
    expect(first).toEqual({ next: expect.any(String), old: 4, rewritten: 0 });
    assert.ok(first.next !== null, "Expected a second page.");
    expect(
      await f.t.mutation(rewrite, { cursor: first.next, dry: true })
    ).toEqual({ next: null, old: 1, rewritten: 0 });

    const written = await f.t.mutation(rewrite, { cursor: null, dry: false });
    assert.ok(written.next !== null, "Expected a second page.");
    expect(written).toEqual({ next: expect.any(String), old: 4, rewritten: 4 });
    expect(
      await f.t.mutation(rewrite, { cursor: written.next, dry: false })
    ).toEqual({ next: null, old: 1, rewritten: 1 });
    expect((await f.row(late)).page).toEqual(lessonPage);
    // A dry pass over both pages finds none left.
    expect(await f.t.mutation(rewrite, { cursor: null, dry: true })).toEqual({
      next: expect.any(String),
      old: 0,
      rewritten: 0,
    });
    expect(
      await f.t.mutation(rewrite, { cursor: first.next, dry: true })
    ).toEqual({ next: null, old: 0, rewritten: 0 });
  });
});
