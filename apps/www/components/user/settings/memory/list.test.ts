import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { MEMORY_TEXT_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Schema } from "effect";
import {
  addMemory,
  canSave,
  clearMemories,
  editMemory,
  isPending,
  learnerMemory,
  type Memory,
  type MemoryList,
  pauseMemories,
  pendingId,
  previewText,
  removeMemory,
  shownMemories,
} from "@/components/user/settings/memory/list";

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));

/** A stored memory written by Nina, with the fields a test changes spelled out. */
function stored(name: string, change: Partial<Memory> = {}): Memory {
  return {
    author: "nina",
    confirmedAt: 1000,
    createdAt: 500,
    id: memoryId(name),
    inUse: true,
    sources: 2,
    text: `Text of ${name}`,
    ...change,
  };
}

function listOf(memories: Memory[], paused = false): MemoryList {
  return { memories, paused };
}

const ids = (memories: readonly Memory[]) => Arr.map(memories, ({ id }) => id);

describe("memory list", () => {
  it("tells a memory the server has not stored yet from a stored one", () => {
    expect(isPending(stored("a", { id: pendingId("token") }))).toBe(true);
    expect(isPending(stored("a"))).toBe(false);
  });

  it("builds the learner's own memory for words just written", () => {
    expect(learnerMemory({ text: "Kelas 12" }, memoryId("new"), 42)).toEqual({
      author: "learner",
      confirmedAt: 42,
      createdAt: 42,
      id: memoryId("new"),
      inUse: true,
      sources: 0,
      text: "Kelas 12",
    });
  });

  it("puts a new memory first", () => {
    const list = addMemory(listOf([stored("a")]), stored("b"));

    expect(ids(list.memories)).toEqual([memoryId("b"), memoryId("a")]);
  });

  it("rewrites a memory as the learner's, confirms it now and moves it first", () => {
    const list = listOf([
      stored("a"),
      stored("b", { validUntil: 9000 }),
      stored("c"),
    ]);
    const edited = editMemory(
      list,
      { id: memoryId("b"), text: "New words" },
      77
    );

    expect(ids(edited.memories)).toEqual([
      memoryId("b"),
      memoryId("a"),
      memoryId("c"),
    ]);
    expect(edited.memories[0]).toEqual({
      ...stored("b", { validUntil: 9000 }),
      author: "learner",
      confirmedAt: 77,
      text: "New words",
    });
  });

  it("leaves the list as it is when the memory to rewrite is not in it", () => {
    const list = listOf([stored("a")]);

    expect(editMemory(list, { id: memoryId("gone"), text: "Words" }, 77)).toBe(
      list
    );
  });

  it("takes one memory out, or all of them, and keeps the pause", () => {
    const list = listOf([stored("a"), stored("b")], true);

    expect(ids(removeMemory(list, memoryId("a")).memories)).toEqual([
      memoryId("b"),
    ]);
    expect(clearMemories(list)).toEqual({ memories: [], paused: true });
  });

  it("sets whether memory is paused and keeps the memories", () => {
    const list = listOf([stored("a")]);

    expect(pauseMemories(list, true)).toEqual({
      memories: list.memories,
      paused: true,
    });
    expect(pauseMemories(listOf([], true), false).paused).toBe(false);
  });

  describe("previewText", () => {
    it("reads formatted text as one line of plain words", () => {
      expect(previewText("Kelas **12** IPA, ikut *SNBT* 2027")).toBe(
        "Kelas 12 IPA, ikut SNBT 2027"
      );
      expect(previewText("- Limit\n- Turunan\n\n1. Integral")).toBe(
        "Limit Turunan Integral"
      );
    });

    it("keeps a star that is part of the words and drops the writer's escapes", () => {
      expect(previewText("2 * 3 = 6")).toBe("2 * 3 = 6");
      expect(previewText("Nilai 9\\.5 dan 2 \\* 3")).toBe(
        "Nilai 9.5 dan 2 * 3"
      );
    });
  });

  describe("canSave", () => {
    it("wants something written", () => {
      expect(canSave("")).toBe(false);
      expect(canSave("   \n ")).toBe(false);
      expect(canSave("Kelas 12")).toBe(true);
    });

    it("wants the words to fit", () => {
      const fits = "a".repeat(MEMORY_TEXT_LIMIT);

      expect(canSave(fits)).toBe(true);
      expect(canSave(`  ${fits}  `)).toBe(true);
      expect(canSave(`${fits}a`)).toBe(false);
    });
  });

  describe("shownMemories", () => {
    const list = listOf([
      stored("a", { text: "Prefers worked **Examples**" }),
      stored("b", { text: "Finds trigonometry hard" }),
      stored("c", { text: "- Exam on Friday" }),
    ]);

    it("shows every memory for an empty or blank search", () => {
      expect(shownMemories(list, "")).toEqual(list.memories);
      expect(shownMemories(list, "   ")).toEqual(list.memories);
    });

    it("finds words without regard to case or formatting", () => {
      expect(ids(shownMemories(list, "worked EXAMPLES"))).toEqual([
        memoryId("a"),
      ]);
      expect(ids(shownMemories(list, " trig "))).toEqual([memoryId("b")]);
    });

    it("shows nothing when no memory matches", () => {
      expect(shownMemories(list, "chemistry")).toEqual([]);
    });
  });
});
