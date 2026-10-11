import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { startMemories } from "@repo/backend/confect/nina/memory/start";
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
 * The words of the memories a turn starts with for these topics, in order. A
 * turn first reads what the learner deleted with "Delete all", and so does
 * this.
 */
function started(
  f: Awaited<ReturnType<typeof createMemoryTest>>,
  topics: readonly string[]
) {
  return f.execute(
    Effect.gen(function* () {
      const { clearedAt } = yield* readMemoryState(f.identity.userId);
      const memories = yield* startMemories(
        f.identity.userId,
        topics,
        NOW,
        clearedAt
      );
      return Arr.map(memories, (memory) => memory.text);
    })
  );
}

/** Memory 9 down to Memory 3 of ten: the most recently confirmed, as many as `count`. */
const newest = (count: number) =>
  Arr.makeBy(count, (index) => `Memory ${9 - index}`);

describe("memories a turn starts with", () => {
  it("puts the memories for the open page first and fills the rest with the most recently confirmed", async () => {
    const f = await createMemoryTest();
    await f.fill(10);
    await f.seed({
      confirmedAt: 0,
      text: "About the lesson",
      topics: [LESSON],
    });
    await f.seed({ confirmedAt: 0, text: "About another", topics: [OTHER] });
    expect(await started(f, [LESSON])).toEqual([
      "About the lesson",
      ...newest(7),
    ]);
  });

  it("starts with the most recently confirmed when no page has a topic, and none that the page does not link", async () => {
    const f = await createMemoryTest();
    await f.fill(10);
    expect(await started(f, [])).toEqual(newest(8));
    expect(await started(f, [LESSON])).toEqual(newest(8));
  });

  it("starts with the eight best memories of the page alone when it has that many", async () => {
    const f = await createMemoryTest();
    await f.fill(12, { topics: [LESSON] });
    await f.seed({ confirmedAt: 99, text: "Newest elsewhere" });
    expect(await started(f, [LESSON])).toEqual(
      Arr.makeBy(8, (index) => `Memory ${11 - index}`)
    );
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
    expect(await started(f, [LESSON])).toEqual(["About the lesson", "Newest"]);
  });

  it("fills every place from older memories when most of the newest have ended and the daily job has not deleted them", async () => {
    const f = await createMemoryTest();
    await f.fill(10);
    // Nine situations that ended, confirmed after the ten: they fill all but
    // seven of the newest sixteen memories.
    for (const index of Arr.range(0, 8)) {
      await f.seed({
        confirmedAt: 100 + index,
        kind: "situation",
        text: `Ended ${index}`,
        validUntil: NOW - 1,
      });
    }
    expect(await started(f, [])).toEqual(newest(8));
  });

  it("starts with nothing for a learner who has no memory", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Not theirs", topics: [LESSON] });
    expect(
      await f.execute(startMemories(other.userId, [LESSON], NOW, undefined))
    ).toEqual([]);
  });

  it("starts with neither the page's memories nor the newest that the learner deleted with Delete all", async () => {
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
    // older still: the learner deleted them. The turn starts with what is left.
    expect(await started(f, [LESSON])).toEqual([
      "Memory 9",
      "Memory 8",
      "Memory 7",
      "Memory 6",
    ]);
  });
});
