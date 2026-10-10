import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createMemoryStore } from "@/components/user/settings/memory/store";

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));
const grade = { text: "Kelas 12", title: "Sekolah" };
const plan = { text: "A new memory", title: "" };

describe("memory page store", () => {
  it("starts with the editor closed and no search", () => {
    const { getState } = createMemoryStore();

    expect(getState()).toMatchObject({
      draft: null,
      open: false,
      query: "",
      session: 0,
      target: null,
    });
  });

  it("keeps the search words", () => {
    const store = createMemoryStore();

    store.getState().search("trigonometry");

    expect(store.getState().query).toBe("trigonometry");
  });

  it("opens the editor with one memory, then with another", () => {
    const store = createMemoryStore();

    store.getState().openEdit(memoryId("a"));
    expect(store.getState()).toMatchObject({
      open: true,
      session: 1,
      target: memoryId("a"),
    });

    store.getState().openEdit(memoryId("b"));
    expect(store.getState()).toMatchObject({
      open: true,
      session: 2,
      target: memoryId("b"),
    });
  });

  it("opens the editor for a new memory and starts each opening fresh", () => {
    const store = createMemoryStore();

    store.getState().openEdit(memoryId("a"));
    store.getState().openNew();
    expect(store.getState()).toMatchObject({
      open: true,
      session: 2,
      target: null,
    });

    store.getState().openNew();
    expect(store.getState().session).toBe(3);
  });

  it("keeps the memory in the editor while the panel closes", () => {
    const store = createMemoryStore();

    store.getState().openEdit(memoryId("a"));
    store.getState().close();

    expect(store.getState()).toMatchObject({
      open: false,
      target: memoryId("a"),
    });
  });

  it("opens again with the words of a save that failed, and forgets them on close", () => {
    const store = createMemoryStore();

    store.getState().reopen(memoryId("a"), grade);
    expect(store.getState()).toMatchObject({
      draft: grade,
      open: true,
      session: 1,
      target: memoryId("a"),
    });

    store.getState().close();
    expect(store.getState().draft).toBeNull();

    store.getState().reopen(null, plan);
    expect(store.getState()).toMatchObject({
      draft: plan,
      open: true,
      target: null,
    });
  });

  it("leaves an editor the learner opened since the failed save", () => {
    const store = createMemoryStore();

    store.getState().openEdit(memoryId("b"));
    store.getState().reopen(memoryId("a"), grade);

    expect(store.getState()).toMatchObject({
      draft: null,
      open: true,
      session: 1,
      target: memoryId("b"),
    });
  });

  it("drops given-back words when the learner opens another editor", () => {
    const store = createMemoryStore();

    store.getState().reopen(memoryId("a"), grade);
    store.getState().close();
    store.getState().reopen(null, plan);
    store.getState().close();
    store.getState().openNew();

    expect(store.getState().draft).toBeNull();
  });

  it("points a new memory's editor at the memory the server stored for it", () => {
    const store = createMemoryStore();

    store.getState().openNew();
    store.getState().adopt(1, memoryId("a"));

    expect(store.getState()).toMatchObject({
      open: true,
      session: 1,
      target: memoryId("a"),
    });
  });

  it("leaves an editor that is closed, newer, or already on a memory", () => {
    const closed = createMemoryStore();
    closed.getState().openNew();
    closed.getState().close();
    closed.getState().adopt(1, memoryId("a"));
    expect(closed.getState().target).toBeNull();

    const newer = createMemoryStore();
    newer.getState().openNew();
    newer.getState().openNew();
    newer.getState().adopt(1, memoryId("a"));
    expect(newer.getState().target).toBeNull();

    const taken = createMemoryStore();
    taken.getState().openEdit(memoryId("b"));
    taken.getState().adopt(1, memoryId("a"));
    expect(taken.getState().target).toBe(memoryId("b"));
  });
});
