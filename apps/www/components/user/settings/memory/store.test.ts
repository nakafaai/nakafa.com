import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createMemoryStore } from "@/components/user/settings/memory/store";

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));

describe("memory page store", () => {
  it("starts with nothing open, no search and nothing hidden", () => {
    const { getState } = createMemoryStore();

    expect(getState()).toMatchObject({
      adding: false,
      editing: null,
      query: "",
      removed: [],
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

  describe("removals that wait for an Undo", () => {
    it("hides a memory once, however often it is hidden", () => {
      const store = createMemoryStore();

      store.getState().hide(memoryId("a"));
      store.getState().hide(memoryId("a"));
      store.getState().hide(memoryId("b"));

      expect(store.getState().removed).toEqual([memoryId("a"), memoryId("b")]);
    });

    it("brings a hidden memory back and says it was hidden", () => {
      const store = createMemoryStore();

      store.getState().hide(memoryId("a"));
      store.getState().hide(memoryId("b"));

      expect(store.getState().restore(memoryId("a"))).toBe(true);
      expect(store.getState().removed).toEqual([memoryId("b")]);
    });

    it("lets only the first of two claims act on a memory", () => {
      const store = createMemoryStore();

      store.getState().hide(memoryId("a"));

      expect(store.getState().restore(memoryId("a"))).toBe(true);
      expect(store.getState().restore(memoryId("a"))).toBe(false);
    });

    it("says a memory that was never hidden was not hidden", () => {
      const store = createMemoryStore();

      expect(store.getState().restore(memoryId("a"))).toBe(false);
      expect(store.getState().removed).toEqual([]);
    });
  });
});
