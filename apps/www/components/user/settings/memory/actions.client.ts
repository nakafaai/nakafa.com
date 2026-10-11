"use client";

import { useMutation } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { randomUuid } from "@repo/utilities/uuid";
import { DateTime, Duration, Effect, type Result } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/** How long the toast of a deleted memory offers an Undo. */
const UNDO = Duration.seconds(5);

/**
 * The changes the learner makes on the Memory page. Each one shows at once on
 * every page the browser holds, and a failure shows a toast while the page
 * rolls back: Convex runs the optimistic change again until the server
 * answers, then drops it. A new or rewritten memory that fails comes back in
 * its editor with what the learner wrote.
 */
export function useMemoryActions() {
  const t = useTranslations("Memory");
  const other = useTranslations("Common")("action-error");

  const reopen = useMemoryPage((state) => state.reopen);
  const session = useMemoryPage((state) => state.session);

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
  const messages = { missing: t("missing"), other };

  /**
   * Sends one change from an event. `done` gets what the server answered. When
   * the change fails, the learner is told and `failed` runs with whether they
   * can try the change again.
   */
  function settle<A, E>(
    send: () => Promise<Result.Result<A, E>>,
    after: {
      done?: (answer: A) => void;
      failed?: (again: boolean) => void;
    } = {}
  ) {
    Effect.runFork(
      Effect.tryPromise(send).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.flatMap(reportMemoryFailure(error, messages), (again) =>
              Effect.sync(() => after.failed?.(again))
            ),
          onSuccess: (answer) => Effect.sync(() => after.done?.(answer)),
        })
      )
    );
  }

  /**
   * Writes a new memory in the learner's own words. `done` gets the id the
   * server gave it. `failed` runs when the server did not take it, with
   * whether the learner can try again. A caller that passes none gets the
   * words back in the editor.
   */
  function add(
    draft: MemoryDraft,
    after: {
      done?: (id: Memory["id"]) => void;
      failed?: (again: boolean) => void;
    } = {}
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
      {
        ...after,
        failed:
          after.failed ??
          ((again) => {
            if (again) {
              reopen(session, null, draft);
            }
          }),
      }
    );
  }

  /**
   * Rewrites one memory in the learner's own words. `failed` runs when the
   * server did not take them, with whether the learner can try again.
   */
  function edit(
    id: Memory["id"],
    draft: MemoryDraft,
    after: { failed?: (again: boolean) => void } = {}
  ) {
    const now = DateTime.toEpochMillis(DateTime.nowUnsafe());

    settle(
      () =>
        editDraft.withOptimisticUpdate((store) =>
          editInList(store, id, draft, now)
        )({ ...draftArgs(draft), id }),
      after
    );
  }

  /** Deletes a memory without a word, for one the learner never saw stored. */
  function drop(id: Memory["id"]) {
    settle(() => removeById({ id }));
  }

  /**
   * Deletes a memory at once, on the page and on the server, so that closing
   * the page can never leave it stored. The toast offers an Undo, which writes
   * the title and the words back as the learner's own memory: the end date of
   * a situation does not come back.
   */
  function remove(memory: Memory) {
    drop(memory.id);

    toast(t("deleted"), {
      action: {
        label: t("undo"),
        onClick: () => add(draftOf(memory)),
      },
      duration: Duration.toMillis(UNDO),
    });
  }

  /** Pauses memory, or resumes it. Nothing is deleted either way. */
  function pause(paused: boolean) {
    settle(() => pauseTo({ paused }));
  }

  /** Deletes every memory. */
  function clear() {
    settle(() => clearAll());
  }

  return { add, clear, drop, edit, pause, remove };
}
