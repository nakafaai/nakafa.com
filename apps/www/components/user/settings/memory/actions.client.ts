"use client";

import { useMutation } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { MEMORY_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { randomUuid } from "@repo/utilities/uuid";
import { DateTime, Duration, Effect, Option, type Result } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { reportMemoryFailure } from "@/components/user/settings/memory/failure";
import {
  addMemory,
  clearMemories,
  draftArgs,
  draftOf,
  editMemory,
  learnerMemory,
  type Memory,
  type MemoryDraft,
  type MemoryList,
  pauseMemories,
  pendingId,
  removeMemory,
} from "@/components/user/settings/memory/list";
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/** How long the toast of a deleted memory offers an Undo. */
const UNDO = Duration.seconds(5);

/**
 * Applies one change to the page the browser holds, when it holds one. Convex
 * runs this again until the server answers, then drops it, so a change that
 * fails rolls back by itself.
 */
function patch(
  store: OptimisticLocalStore.OptimisticLocalStore,
  change: (list: MemoryList) => MemoryList
) {
  const cached = store.getQuery(nina.memory.list, {});

  if (Option.isSome(cached) && cached.value !== null) {
    store.setQuery(nina.memory.list, {}, Option.some(change(cached.value)));
  }
}

/**
 * The changes the learner makes on the Memory page. Each one shows at once,
 * and a failure shows a toast while the page rolls back. A new or rewritten
 * memory that fails comes back in its editor with what the learner wrote.
 */
export function useMemoryActions() {
  const t = useTranslations("Memory");
  const other = useTranslations("Common")("action-error");

  const reopen = useMemoryPage((state) => state.reopen);

  const addDraft = useMutation(nina.memory.add);
  const editDraft = useMutation(nina.memory.edit);
  const removeById = useMutation(nina.memory.remove).withOptimisticUpdate(
    (store, { id }) => patch(store, (list) => removeMemory(list, id))
  );
  const pauseTo = useMutation(nina.memory.pause).withOptimisticUpdate(
    (store, { paused }) => patch(store, (list) => pauseMemories(list, paused))
  );
  const clearAll = useMutation(nina.memory.clear).withOptimisticUpdate(
    (store) => patch(store, clearMemories)
  );
  const messages = {
    limit: t("limit", { count: MEMORY_LIMIT }),
    missing: t("missing"),
    other,
  };

  /**
   * Sends one change from an event. `done` gets what the server answered. When
   * the change fails, the learner is told, `failed` runs, and `retry` gives
   * them back what they wrote while they can still try again.
   */
  function settle<A, E>(
    send: () => Promise<Result.Result<A, E>>,
    after: {
      done?: (answer: A) => void;
      failed?: () => void;
      retry?: () => void;
    } = {}
  ) {
    Effect.runFork(
      Effect.tryPromise(send).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.flatMap(reportMemoryFailure(error, messages), (again) =>
              Effect.sync(() => {
                after.failed?.();
                if (again) {
                  after.retry?.();
                }
              })
            ),
          onSuccess: (answer) => Effect.sync(() => after.done?.(answer)),
        })
      )
    );
  }

  /**
   * Writes a new memory in the learner's own words. `done` gets the id the
   * server gave it, and `failed` runs when the server did not take it.
   */
  function add(
    draft: MemoryDraft,
    after: { done?: (id: Memory["id"]) => void; failed?: () => void } = {}
  ) {
    const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
    const memory = learnerMemory(
      draft,
      pendingId(Effect.runSync(randomUuid)),
      now
    );

    settle(
      () =>
        addDraft.withOptimisticUpdate((store) =>
          patch(store, (list) => addMemory(list, memory))
        )(draftArgs(draft)),
      { ...after, retry: () => reopen(null, draft) }
    );
  }

  /**
   * Rewrites one memory in the learner's own words. `done` runs when the
   * server took them, and `failed` when it did not.
   */
  function edit(
    id: Memory["id"],
    draft: MemoryDraft,
    after: { done?: () => void; failed?: () => void } = {}
  ) {
    const now = DateTime.toEpochMillis(DateTime.nowUnsafe());

    settle(
      () =>
        editDraft.withOptimisticUpdate((store) =>
          patch(store, (list) => editMemory(list, id, draft, now))
        )({ ...draftArgs(draft), id }),
      { ...after, retry: () => reopen(id, draft) }
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
