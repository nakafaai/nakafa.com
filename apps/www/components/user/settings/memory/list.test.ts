import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Schema } from "effect";
import {
  addMemory,
  clearMemories,
  editMemory,
  isPending,
  learnerMemory,
  type Memory,
  type MemoryList,
  pauseMemories,
  pendingId,
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
    kind: "goal",
    sources: 2,
    text: `Text of ${name}`,
    ...change,
  };
}

function listOf(memories: Memory[], paused = false): MemoryList {
  return { memories, paused };
}

const ids = (memories: readonly Memory[]) => Arr.map(memories, ({ id }) => id);

const label = (kind: Memory["kind"]) => `kind ${kind}`;

describe("memory list", () => {
  describe("learnerMemory", () => {
    it("builds a memory the learner wrote, with no source chat", () => {
      expect(
        learnerMemory(
          { kind: "style", text: "Examples first" },
          memoryId("new"),
          5000
        )
      ).toEqual({
        author: "learner",
        confirmedAt: 5000,
        createdAt: 5000,
        id: memoryId("new"),
        inUse: true,
        kind: "style",
        sources: 0,
        text: "Examples first",
      });
    });
  });

  describe("pendingId and isPending", () => {
    it("marks a memory the server has not stored yet", () => {
      const waiting = stored("a", { id: pendingId("3f2b-77c1") });

      expect(waiting.id).toBe("pending-3f2b-77c1");
      expect(isPending(waiting)).toBe(true);
    });

    it("does not mark a stored memory", () => {
      expect(isPending(stored("jd7e9k2m4n5p6q7r8s9t0v1w2x3y4z5a"))).toBe(false);
    });
  });

  describe("addMemory", () => {
    it("puts the new memory first and keeps the rest in order", () => {
      const list = listOf([stored("a"), stored("b")], true);
      const added = addMemory(list, stored("c"));

      expect(ids(added.memories)).toEqual([
        memoryId("c"),
        memoryId("a"),
        memoryId("b"),
      ]);
      expect(added.paused).toBe(true);
      expect(ids(list.memories)).toEqual([memoryId("a"), memoryId("b")]);
    });
  });

  describe("editMemory", () => {
    const situation = stored("b", {
      kind: "situation",
      validUntil: 9000,
    });
    const list = listOf([stored("a"), situation, stored("c")]);

    it("rewrites the memory as the learner's and moves it first", () => {
      const edited = editMemory(
        list,
        { id: memoryId("c"), kind: "level", text: "Grade 12" },
        7000
      );

      expect(ids(edited.memories)).toEqual([
        memoryId("c"),
        memoryId("a"),
        memoryId("b"),
      ]);
      expect(edited.memories[0]).toEqual({
        ...stored("c"),
        author: "learner",
        confirmedAt: 7000,
        kind: "level",
        text: "Grade 12",
      });
    });

    it("keeps the day a situation ends when it stays a situation", () => {
      const edited = editMemory(
        list,
        { id: memoryId("b"), kind: "situation", text: "Exam on Friday" },
        7000
      );

      expect(edited.memories[0]).toMatchObject({
        kind: "situation",
        text: "Exam on Friday",
        validUntil: 9000,
      });
    });

    it("drops the day when the memory stops being a situation", () => {
      const edited = editMemory(
        list,
        { id: memoryId("b"), kind: "goal", text: "Exam on Friday" },
        7000
      );

      expect(edited.memories[0]).not.toHaveProperty("validUntil");
    });

    it("leaves the list unchanged for a memory it does not hold", () => {
      expect(
        editMemory(
          list,
          { id: memoryId("gone"), kind: "goal", text: "Anything" },
          7000
        )
      ).toBe(list);
    });
  });

  describe("removeMemory, clearMemories and pauseMemories", () => {
    const list = listOf([stored("a"), stored("b")], true);

    it("removes only the named memory", () => {
      expect(ids(removeMemory(list, memoryId("a")).memories)).toEqual([
        memoryId("b"),
      ]);
    });

    it("clears every memory and keeps the pause", () => {
      expect(clearMemories(list)).toEqual({ memories: [], paused: true });
    });

    it("sets the pause and keeps the memories", () => {
      const resumed = pauseMemories(list, false);

      expect(resumed.paused).toBe(false);
      expect(resumed.memories).toBe(list.memories);
    });
  });

  describe("shownMemories", () => {
    const list = listOf([
      stored("a", { text: "Prefers worked Examples", kind: "style" }),
      stored("b", { text: "Finds trigonometry hard", kind: "struggle" }),
      stored("c", { text: "Exam on Friday", kind: "situation" }),
    ]);
    const view = { label, query: "", removed: [] };

    it("shows every memory for an empty or blank search", () => {
      expect(shownMemories(list, view)).toEqual(list.memories);
      expect(shownMemories(list, { ...view, query: "   " })).toEqual(
        list.memories
      );
    });

    it("finds words in the text without regard to case", () => {
      expect(ids(shownMemories(list, { ...view, query: "EXAMPLES" }))).toEqual([
        memoryId("a"),
      ]);
      expect(ids(shownMemories(list, { ...view, query: " trig " }))).toEqual([
        memoryId("b"),
      ]);
    });

    it("finds the name of the kind", () => {
      expect(
        ids(shownMemories(list, { ...view, query: "Kind Situation" }))
      ).toEqual([memoryId("c")]);
    });

    it("shows nothing when no memory matches", () => {
      expect(shownMemories(list, { ...view, query: "chemistry" })).toEqual([]);
    });

    it("hides the memories that wait for an Undo", () => {
      expect(
        ids(
          shownMemories(list, {
            ...view,
            removed: [memoryId("a"), memoryId("c")],
          })
        )
      ).toEqual([memoryId("b")]);
    });
  });
});
