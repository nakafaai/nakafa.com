import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Option, Schema } from "effect";
import {
  draftArgs,
  draftOf,
  editedMemory,
  findMemory,
  isBlank,
  isPending,
  isSearching,
  learnerMemory,
  type Memory,
  type MemoryPage,
  memoryName,
  pageCleared,
  pageWith,
  pageWithout,
  pendingId,
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
    text: `Text of ${name}`,
    ...change,
  };
}

/** One page of the list that has more after it. */
function pageOf(memories: Memory[]): MemoryPage {
  return { continueCursor: "next", isDone: false, page: memories };
}

const ids = (memories: readonly Memory[]) => Arr.map(memories, ({ id }) => id);

describe("memory list", () => {
  it("tells a memory the server has not stored yet from a stored one", () => {
    expect(isPending(stored("a", { id: pendingId("token") }))).toBe(true);
    expect(isPending(stored("a"))).toBe(false);
  });

  it("reads the title and the words of a memory, or none for a new one", () => {
    expect(draftOf(null)).toEqual({ text: "", title: "" });
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
      text: "Kelas 12",
    });
    expect(
      learnerMemory({ text: "", title: "School" }, memoryId("new"), 42)
    ).toMatchObject({ text: "", title: "School" });
  });

  describe("rewriting a memory", () => {
    it("makes it the learner's, confirms it now, and keeps what the draft does not say", () => {
      const original = stored("b", { title: "Old", validUntil: 9000 });

      expect(
        editedMemory(original, { text: "New words", title: "Plan" }, 77)
      ).toEqual({
        ...original,
        author: "learner",
        confirmedAt: 77,
        text: "New words",
        title: "Plan",
      });
    });

    it("takes the title off a memory whose draft has none", () => {
      const edited = editedMemory(
        stored("a", { title: "School" }),
        { text: "Kelas 12", title: "" },
        77
      );

      expect(edited).not.toHaveProperty("title");
      expect(edited.text).toBe("Kelas 12");
    });

    it("finds and removes a memory by its id", () => {
      const memories = [stored("a"), stored("b"), stored("c")];

      expect(findMemory(memories, memoryId("c"))).toEqual(
        Option.some(memories[2])
      );
      expect(findMemory(memories, memoryId("gone"))).toEqual(Option.none());
      expect(ids(removeMemory(memories, memoryId("b")))).toEqual([
        memoryId("a"),
        memoryId("c"),
      ]);
    });
  });

  describe("a loaded page after a change", () => {
    it("holds a memory first on the page that starts the list and drops its older copy", () => {
      const edited = stored("b", { text: "Rewritten" });
      const page = pageWith(
        pageOf([stored("a"), stored("b"), stored("c")]),
        true,
        edited
      );

      expect(page.page).toEqual([edited, stored("a"), stored("c")]);
      expect(page).toMatchObject({ continueCursor: "next", isDone: false });
    });

    it("puts a new memory first on the page that starts the list", () => {
      const page = pageWith(pageOf([stored("a")]), true, stored("new"));

      expect(ids(page.page)).toEqual([memoryId("new"), memoryId("a")]);
    });

    it("takes the memory off any other page that held it and leaves the other pages as they are", () => {
      const holding = pageOf([stored("a"), stored("b")]);
      const other = pageOf([stored("c")]);

      expect(ids(pageWith(holding, false, stored("b")).page)).toEqual([
        memoryId("a"),
      ]);
      expect(pageWith(other, false, stored("b"))).toBe(other);
    });

    it("takes a deleted memory off the page that held it and leaves the other pages as they are", () => {
      const holding = pageOf([stored("a"), stored("b")]);
      const other = pageOf([stored("c")]);

      expect(ids(pageWithout(holding, memoryId("a")).page)).toEqual([
        memoryId("b"),
      ]);
      expect(pageWithout(other, memoryId("a"))).toBe(other);
    });

    it("empties a page and ends the list there when every memory is deleted, and leaves a page that is already empty", () => {
      expect(pageCleared(pageOf([stored("a"), stored("b")]))).toEqual({
        continueCursor: "next",
        isDone: true,
        page: [],
      });

      const empty = { continueCursor: "", isDone: true, page: [] };

      expect(pageCleared(empty)).toBe(empty);
      // An empty page that is not the end of the list still ends it.
      expect(pageCleared(pageOf([]))).toMatchObject({ isDone: true, page: [] });
    });
  });

  describe("what the list calls a memory", () => {
    it("calls a memory by its title, or by its words as the editor shows them when it has none", () => {
      expect(memoryName(stored("a", { title: "School" }))).toBe("School");
      expect(memoryName(stored("a", { text: "Kelas **12** IPA" }))).toBe(
        "Kelas 12 IPA"
      );
      expect(
        memoryName(stored("a", { text: "- Limit\n- Turunan\n\n1. Integral" }))
      ).toBe("Limit Turunan Integral");
    });

    it("says the words a learner wrote, not the Markdown that stores them", () => {
      const nameOf = (text: string) => memoryName(stored("a", { text }));

      expect(nameOf("I study C++ at university")).toBe(
        "I study C++ at university"
      );
      expect(nameOf("a == b")).toBe("a == b");
      expect(nameOf("Q&amp;A")).toBe("Q&A");
      expect(nameOf("a &lt; b &gt; c")).toBe("a < b > c");
      expect(nameOf("==")).toBe("==");
      expect(nameOf("\\*\\*bold\\*\\* typed as text")).toBe(
        "**bold** typed as text"
      );
      expect(
        nameOf(
          "[https://example.com/a?x=1&amp;y=2](https://example.com/a?x=1&y=2)"
        )
      ).toBe("https://example.com/a?x=1&y=2");
    });

    it("gives no name to words that show nothing, such as a divider alone", () => {
      expect(memoryName(stored("a", { text: "---" }))).toBe("");
    });

    it("reads the words of one memory object once", () => {
      const memory = stored("a", { text: "Kelas **12**" });

      expect(memoryName(memory)).toBe("Kelas 12");
      expect(memoryName(memory)).toBe("Kelas 12");
    });
  });

  describe("the search", () => {
    const memories = [
      stored("a", { text: "Prefers worked **Examples**" }),
      stored("b", { text: "Finds trigonometry hard" }),
      stored("c", { text: "- Exam on Friday", title: "Chemistry week" }),
    ];

    it("shows every memory for an empty or blank search", () => {
      expect(shownMemories(memories, "")).toEqual(memories);
      expect(shownMemories(memories, "   ")).toEqual(memories);
    });

    it("finds words without regard to case or formatting", () => {
      expect(ids(shownMemories(memories, "worked EXAMPLES"))).toEqual([
        memoryId("a"),
      ]);
      expect(ids(shownMemories(memories, " trig "))).toEqual([memoryId("b")]);
    });

    it("finds a memory by its title", () => {
      expect(ids(shownMemories(memories, "chemistry"))).toEqual([
        memoryId("c"),
      ]);
      expect(ids(shownMemories(memories, "friday"))).toEqual([memoryId("c")]);
    });

    it("shows nothing when no memory matches", () => {
      expect(shownMemories(memories, "biology")).toEqual([]);
    });

    it("finds the words a learner wrote, as the editor shows them", () => {
      const written = [
        stored("a", { text: "I study C++ at university" }),
        stored("b", { text: "Q&amp;A on Friday" }),
        stored("c", { text: "a &lt; b" }),
        stored("d", { text: "==" }),
        stored("e", { text: "a == b" }),
      ];
      const found = (query: string) => ids(shownMemories(written, query));

      expect(found("C++")).toEqual([memoryId("a")]);
      expect(found("q&a")).toEqual([memoryId("b")]);
      expect(found("a < b")).toEqual([memoryId("c")]);
      expect(found("==")).toEqual([memoryId("d"), memoryId("e")]);
      // The Markdown that stores a character is not a word of the memory.
      expect(found("&amp;")).toEqual([]);
      expect(found("&lt;")).toEqual([]);
    });

    it("finds any part of a word, which a search of whole words cannot", () => {
      // "trigonometri" is a part of the word "trigonometry" in the other
      // language, and "ometr" is a part from the middle of a word.
      expect(ids(shownMemories(memories, "ometr"))).toEqual([memoryId("b")]);
      expect(ids(shownMemories(memories, "exam"))).toEqual([
        memoryId("a"),
        memoryId("c"),
      ]);
    });

    it("keeps the order of the list and returns the very list it was given for a blank search", () => {
      expect(shownMemories(memories, "")).toBe(memories);
      expect(ids(shownMemories(memories, "e"))).toEqual(ids(memories));
    });

    it("tells a blank text from a search", () => {
      expect(isSearching("")).toBe(false);
      expect(isSearching("  \n ")).toBe(false);
      expect(isSearching(" kuiper ")).toBe(true);
    });
  });
});
