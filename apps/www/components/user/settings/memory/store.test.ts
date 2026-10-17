import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import type { Memory } from "@/components/user/settings/memory/list";
import { createMemoryStore } from "@/components/user/settings/memory/store";

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));
const grade = { text: "Kelas 12", title: "Sekolah" };
const plan = { text: "A new memory", title: "" };

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

const first = stored("a");
const second = stored("b");

describe("memory page store", () => {
  it("starts with the editor closed, no search and no memory deleted", () => {
    const { getState } = createMemoryStore();

    expect(getState()).toMatchObject({
      cleared: 0,
      deleted: null,
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

  it("opens the editor with the memory itself, then with another", () => {
    const store = createMemoryStore();

    store.getState().openEdit(first);
    expect(store.getState()).toMatchObject({
      open: true,
      session: 1,
      target: first,
    });

    store.getState().openEdit(second);
    expect(store.getState()).toMatchObject({
      open: true,
      session: 2,
      target: second,
    });
  });

  it("opens the editor for a new memory and starts each opening fresh", () => {
    const store = createMemoryStore();

    store.getState().openEdit(first);
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

    store.getState().openEdit(first);
    store.getState().close();

    expect(store.getState()).toMatchObject({ open: false, target: first });
  });

  it("opens again with the words of a save that failed, on its memory or on a new one, and forgets them on close", () => {
    const store = createMemoryStore();

    store.getState().reopen(0, grade, first);
    expect(store.getState()).toMatchObject({
      draft: grade,
      open: true,
      session: 1,
      target: first,
    });

    store.getState().close();
    expect(store.getState().draft).toBeNull();

    store.getState().reopen(1, plan, null);
    expect(store.getState()).toMatchObject({
      draft: plan,
      open: true,
      target: null,
    });
  });

  it("leaves an editor the learner opened since the failed save", () => {
    const store = createMemoryStore();

    store.getState().openEdit(second);
    store.getState().reopen(0, grade, first);

    expect(store.getState()).toMatchObject({
      draft: null,
      open: true,
      session: 1,
      target: second,
    });
  });

  it("gives nothing back when the learner opened and closed another editor since the failed save", () => {
    const store = createMemoryStore();

    store.getState().openEdit(second);
    store.getState().close();
    store.getState().reopen(0, grade, first);

    expect(store.getState()).toMatchObject({
      draft: null,
      open: false,
      session: 1,
      target: second,
    });
  });

  it("drops given-back words when the learner opens another editor", () => {
    const store = createMemoryStore();

    store.getState().reopen(0, grade, first);
    store.getState().close();
    store.getState().reopen(1, plan, null);
    store.getState().close();
    store.getState().openNew();

    expect(store.getState().draft).toBeNull();
  });

  it("points a new memory's editor at the memory the server stored for it, also after the editor closed", () => {
    const store = createMemoryStore();

    store.getState().openNew();
    store.getState().adopt(1, first);
    expect(store.getState()).toMatchObject({
      open: true,
      session: 1,
      target: first,
    });

    const closed = createMemoryStore();
    closed.getState().openNew();
    closed.getState().close();
    closed.getState().adopt(1, first);
    expect(closed.getState().target).toBe(first);
  });

  it("leaves an editor the learner opened since, or one that is already on a memory", () => {
    const newer = createMemoryStore();
    newer.getState().openNew();
    newer.getState().openNew();
    newer.getState().adopt(1, first);
    expect(newer.getState().target).toBeNull();

    const taken = createMemoryStore();
    taken.getState().openEdit(second);
    taken.getState().adopt(1, first);
    expect(taken.getState().target).toBe(second);
  });

  it("shows the memory the editor holds as the learner rewrote it, and leaves any other", () => {
    const store = createMemoryStore();

    store.getState().openEdit(first);
    store.getState().rewrite(second.id, plan, 2000);
    expect(store.getState().target).toBe(first);

    store.getState().rewrite(first.id, grade, 2000);
    expect(store.getState().target).toEqual({
      ...first,
      author: "learner",
      confirmedAt: 2000,
      text: "Kelas 12",
      title: "Sekolah",
    });

    const fresh = createMemoryStore();
    fresh.getState().openNew();
    fresh.getState().rewrite(first.id, grade, 2000);
    expect(fresh.getState().target).toBeNull();
  });

  it("closes the editor on a memory the learner deleted and notes the memory, and only notes any other", () => {
    const store = createMemoryStore();

    store.getState().reopen(0, grade, first);
    store.getState().forget(first.id);
    expect(store.getState()).toMatchObject({
      deleted: first.id,
      draft: null,
      open: false,
      target: first,
    });

    const other = createMemoryStore();
    other.getState().openEdit(first);
    other.getState().forget(second.id);
    expect(other.getState()).toMatchObject({
      deleted: second.id,
      open: true,
      target: first,
    });

    const fresh = createMemoryStore();
    fresh.getState().openNew();
    fresh.getState().forget(first.id);
    expect(fresh.getState()).toMatchObject({ deleted: first.id, open: true });
  });

  it("keeps the words an editor held for each deleted memory, so deleting another memory takes nothing from a delete the server may refuse", () => {
    const store = createMemoryStore();

    store.getState().openEdit(first);
    store.getState().forget(first.id);
    store.getState().withhold(first.id, grade);
    store.getState().forget(second.id);
    expect(store.getState().withheld).toEqual({ [first.id]: grade });
  });

  it("lets go of the words kept for one memory when the server deleted it, and keeps the others", () => {
    const store = createMemoryStore();

    store.getState().withhold(first.id, grade);
    store.getState().withhold(second.id, plan);
    store.getState().release(first.id);
    expect(store.getState().withheld).toEqual({ [second.id]: plan });
  });

  it("drops the words kept for a memory when an editor opens on it again, by the learner or after a refused deletion", () => {
    const opened = createMemoryStore();
    opened.getState().withhold(first.id, grade);
    opened.getState().withhold(second.id, plan);
    opened.getState().openEdit(first);
    expect(opened.getState().withheld).toEqual({ [second.id]: plan });

    const given = createMemoryStore();
    given.getState().withhold(first.id, grade);
    given.getState().reopen(0, grade, first);
    expect(given.getState().withheld).toEqual({});

    // A new memory's editor has no memory to drop words for.
    const fresh = createMemoryStore();
    fresh.getState().withhold(first.id, grade);
    fresh.getState().reopen(0, plan, null);
    expect(fresh.getState().withheld).toEqual({ [first.id]: grade });
  });

  it("takes back the note of a memory the server did not delete, and keeps the note of any other", () => {
    const store = createMemoryStore();

    store.getState().forget(first.id);
    store.getState().recall(second.id);
    expect(store.getState().deleted).toBe(first.id);
    store.getState().recall(first.id);
    expect(store.getState().deleted).toBeNull();
  });

  it("leaves the first saves the learner deleted out of the hidden list, and lets each go once its answer came", () => {
    const store = createMemoryStore();
    const typed = memoryId("pending-typed");

    expect(store.getState().hidden).toEqual([]);
    store.getState().hide(typed);
    store.getState().hide(second.id);
    expect(store.getState().hidden).toEqual([typed, second.id]);

    store.getState().unhide(typed);
    expect(store.getState().hidden).toEqual([second.id]);
  });

  it("takes back the count of a Delete all the server refused, so a first save on its way finds the count it started with", () => {
    const store = createMemoryStore();
    const before = store.getState().cleared;

    store.getState().forgetAll();
    expect(store.getState().cleared).toBe(before + 1);
    store.getState().recallAll();
    expect(store.getState().cleared).toBe(before);
  });

  it("counts each time the learner deletes every memory, and closes the editor on the memory it holds", () => {
    const store = createMemoryStore();

    store.getState().openEdit(first);
    store.getState().forgetAll();
    expect(store.getState()).toMatchObject({
      cleared: 1,
      deleted: first.id,
      draft: null,
      open: false,
      target: first,
    });

    // A new memory has nothing to close yet: its first save learns of the
    // deletion from the count.
    store.getState().openNew();
    store.getState().forgetAll();
    expect(store.getState()).toMatchObject({
      cleared: 2,
      deleted: first.id,
      open: true,
      target: null,
    });
  });

  it("gives nothing back on a memory deleted before another deletion replaced its note", () => {
    const store = createMemoryStore();

    store.getState().openEdit(first);
    store.getState().close();
    store.getState().forget(first.id);
    store.getState().forget(second.id);
    store.getState().reopen(1, grade, first);
    expect(store.getState()).toMatchObject({
      deleted: second.id,
      draft: null,
      open: false,
    });
  });

  it("gives nothing back on a memory the learner deleted since the failed save, and still gives back a new memory written after the deletion", () => {
    const store = createMemoryStore();

    store.getState().openEdit(first);
    store.getState().close();
    store.getState().forget(first.id);
    store.getState().reopen(1, grade, first);
    expect(store.getState()).toMatchObject({
      draft: null,
      open: false,
      session: 2,
    });

    // A failed save given back after the deletion opens a new memory in the
    // opening that the deletion left.
    store.getState().reopen(2, plan, null);
    expect(store.getState()).toMatchObject({
      draft: plan,
      open: true,
      target: null,
    });

    const other = createMemoryStore();
    other.getState().openEdit(first);
    other.getState().close();
    other.getState().forget(second.id);
    other.getState().reopen(1, grade, first);
    expect(other.getState()).toMatchObject({ draft: grade, open: true });
  });

  it("closes the editor of a memory the server no longer has, and leaves an editor opened since", () => {
    const store = createMemoryStore();

    store.getState().reopen(0, grade, first);
    store.getState().leave(1);
    expect(store.getState()).toMatchObject({ draft: null, open: false });

    const newer = createMemoryStore();
    newer.getState().openEdit(first);
    newer.getState().openEdit(second);
    newer.getState().leave(1);
    expect(newer.getState()).toMatchObject({ open: true, target: second });
  });

  it("names the memory an opening began with, and none for a new memory", () => {
    const store = createMemoryStore();

    store.getState().openEdit(first);
    expect(store.getState().opener).toBe(first.id);

    store.getState().openNew();
    expect(store.getState().opener).toBeNull();
  });

  it("keeps no memory as the opener of a new memory, though its first save stores one", () => {
    const store = createMemoryStore();

    store.getState().openNew();
    store.getState().adopt(store.getState().session, first);

    expect(store.getState()).toMatchObject({ opener: null, target: first });
  });

  it("names the memory of a draft that opens again, not the memory the editor held before", () => {
    const store = createMemoryStore();

    store.getState().openEdit(second);
    store.getState().close();
    store.getState().reopen(store.getState().session, grade, first);

    expect(store.getState()).toMatchObject({
      opener: first.id,
      open: true,
      target: first,
    });
  });
});
