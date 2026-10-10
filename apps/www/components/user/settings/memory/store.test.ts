import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createMemoryStore } from "@/components/user/settings/memory/store";

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));

describe("memory page store", () => {
  it("starts with nothing open and no search", () => {
    const { getState } = createMemoryStore();

    expect(getState()).toMatchObject({
      adding: false,
      draft: null,
      editing: null,
      query: "",
    });
  });

  it("keeps the search words", () => {
    const store = createMemoryStore();

    store.getState().search("trigonometry");

    expect(store.getState().query).toBe("trigonometry");
  });

  describe("editors", () => {
    it("opens the editor of one memory", () => {
      const store = createMemoryStore();

      store.getState().openEdit(memoryId("a"));

      expect(store.getState()).toMatchObject({
        adding: false,
        editing: memoryId("a"),
      });
    });

    it("opens the editor for a new memory", () => {
      const store = createMemoryStore();

      store.getState().openNew();

      expect(store.getState()).toMatchObject({ adding: true, editing: null });
    });

    it("keeps one editor open: a new one closes the other", () => {
      const store = createMemoryStore();

      store.getState().openEdit(memoryId("a"));
      store.getState().openNew();
      expect(store.getState()).toMatchObject({ adding: true, editing: null });

      store.getState().openEdit(memoryId("b"));
      expect(store.getState()).toMatchObject({
        adding: false,
        editing: memoryId("b"),
      });
    });

    it("closes whichever editor is open", () => {
      const store = createMemoryStore();

      store.getState().openEdit(memoryId("a"));
      store.getState().close();
      expect(store.getState()).toMatchObject({ adding: false, editing: null });

      store.getState().openNew();
      store.getState().close();
      expect(store.getState()).toMatchObject({ adding: false, editing: null });
    });
  });

  describe("words of a save that failed", () => {
    const words = { kind: "goal", text: "Pass the exam in May" } as const;

    it("opens the editor of a new memory again with the words", () => {
      const store = createMemoryStore();

      store.getState().reopen(null, words);

      expect(store.getState()).toMatchObject({
        adding: true,
        draft: words,
        editing: null,
      });
    });

    it("opens the editor of one memory again with the words", () => {
      const store = createMemoryStore();

      store.getState().reopen(memoryId("a"), words);

      expect(store.getState()).toMatchObject({
        adding: false,
        draft: words,
        editing: memoryId("a"),
      });
    });

    it("leaves an editor the learner opened since, whichever kind it is", () => {
      const store = createMemoryStore();

      store.getState().openEdit(memoryId("b"));
      store.getState().reopen(null, words);
      expect(store.getState()).toMatchObject({
        adding: false,
        draft: null,
        editing: memoryId("b"),
      });

      store.getState().openNew();
      store.getState().reopen(memoryId("a"), words);
      expect(store.getState()).toMatchObject({
        adding: true,
        draft: null,
        editing: null,
      });
    });

    it("forgets the words when the editor closes or another opens", () => {
      const store = createMemoryStore();

      store.getState().reopen(null, words);
      store.getState().close();
      expect(store.getState().draft).toBeNull();

      store.getState().reopen(null, words);
      store.getState().openEdit(memoryId("a"));
      expect(store.getState().draft).toBeNull();

      store.getState().close();
      store.getState().reopen(memoryId("a"), words);
      store.getState().openNew();
      expect(store.getState().draft).toBeNull();
    });
  });
});
