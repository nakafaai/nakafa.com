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
    send: {
      add(
        draft: MemoryDraft,
        after: {
          done?: (id: Memory["id"]) => void;
          failed?: (again: boolean) => void;
        } = {}
      ) {
        note(`add ${words(draft)}`);
        MutableList.append(answers, {
          done: () => after.done?.(NEW_ID),
          failed: () => after.failed?.(true),
          refused: () => after.failed?.(false),
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
        after: { failed?: (again: boolean) => void } = {}
      ) {
        note(`edit ${id} ${words(draft)}`);
        MutableList.append(answers, {
          done: () => undefined,
          failed: () => after.failed?.(true),
          refused: () => after.failed?.(false),
        });
      },
      remove(memory: Memory) {
        note(`remove ${memory.id}`);
      },
      reopen(id: Memory["id"] | null, draft: MemoryDraft) {
        note(`reopen ${id} ${words(draft)}`);
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

  it("gives the words of a failed write back, and sends them again with the next write", () => {
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
      "reopen null |Grade 12",
      "add |Grade 12",
      `adopt ${NEW_ID}`,
      `edit ${NEW_ID} School|Grade 12, science track`,
      `reopen ${NEW_ID} School|Grade 12, science track`,
      `edit ${NEW_ID} School|Grade 12, science track`,
    ]);
  });

  it("sends a later write while an earlier one is on its way, so closing the editor never waits for an answer", () => {
    const { send, sent } = page();
    const saving = createAutosave(stored, first);

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
    const saving = createAutosave(stored, first);

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
      `reopen ${stored.id} School|Grade 12, science track`,
      `edit ${stored.id} School|Grade 12, science track`,
    ]);
  });

  it("gives nothing back for a write the learner cannot try again, or after they deleted the memory", () => {
    const refused = page();
    const gone = createAutosave(stored, first);

    gone.change(second);
    gone.write(refused.send);
    refused.answer("refused");
    expect(refused.sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
    ]);

    const deleted = page();
    const saving = createAutosave(stored, first);

    saving.change(second);
    saving.write(deleted.send);
    saving.discard(deleted.send, stored);
    deleted.answer("failed");
    expect(deleted.sent()).toEqual([
      `edit ${stored.id} School|Grade 12, science track`,
      `remove ${stored.id}`,
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
