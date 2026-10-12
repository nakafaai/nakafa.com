import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { recallMemories } from "@repo/backend/confect/nina/memory/recall";
import { readMemoryState } from "@repo/backend/confect/nina/memory/store";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { Array as Arr, Effect } from "effect";

const NOW = Date.UTC(2026, 9, 10, 12);
const LESSON = "lesson:material:lesson:mathematics:material-section:limits";
const OTHER = "lesson:material:lesson:mathematics:material-section:series";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/**
 * The words of the memories a turn recalls for what the learner said and the
 * topics of the open page, in order. A turn first reads what the learner
 * deleted with "Delete all", and so does this.
 */
function recalled(
  f: Awaited<ReturnType<typeof createMemoryTest>>,
  said: string,
  topics: readonly string[] = []
) {
  return f.execute(
    Effect.gen(function* () {
      const { clearedAt } = yield* readMemoryState(f.identity.userId);
      const memories = yield* recallMemories({
        clearedAt,
        now: NOW,
        said,
        topics,
        userId: f.identity.userId,
      });
      return Arr.map(memories, (memory) => memory.text);
    })
  );
}

/** Memory 9 down to Memory 7 of ten: the most recently confirmed, as many as `count`. */
const newest = (count: number) =>
  Arr.makeBy(count, (index) => `Memory ${9 - index}`);

describe("memories a turn recalls", () => {
  it("puts the memories that fit the message and the page first, the best first, and fills the rest up to three with the most recently confirmed", async () => {
    const f = await createMemoryTest();
    await f.fill(10);
    await f.seed({
      confirmedAt: 0,
      text: "Sulit di peluang",
      topics: [LESSON],
    });
    await f.seed({ confirmedAt: 0, text: "Hobi main gitar", topics: [OTHER] });
    // The memory of the open lesson that holds a word of the message is the
    // only match, though it is the oldest, and the two newest fill the list.
    expect(await recalled(f, "peluang", [LESSON])).toEqual([
      "Sulit di peluang",
      ...newest(2),
    ]);
  });

  it("recalls only what fits when three or more memories do, and no more than eight", async () => {
    const f = await createMemoryTest();
    await f.fill(12, { text: "Aku suka limit" });
    await f.seed({ confirmedAt: 99, text: "Hobi main gitar" });
    const found = await recalled(f, "limit");
    expect(found).toEqual(Arr.makeBy(8, () => "Aku suka limit"));
    await f.seed({ confirmedAt: 50, text: "Sulit di peluang" });
    await f.seed({ confirmedAt: 51, text: "Hobi main drum" });
    await f.seed({ confirmedAt: 52, text: "Hobi main bass" });
    // Three matches fill the floor, so the newest memory is not added.
    await f.seed({ confirmedAt: 200, text: "Newest elsewhere" });
    expect(await recalled(f, "main", [])).toEqual([
      "Hobi main gitar",
      "Hobi main bass",
      "Hobi main drum",
    ]);
  });

  it("recalls the most recently confirmed up to three when the message and the page fit nothing", async () => {
    const f = await createMemoryTest();
    await f.fill(10);
    expect(await recalled(f, "")).toEqual(newest(3));
    expect(await recalled(f, "tidak ada", [LESSON])).toEqual(newest(3));
  });

  it("recalls fewer than three when the learner has fewer", async () => {
    const f = await createMemoryTest();
    await f.fill(2);
    expect(await recalled(f, "")).toEqual(["Memory 1", "Memory 0"]);
  });

  it("fills with memories that are not there yet and have not ended", async () => {
    const f = await createMemoryTest();
    await f.seed({
      confirmedAt: 1,
      text: "About the lesson",
      topics: [LESSON],
    });
    await f.seed({
      confirmedAt: 99,
      kind: "situation",
      text: "Ended",
      validUntil: NOW - 1,
    });
    await f.seed({ confirmedAt: 98, text: "Newest" });
    expect(await recalled(f, "", [LESSON])).toEqual([
      "About the lesson",
      "Newest",
    ]);
  });

  it("fills every place from older memories when most of the newest have ended and the daily job has not deleted them", async () => {
    const f = await createMemoryTest();
    await f.fill(10);
    // Twenty situations that ended, confirmed after the ten: of the newest 24
    // memories only four are left, and the fill needs three.
    for (const index of Arr.range(0, 19)) {
      await f.seed({
        confirmedAt: 100 + index,
        kind: "situation",
        text: `Ended ${index}`,
        validUntil: NOW - 1,
      });
    }
    expect(await recalled(f, "")).toEqual(newest(3));
  });

  it("recalls nothing for a learner who has no memory", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Not theirs", topics: [LESSON] });
    expect(
      await f.execute(
        recallMemories({
          clearedAt: undefined,
          now: NOW,
          said: "theirs",
          topics: [LESSON],
          userId: other.userId,
        })
      )
    ).toEqual([]);
  });

  it("recalls neither the page's memories nor the newest that the learner deleted with Delete all", async () => {
    const f = await createMemoryTest();
    await f.seed({
      confirmedAt: 1,
      text: "About the lesson",
      topics: [LESSON],
    });
    await f.fill(10);
    // The learner asked at 6, and no batch has run yet.
    await f.markCleared(6);
    // Memories 0 to 5 are confirmed at or before 6, and the lesson's memory is
    // older still: the learner deleted them. The turn recalls what is left.
    expect(await recalled(f, "", [LESSON])).toEqual([
      "Memory 9",
      "Memory 8",
      "Memory 7",
    ]);
  });
});
