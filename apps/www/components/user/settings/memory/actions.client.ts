"use client";

import { useMutation } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { randomUuid } from "@repo/utilities/uuid";
import { DateTime, Effect, Option, Record as Rec, type Result } from "effect";
import { useTranslations } from "next-intl";
import { reportMemoryFailure } from "@/components/user/settings/memory/failure";
import {
  draftArgs,
  draftOf,
  learnerMemory,
  type Memory,
  type MemoryDraft,
  pendingId,
} from "@/components/user/settings/memory/list";
import {
  addToList,
  clearList,
  editInList,
  pauseState,
  removeFromList,
} from "@/components/user/settings/memory/optimistic";
import {
  useMemoryLatest,
  useMemoryPage,
} from "@/components/user/settings/memory/provider";

/**
 * The changes the learner makes on the Memory page. Each one shows at once on
 * every page the browser holds, and a failure shows a toast while the page
 * rolls back: Convex runs the optimistic change again until the server
 * answers, then drops it. A new or rewritten memory that fails comes back in
 * its editor with what the learner wrote. A delete waits for the learner to
 * confirm it, and then shows at once in the same way.
 *
 * An action reads what the learner is doing when it runs and subscribes to
 * none of it, so a component that only acts, such as a row, renders again for
 * none of it.
 */
export function useMemoryActions() {
  const tToast = useTranslations("Toast");
  const other: ToastCopy = {
    description: tToast("action-error.description"),
    title: tToast("action-error.title"),
  };

  const latest = useMemoryLatest();
  const forget = useMemoryPage((state) => state.forget);
  const forgetAll = useMemoryPage((state) => state.forgetAll);
  const recall = useMemoryPage((state) => state.recall);
  const recallAll = useMemoryPage((state) => state.recallAll);
  const withhold = useMemoryPage((state) => state.withhold);
  const release = useMemoryPage((state) => state.release);
  const reopen = useMemoryPage((state) => state.reopen);
  const rewrite = useMemoryPage((state) => state.rewrite);

  const addDraft = useMutation(nina.memory.add);
  const editDraft = useMutation(nina.memory.edit);
  const removeById = useMutation(nina.memory.remove).withOptimisticUpdate(
    (store, { id }) => removeFromList(store, id)
  );
  const pauseTo = useMutation(nina.memory.pause).withOptimisticUpdate(
    (store, { paused }) => pauseState(store, paused)
  );
  const clearAll = useMutation(nina.memory.clear).withOptimisticUpdate(
    (store) => clearList(store)
  );
  const messages = {
    limit: { title: tToast("memory-limit.title") },
    missing: { title: tToast("memory-missing.title") },
    other,
  };

  /**
   * Sends one change from an event. `done` gets what the server answered. When
   * the change fails, the learner is told, in the words of the page unless the
   * change brings its own `told`, and `failed` runs with whether they can try
   * the change again.
   */
  function settle<A, E>(
    send: () => Promise<Result.Result<A, E>>,
    after: {
      done?: (answer: A) => void;
      failed?: (again: boolean) => void;
      told?: typeof messages;
    } = {}
  ) {
    Effect.runFork(
      Effect.tryPromise(send).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.flatMap(
              reportMemoryFailure(error, after.told ?? messages),
              (again) => Effect.sync(() => after.failed?.(again))
            ),
          onSuccess: (answer) => Effect.sync(() => after.done?.(answer)),
        })
      )
    );
  }

  /**
   * Writes a new memory in the learner's own words. `done` gets the memory as
   * the learner has it, with the id the server gave it. `failed` runs when the
   * server did not take it, with whether the learner can try again.
   */
  function add(
    draft: MemoryDraft,
    after: {
      done: (memory: Memory) => void;
      failed: (again: boolean) => void;
    }
  ) {
    const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
    const memory = learnerMemory(
      draft,
      pendingId(Effect.runSync(randomUuid)),
      now
    );

    settle(
      () =>
        addDraft.withOptimisticUpdate((store) => addToList(store, memory))(
          draftArgs(draft)
        ),
      { ...after, done: (id) => after.done({ ...memory, id }) }
    );
  }

  /**
   * Rewrites one memory in the learner's own words. `failed` runs when the
   * server did not take them, with whether the learner can try again. Nothing
   * is sent for a memory the learner deleted since.
   */
  function edit(
    id: Memory["id"],
    draft: MemoryDraft,
    after: { failed?: (again: boolean) => void } = {}
  ) {
    if (latest().deleted === id) {
      withhold(id, draft);
      return;
    }

    const now = DateTime.toEpochMillis(DateTime.nowUnsafe());

    rewrite(id, draft, now);
    settle(
      () =>
        editDraft.withOptimisticUpdate((store) =>
          editInList(store, id, draft, now)
        )({ ...draftArgs(draft), id }),
      after
    );
  }

  /**
   * Deletes a memory at once, on the page and on the server, so that closing
   * the page can never leave it stored. The learner has confirmed the delete
   * before it reaches here.
   *
   * When the server does not delete the memory, everything the deletion took
   * comes back: the memory in the list, and the editor that was on it with
   * `words`, what the editor still held when the deletion closed it, or the
   * words of the memory when the editor held nothing more. The page store keeps
   * those words only until the server answers.
   *
   * A memory the learner deleted already is not deleted again. That is the case
   * of the editor on a memory whose words the learner removed, when the
   * learner deletes the memory from its row: the deletion closes the editor,
   * and the editor, closing on no words, would delete the memory a second time.
   */
  function remove(memory: Memory, words: MemoryDraft = draftOf(memory)) {
    const before = latest();

    if (before.deleted === memory.id) {
      return;
    }

    const editing = before.open && before.target?.id === memory.id;

    forget(memory.id);

    const { session } = latest();
    settle(() => removeById({ id: memory.id }), {
      failed: () => {
        const held = Option.getOrElse(
          Rec.get(latest().withheld, memory.id),
          () => words
        );

        release(memory.id);
        recall(memory.id);
        if (editing) {
          reopen(session, held, memory);
        }
      },
    });
  }

  /** Pauses memory, or resumes it. Nothing is deleted either way. */
  function pause(paused: boolean) {
    settle(() => pauseTo({ paused }));
  }

  /**
   * Deletes every memory. The editor on one of them closes with it, and a first
   * save that is on its way learns that the server deleted its memory too. The
   * server hides the memories from every reader the moment it answers, and
   * deletes them in batches after that.
   */
  function clear() {
    const before = latest();
    const editing = before.open ? before.target : null;

    forgetAll();

    const { session } = latest();

    settle(() => clearAll(), {
      // The server deleted everything: the words the editor still held on its
      // memory have nothing to come back to.
      done: () => {
        if (editing) {
          release(editing.id);
        }
      },
      // The server deleted nothing: the memory the editor was on is the
      // learner's again with the words the editor held, and a first save on
      // its way keeps its editor.
      failed: () => {
        recallAll();
        if (before.target) {
          recall(before.target.id);
        }
        if (editing) {
          const held = Option.getOrElse(
            Rec.get(latest().withheld, editing.id),
            () => draftOf(editing)
          );

          // An editor the learner opened since keeps its place, so the words
          // are let go here whether or not the old editor comes back.
          release(editing.id);
          reopen(session, held, editing);
        }
      },
    });
  }

  return { add, clear, edit, pause, remove };
}
