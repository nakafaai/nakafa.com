import { describe, expect, it } from "@effect/vitest";
import {
  newestFirst,
  selectMemories,
} from "@repo/backend/confect/nina/memory/select";
import {
  MEMORY_PROMPT_LIMIT,
  type NinaMemory,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 9, 10);
const LESSON = "material:lesson:mathematics:material-section:limits";

/** A memory with only the fields selection reads, named by `text`. */
function memory(
  text: string,
  fields: Partial<
    Pick<
      typeof NinaMemory.Type,
      "author" | "confirmedAt" | "kind" | "lesson" | "validUntil"
    >
  > = {}
) {
  return {
    author: "nina",
    confirmedAt: 1,
    kind: "goal",
    text,
    ...fields,
  } as const;
}

/** The names of the memories selected for a lesson, in the order Nina reads them. */
function chosen(memories: ReturnType<typeof memory>[], lesson?: string) {
  return Arr.map(
    selectMemories(memories, { lesson, now: NOW }),
    (item) => item.text
  );
}

describe("memory selection", () => {
  it("reads the learner's own words first, then the open lesson, then the newest", () => {
    expect(
      chosen(
        [
          memory("old", { confirmedAt: 1 }),
          memory("newest", { confirmedAt: 9 }),
          memory("lesson", { confirmedAt: 2, lesson: LESSON }),
          memory("other lesson", { confirmedAt: 8, lesson: "another" }),
          memory("learner", { author: "learner", confirmedAt: 3 }),
          memory("learner lesson", {
            author: "learner",
            confirmedAt: 4,
            lesson: LESSON,
          }),
        ],
        LESSON
      )
    ).toEqual([
      "learner lesson",
      "learner",
      "lesson",
      "newest",
      "other lesson",
      "old",
    ]);
  });

  it("ranks no memory above another for a lesson when none is open", () => {
    expect(
      chosen([
        memory("lesson", { confirmedAt: 2, lesson: LESSON }),
        memory("newest", { confirmedAt: 9 }),
      ])
    ).toEqual(["newest", "lesson"]);
  });

  it("drops a situation whose end date has passed and keeps the rest", () => {
    expect(
      chosen([
        memory("ended", { kind: "situation", validUntil: NOW - 1 }),
        memory("today", { kind: "situation", validUntil: NOW }),
        memory("open-ended", { kind: "situation" }),
        memory("goal", { confirmedAt: 5, validUntil: NOW - 1 }),
      ])
    ).toEqual(["goal", "today", "open-ended"]);
  });

  it("takes at most the prompt limit", () => {
    const many = Arr.makeBy(MEMORY_PROMPT_LIMIT + 5, (index) =>
      memory(`memory ${index}`, { confirmedAt: index })
    );
    const selected = chosen(many);
    expect(selected).toHaveLength(MEMORY_PROMPT_LIMIT);
    expect(selected[0]).toBe(`memory ${MEMORY_PROMPT_LIMIT + 4}`);
  });
});

describe("memory order", () => {
  it("puts the most recently confirmed first and the newer row of a tie", () => {
    const rows = [
      { _creationTime: 1, confirmedAt: 5, name: "first" },
      { _creationTime: 3, confirmedAt: 5, name: "tied" },
      { _creationTime: 2, confirmedAt: 9, name: "newest" },
      { _creationTime: 9, confirmedAt: 1, name: "oldest" },
    ];
    expect(Arr.map(Arr.sort(rows, newestFirst), (row) => row.name)).toEqual([
      "newest",
      "tied",
      "first",
      "oldest",
    ]);
  });
});
