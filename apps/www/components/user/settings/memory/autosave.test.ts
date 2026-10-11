import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, MutableList } from "effect";
import { createAutosave } from "@/components/user/settings/memory/autosave";
import {
  learnerMemory,
  type Memory,
  type MemoryDraft,
  pendingId,
} from "@/components/user/settings/memory/list";

const blank = { text: "", title: "" };
const first = { text: "Grade 12", title: "" };
const second = { text: "Grade 12, science track", title: "School" };
const stored = learnerMemory(first, pendingId("stored"), 1);
const NEW_ID = pendingId("new");

/**
 * The Memory page as the saving sees it. Every change it sends is recorded,
 * and a write stays on its way until the test answers it.
 */
function page() {
  const sent = MutableList.make<string>();
  const answers = MutableList.make<{ done: () => void; failed: () => void }>();
  const note = (line: string) => {
    MutableList.append(sent, line);
  };
  const words = (draft: MemoryDraft) => `${draft.title}|${draft.text}`;

  return {
    /** Answers the oldest write that is still on its way. */
    answer(how: "done" | "failed") {
      const write = MutableList.take(answers);

      if (write !== MutableList.Empty) {
        write[how]();
      }
    },
    send: {
      add(
        draft: MemoryDraft,
        after: { done?: (id: Memory["id"]) => void; failed?: () => void } = {}
      ) {
        note(`add ${words(draft)}`);
        MutableList.append(answers, {
          done: () => after.done?.(NEW_ID),
          failed: () => after.failed?.(),
        });
      },
      adopt(id: Memory["id"]) {
        note(`adopt ${id}`);
      },
      drop(id: Memory["id"]) {
        note(`drop ${id}`);
      },
      edit(
        id: Memory["id"],
        draft: MemoryDraft,
        after: { done?: () => void; failed?: () => void } = {}
      ) {
        note(`edit ${id} ${words(draft)}`);
        MutableList.append(answers, {
          done: () => after.done?.(),
          failed: () => after.failed?.(),
        });
      },
      remove(memory: Memory) {
        note(`remove ${memory.id}`);
      },
    },
    /** Every change sent so far, oldest first. */
    sent: () => MutableList.toArray(sent),
  };
}

describe("the saving of an open editor", () => {
  it("writes nothing for a new memory that says nothing", () => {
    const { send, sent } = page();
    const saving = createAutosave(undefined, blank);

    saving.write(send);
    saving.change({ text: " ", title: " " });
    saving.write(send);

    expect(sent()).toEqual([]);
  });

  it("stores a new memory once, points the editor at it, and rewrites it from then on", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(undefined, blank);

    saving.change(first);
    saving.write(send);
    // The learner keeps writing while the server stores the memory.
    saving.change(second);
    saving.write(send);
    expect(sent()).toEqual(["add |Grade 12"]);

    answer("done");
    expect(sent()).toEqual([
      "add |Grade 12",
      `adopt ${NEW_ID}`,
      `edit ${NEW_ID} School|Grade 12, science track`,
    ]);

    answer("done");
    saving.write(send);
    expect(Arr.length(sent())).toBe(3);
  });

  it("rewrites a stored memory only when its draft changed", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(stored, first);

    saving.write(send);
    saving.change({ text: " Grade 12 ", title: " " });
    saving.write(send);
    expect(sent()).toEqual([]);

    saving.change(second);
    saving.write(send);
    answer("done");
    expect(sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
    ]);
  });

  it("opens with words the server never took and writes them", () => {
    const { send, sent } = page();
    const saving = createAutosave(stored, second);

    saving.write(send);

    expect(sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
    ]);
  });

  it("tries a failed write again with the next one", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(undefined, first);

    saving.write(send);
    answer("failed");
    saving.write(send);
    answer("done");
    saving.change(second);
    saving.write(send);
    answer("failed");
    saving.write(send);

    expect(sent()).toEqual([
      "add |Grade 12",
      "add |Grade 12",
      `adopt ${NEW_ID}`,
      `edit ${NEW_ID} School|Grade 12, science track`,
      `edit ${NEW_ID} School|Grade 12, science track`,
    ]);
  });

  it("deletes the memory the editor shows, with its Undo, and writes nothing after", () => {
    const { send, sent } = page();
    const saving = createAutosave(stored, first);

    saving.change(second);
    saving.discard(send, stored);
    saving.write(send);

    expect(sent()).toEqual([`remove ${stored.id}`]);
  });

  it("deletes a memory stored a moment ago without a word", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(undefined, first);

    saving.write(send);
    answer("done");
    saving.discard(send, undefined);

    expect(sent()).toEqual([
      "add |Grade 12",
      `adopt ${NEW_ID}`,
      `drop ${NEW_ID}`,
    ]);
  });

  it("drops a memory the server stored after the learner deleted it", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(undefined, first);

    saving.write(send);
    saving.discard(send, undefined);
    expect(sent()).toEqual(["add |Grade 12"]);

    answer("done");
    expect(sent()).toEqual(["add |Grade 12", `drop ${NEW_ID}`]);
  });

  it("deletes nothing for a new memory that was never stored", () => {
    const { send, sent } = page();
    const saving = createAutosave(undefined, blank);

    saving.discard(send, undefined);

    expect(sent()).toEqual([]);
  });
});
