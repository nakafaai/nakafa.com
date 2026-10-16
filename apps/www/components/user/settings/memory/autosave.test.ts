import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, MutableList, MutableRef } from "effect";
import { createAutosave } from "@/components/user/settings/memory/autosave";
import {
  draftOf,
  editedMemory,
  learnerMemory,
  type Memory,
  type MemoryDraft,
  pendingId,
} from "@/components/user/settings/memory/list";

const blank = { text: "", title: "" };
const first = { text: "Grade 12", title: "" };
const second = { text: "Grade 12, science track", title: "School" };
const third = { text: "Grade 12, science track, Bandung", title: "School" };
const stored = learnerMemory(first, pendingId("stored"), 1);
const NEW_ID = pendingId("new");

/**
 * The Memory page as the saving sees it. Every change it sends is recorded,
 * and a write stays on its way until the test answers it.
 */
function page() {
  const sent = MutableList.make<string>();
  const cleared = MutableRef.make(0);
  const answers = MutableList.make<{
    done: () => void;
    failed: () => void;
    refused: () => void;
  }>();
  const note = (line: string) => {
    MutableList.append(sent, line);
  };
  const words = (draft: MemoryDraft) => `${draft.title}|${draft.text}`;

  return {
    /** Answers the oldest write that is still on its way. */
    answer(how: "done" | "failed" | "refused") {
      const write = MutableList.take(answers);

      if (write !== MutableList.Empty) {
        write[how]();
      }
    },
    /** The learner deletes every memory. */
    clear() {
      MutableRef.update(cleared, (count) => count + 1);
    },
    send: {
      add(
        draft: MemoryDraft,
        after: {
          done?: (memory: Memory) => void;
          failed?: (again: boolean) => void;
        } = {}
      ) {
        note(`add ${words(draft)}`);
        MutableList.append(answers, {
          done: () => after.done?.(learnerMemory(draft, NEW_ID, 1)),
          failed: () => after.failed?.(true),
          refused: () => after.failed?.(false),
        });
      },
      adopt(memory: Memory) {
        note(`adopt ${memory.id} ${words(draftOf(memory))}`);
      },
      cleared: () => MutableRef.get(cleared),
      edit(
        id: Memory["id"],
        draft: MemoryDraft,
        after: { failed?: (again: boolean) => void } = {}
      ) {
        note(`edit ${id} ${words(draft)}`);
        MutableList.append(answers, {
          done: () => undefined,
          failed: () => after.failed?.(true),
          refused: () => after.failed?.(false),
        });
      },
      leave() {
        note("leave");
      },
      remove(memory: Memory, restore?: MemoryDraft) {
        note(`remove ${memory.id} ${restore ? words(restore) : "-"}`);
      },
      reopen(draft: MemoryDraft) {
        note(`reopen ${words(draft)}`);
      },
    },
    /** Every change sent so far, oldest first. */
    sent: () => MutableList.toArray(sent),
  };
}

