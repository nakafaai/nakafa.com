import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Schema } from "effect";
import {
  addMemory,
  clearMemories,
  draftArgs,
  draftOf,
  editMemory,
  isBlank,
  isPending,
  learnerMemory,
  type Memory,
  type MemoryList,
  memoryName,
  pauseMemories,
  pendingId,
  previewText,
  removeMemory,
  sameDraft,
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

  it("reads the title and the words of a memory, or none for a new one", () => {
    expect(draftOf(undefined)).toEqual({ text: "", title: "" });
    expect(draftOf(stored("a"))).toEqual({ text: "Text of a", title: "" });
    expect(draftOf(stored("a", { title: "School" }))).toEqual({
      text: "Text of a",
      title: "School",
    });
  });

  it("calls a draft blank until it holds a title or words", () => {
    expect(isBlank({ text: "", title: "" })).toBe(true);
    expect(isBlank({ text: " \n ", title: "  " })).toBe(true);
    expect(isBlank({ text: "", title: "School" })).toBe(false);
    expect(isBlank({ text: "Kelas 12", title: "" })).toBe(false);
  });

  it("compares two drafts without the space around them", () => {
    const draft = { text: "Kelas 12", title: "School" };

    expect(sameDraft(draft, { text: " Kelas 12\n", title: "School " })).toBe(
      true
    );
    expect(sameDraft(draft, { text: "Kelas 12", title: "Sekolah" })).toBe(
      false
    );
    expect(sameDraft(draft, { text: "Kelas 11", title: "School" })).toBe(false);
  });

  it("sends trimmed words, and a title only when one is written", () => {
    expect(draftArgs({ text: " Kelas 12 ", title: " School " })).toEqual({
      text: "Kelas 12",
      title: "School",
    });
    expect(draftArgs({ text: "Kelas 12", title: "  " })).toEqual({
      text: "Kelas 12",
    });
  });

  it("builds the learner's own memory for what was just written", () => {
    expect(
      learnerMemory({ text: "Kelas 12", title: "" }, memoryId("new"), 42)
    ).toEqual({
      author: "learner",
      confirmedAt: 42,
      createdAt: 42,
      id: memoryId("new"),
      inUse: true,
      text: "Kelas 12",
    });
    expect(
      learnerMemory({ text: "", title: "School" }, memoryId("new"), 42)
    ).toMatchObject({ text: "", title: "School" });
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
      memoryId("b"),
      { text: "New words", title: "Plan" },
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
      title: "Plan",
    });
  });

  it("takes the title off a memory whose draft has none", () => {
    const list = listOf([stored("a", { title: "School" })]);
    const edited = editMemory(
      list,
      memoryId("a"),
      { text: "Kelas 12", title: "" },
      77
    );

    expect(edited.memories[0]).toEqual({
      ...stored("a"),
      author: "learner",
      confirmedAt: 77,
      text: "Kelas 12",
    });
  });

  it("leaves the list as it is when the memory to rewrite is not in it", () => {
    const list = listOf([stored("a")]);

    expect(
      editMemory(list, memoryId("gone"), { text: "Words", title: "" }, 77)
    ).toBe(list);
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

    it("drops headings, tasks, quotes, links, code fences and dividers and keeps their words", () => {
      expect(
        previewText(
          "# Plan\n\n- [ ] Read ++chapter 3++\n- [x] ==Limits== done\n\n> Ask about [the syllabus](https://example.com/s)\n\n---\n\n```ts\nconst x = 1\n```"
        )
      ).toBe(
        "Plan Read chapter 3 Limits done Ask about the syllabus const x = 1"
      );
    });

    it("keeps a star that is part of the words and drops the writer's escapes", () => {
      expect(previewText("2 * 3 = 6")).toBe("2 * 3 = 6");
      expect(previewText("Nilai 9\\.5 dan 2 \\* 3")).toBe(
        "Nilai 9.5 dan 2 * 3"
      );
    });
  });

  it("calls a memory by its title, or by its words when it has none", () => {
    expect(memoryName(stored("a", { title: "School" }))).toBe("School");
    expect(memoryName(stored("a", { text: "Kelas **12**" }))).toBe("Kelas 12");
  });

  describe("shownMemories", () => {
    const list = listOf([
      stored("a", { text: "Prefers worked **Examples**" }),
      stored("b", { text: "Finds trigonometry hard" }),
      stored("c", { text: "- Exam on Friday", title: "Chemistry week" }),
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

    it("finds a memory by its title", () => {
      expect(ids(shownMemories(list, "chemistry"))).toEqual([memoryId("c")]);
      expect(ids(shownMemories(list, "friday"))).toEqual([memoryId("c")]);
    });

    it("shows nothing when no memory matches", () => {
      expect(shownMemories(list, "biology")).toEqual([]);
    });
  });
});