describe("the saving of an open editor", () => {
  it("starts with the words of the memory, or with the words of a save that failed", () => {
    expect(createAutosave(null, null).starting).toEqual(blank);
    expect(createAutosave(stored, null).starting).toEqual(first);
    expect(createAutosave(stored, second).starting).toEqual(second);
  });

  it("writes nothing for a new memory that says nothing", () => {
    const { send, sent } = page();
    const saving = createAutosave(null, null);

    saving.write(send);
    saving.change({ text: " ", title: " " });
    saving.write(send);

    expect(sent()).toEqual([]);
  });

  it("stores a new memory once, points the editor at it, and rewrites it from then on", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(null, null);

    saving.change(first);
    saving.write(send);
    // The learner keeps writing while the server stores the memory.
    saving.change(second);
    saving.write(send);
    expect(sent()).toEqual(["add |Grade 12"]);

    answer("done");
    expect(sent()).toEqual([
      "add |Grade 12",
      `adopt ${NEW_ID} |Grade 12`,
      `edit ${NEW_ID} School|Grade 12, science track`,
    ]);

    answer("done");
    saving.write(send);
    expect(Arr.length(sent())).toBe(3);
  });

  it("rewrites a stored memory only when its draft changed", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(stored, null);

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

  it("writes the words of a failed save again though the memory it reopens on already shows them", () => {
    const { send, sent } = page();
    // The page shows a rewritten memory before the server answers, so a save
    // that failed leaves the memory with the words the server never took.
    const rewritten = editedMemory(stored, second, 2);
    const saving = createAutosave(rewritten, second);

    saving.write(send);

    expect(sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
    ]);
  });

  it("gives the words of a failed write back, and sends them again with the next write", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(null, first);

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
      "reopen |Grade 12",
      "add |Grade 12",
      `adopt ${NEW_ID} |Grade 12`,
      `edit ${NEW_ID} School|Grade 12, science track`,
      "reopen School|Grade 12, science track",
      `edit ${NEW_ID} School|Grade 12, science track`,
    ]);
  });

  it("gives back the latest words, not the words of the write that failed, when the learner wrote on and closed the editor while the first save was on its way", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(null, null);

    saving.change(first);
    saving.write(send);
    // The learner writes on, and the editor closes: the first save is alone
    // on its way, so these words are not sent.
    saving.change(second);
    saving.write(send);
    expect(sent()).toEqual(["add |Grade 12"]);

    answer("failed");
    expect(sent()).toEqual([
      "add |Grade 12",
      "reopen School|Grade 12, science track",
    ]);
  });

  it("gives back nothing for a failed first save when the learner emptied the editor", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(null, null);

    saving.change(first);
    saving.write(send);
    saving.change(blank);
    saving.write(send);
    answer("failed");

    expect(sent()).toEqual(["add |Grade 12"]);
  });

  it("sends a later write while an earlier one is on its way, so closing the editor never waits for an answer", () => {
    const { send, sent } = page();
    const saving = createAutosave(stored, null);

    saving.change({ text: "Grade 12, science", title: "" });
    saving.write(send);
    saving.change(second);
    saving.write(send);

    expect(sent()).toEqual([
      `edit ${stored.id} |Grade 12, science`,
      `edit ${stored.id} School|Grade 12, science track`,
    ]);
  });

  it("keeps the newer write when an older one fails late, and gives back and sends again the newest when it fails itself", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(stored, null);

    saving.change({ text: "Grade 12, science", title: "" });
    saving.write(send);
    saving.change(second);
    saving.write(send);
    // The older write fails after the newer one went out: the server has the
    // newer one, so nothing is given back and nothing is sent again.
    answer("failed");
    saving.write(send);
    expect(sent()).toHaveLength(2);

    answer("failed");
    saving.write(send);
    expect(sent()).toEqual([
      `edit ${stored.id} |Grade 12, science`,
      `edit ${stored.id} School|Grade 12, science track`,
      "reopen School|Grade 12, science track",
      `edit ${stored.id} School|Grade 12, science track`,
    ]);
  });

  it("gives back the words the editor holds when the newest write fails, though the learner wrote on after it went out", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(stored, null);

    saving.change(second);
    saving.write(send);
    saving.change(third);
    answer("failed");

    expect(sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
      "reopen School|Grade 12, science track, Bandung",
    ]);
  });

  it("closes the editor when the server has no such memory any more, and gives nothing back", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(stored, null);

    saving.change(second);
    saving.write(send);
    answer("refused");

    expect(sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
      "leave",
    ]);
  });

  it("writes nothing more once the server answered that the memory is gone, also when the editor saves what it still holds as it closes", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(stored, null);

    saving.change(second);
    saving.write(send);
    answer("refused");
    saving.write(send);

    expect(sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
      "leave",
    ]);
  });

  it("closes the editor for a memory that is gone also when an older write is the one that finds out", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(stored, null);

    saving.change({ text: "Grade 12, science", title: "" });
    saving.write(send);
    saving.change(second);
    saving.write(send);
    answer("refused");

    expect(sent()).toEqual([
      `edit ${stored.id} |Grade 12, science`,
      `edit ${stored.id} School|Grade 12, science track`,
      "leave",
    ]);
  });

  it("closes the editor and writes nothing more when the learner deleted every memory while the first save was on its way", () => {
    const { answer, clear, send, sent } = page();
    const saving = createAutosave(null, null);

    saving.change(first);
    saving.write(send);
    // The learner writes on while the server stores the memory, and deletes
    // every memory: the server deleted the stored one with the others.
    saving.change(second);
    clear();
    answer("done");
    saving.write(send);

    expect(sent()).toEqual(["add |Grade 12", "leave"]);
  });

  it("stores a new memory as usual when the learner deleted every memory before the first save went out", () => {
    const { answer, clear, send, sent } = page();
    const saving = createAutosave(null, null);

    saving.change(first);
    clear();
    saving.write(send);
    answer("done");

    expect(sent()).toEqual(["add |Grade 12", `adopt ${NEW_ID} |Grade 12`]);
  });

  it("gives nothing back and closes nothing after the learner deleted the memory", () => {
    const failed = page();
    const gone = createAutosave(stored, null);

    gone.change(second);
    gone.write(failed.send);
    gone.discard(failed.send, stored);
    failed.answer("failed");
    expect(failed.sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
      `remove ${stored.id} School|Grade 12, science track`,
    ]);

    const missing = page();
    const deleted = createAutosave(stored, null);

    deleted.change(second);
    deleted.write(missing.send);
    deleted.discard(missing.send, stored);
    missing.answer("refused");
    expect(missing.sent()).not.toContain("leave");
  });

  it("deletes the memory the editor shows, with the words the editor held for a rollback or, when it held none, the words of the memory, and writes nothing after", () => {
    const { send, sent } = page();
    const saving = createAutosave(stored, null);
    const emptied = createAutosave(stored, null);

    // The learner wrote the second draft and pressed Delete before the editor
    // saved it, so the stored words are not what a rollback brings back.
    saving.change(second);
    saving.discard(send, stored);
    saving.write(send);
    emptied.change(blank);
    emptied.discard(send, stored);

    expect(sent()).toEqual([
      `remove ${stored.id} School|Grade 12, science track`,
      `remove ${stored.id} |Grade 12`,
    ]);
  });

  it("deletes the memory its first save stored, also when the editor does not show it yet", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(null, null);

    saving.change(first);
    saving.write(send);
    answer("done");
    saving.discard(send, null);

    expect(sent()).toEqual([
      "add |Grade 12",
      `adopt ${NEW_ID} |Grade 12`,
      `remove ${NEW_ID} |Grade 12`,
    ]);
  });

  it("deletes the memory the server stores after the learner deleted it, with the words the editor held for a rollback, because its row showed", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(null, null);

    saving.change(first);
    saving.write(send);
    saving.change(second);
    saving.discard(send, null);
    expect(sent()).toEqual(["add |Grade 12"]);

    answer("done");
    expect(sent()).toEqual([
      "add |Grade 12",
      `remove ${NEW_ID} School|Grade 12, science track`,
    ]);
  });

  it("deletes nothing more for a memory that Delete all deleted while its first save was on its way", () => {
    const { answer, clear, send, sent } = page();
    const saving = createAutosave(null, null);

    saving.change(first);
    saving.write(send);
    saving.discard(send, null);
    clear();
    answer("done");

    expect(sent()).toEqual(["add |Grade 12", "leave"]);
  });

  it("keeps a stored memory the learner emptied when the editor closes, and writes nothing for its blank words", () => {
    const { send, sent } = page();
    const saving = createAutosave(stored, null);

    saving.change(second);
    saving.write(send);
    // A write while the editor is open sends nothing for words that say nothing.
    saving.change(blank);
    saving.write(send);
    saving.close(send);
    saving.close(send);

    expect(sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
    ]);
  });

  it("deletes nothing more when the editor closes after the learner deleted the memory, and deletes or creates nothing for a new memory that was never given a word", () => {
    const { send, sent } = page();
    const deleted = createAutosave(stored, null);
    const empty = createAutosave(null, null);

    deleted.discard(send, stored);
    deleted.change(blank);
    deleted.close(send);
    empty.discard(send, null);
    empty.close(send);
    empty.change({ text: " ", title: " " });
    empty.close(send);

    expect(sent()).toEqual([`remove ${stored.id} |Grade 12`]);
  });

  it("keeps the memory the server stores after the learner emptied the editor while the first save was on its way, with the words it was sent", () => {
    const { answer, send, sent } = page();
    const saving = createAutosave(null, null);

    saving.change(first);
    saving.write(send);
    saving.change(blank);
    saving.close(send);
    answer("done");

    expect(sent()).toEqual(["add |Grade 12", `adopt ${NEW_ID} |Grade 12`]);
  });
});
